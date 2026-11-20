import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../context/auth';
import { api } from '../../services/api';
import { carnet, parking } from '../../carnet/adapters';
import { inspectionDue, proposedNextDate } from '../../carnet/carnet';
import { directionsUrl } from '../../carnet/parking';
import { fromFrench, maskFrench, toFrench } from '../../carnet/dates';
import { KIND_LABELS } from '../../carnet/types';
import type { DeadlineKind, DeadlineView, ParkingSpot } from '../../carnet/types';

const KINDS: DeadlineKind[] = ['inspection', 'insurance', 'service', 'other'];

const STATUS_COLOR = { overdue: COLORS.error, soon: COLORS.primary, ok: COLORS.success } as const;

const when = (d: DeadlineView) =>
    d.daysLeft < 0 ? `En retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "Aujourd'hui" : d.daysLeft === 1 ? 'Demain' : `Dans ${d.daysLeft} jours`;

export default function Carnet() {
    const { user } = useAuth();
    const [deadlines, setDeadlines] = useState<DeadlineView[]>([]);
    const [plates, setPlates] = useState<string[]>([]);
    const [spot, setSpot] = useState<ParkingSpot | null>(null);
    const [adding, setAdding] = useState(false);

    // form
    const [plate, setPlate] = useState('');
    const [kind, setKind] = useState<DeadlineKind>('inspection');
    const [label, setLabel] = useState('');
    const [dateText, setDateText] = useState('');
    const [firstRegText, setFirstRegText] = useState('');
    const [lastInspText, setLastInspText] = useState('');

    const refresh = useCallback(async () => {
        setDeadlines(await carnet.list());
        setSpot(await parking.current());
        if (user) {
            try {
                const v = await api.getVehicles(user.id);
                setPlates(v.map((x: { plate: string }) => x.plate));
            } catch {
                // offline: the carnet still works with the plates already known
            }
        }
    }, [user]);

    useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

    const openForm = () => {
        setPlate(plates[0] ?? '');
        setKind('inspection');
        setLabel('');
        setDateText('');
        setFirstRegText('');
        setLastInspText('');
        setAdding(true);
    };

    // Proposes the inspection date from the registration date, without overwriting what the user typed.
    const suggestInspection = (first: string, last: string) => {
        const due = inspectionDue({ firstRegistration: fromFrench(first), lastInspection: fromFrench(last) }, new Date());
        if (due) setDateText(toFrench(due));
    };

    const submit = async () => {
        const dueDate = fromFrench(dateText);
        if (!plate) return Alert.alert('Véhicule', "Ajoutez d'abord un véhicule dans l'onglet Profil.");
        if (!dueDate) return Alert.alert('Date', 'Entrez la date au format JJ/MM/AAAA.');
        const result = await carnet.add({ plate, kind, label, dueDate });
        if (!result.ok) {
            return Alert.alert('Échéance', result.reason === 'label_required' ? "Donnez un nom à l'échéance." : 'Date invalide.');
        }
        setAdding(false);
        if (!result.remindersOn) {
            Alert.alert('Rappels désactivés', "L'échéance est enregistrée, mais les notifications sont refusées. Autorisez-les dans les réglages du téléphone pour être prévenu.");
        }
        refresh();
    };

    const done = (d: DeadlineView) => {
        const next = proposedNextDate(d.kind, d.dueDate);
        Alert.alert(
            `${d.title} fait ?`,
            next ? `Prochaine échéance proposée : ${toFrench(next)}.` : 'Cette échéance sera retirée du carnet.',
            [
                { text: 'Annuler', style: 'cancel' },
                { text: next ? 'Valider' : 'Retirer', onPress: async () => { await carnet.markDone(d.id); refresh(); } },
            ]
        );
    };

    const remove = (d: DeadlineView) =>
        Alert.alert('Supprimer', `Supprimer « ${d.title} » (${d.plate}) ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: async () => { await carnet.remove(d.id); refresh(); } },
        ]);

    const parkHere = async () => {
        const result = await parking.parkHere();
        if (!result.ok) {
            return Alert.alert('Position indisponible', "Autorisez la localisation pendant l'utilisation de l'app dans les réglages du téléphone, puis réessayez.");
        }
        setSpot(result.spot);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="location" size={22} color={COLORS.primary} />
                        <Text style={styles.cardTitle}>Ma voiture est garée</Text>
                    </View>
                    {spot ? (
                        <Text style={styles.muted}>
                            Position enregistrée le {new Date(spot.savedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    ) : (
                        <Text style={styles.muted}>Enregistrez l'endroit pour le retrouver. La position reste sur votre téléphone.</Text>
                    )}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.primaryButton} onPress={parkHere}>
                            <Text style={styles.primaryButtonText}>{spot ? 'Garer ici (remplacer)' : 'Garer ici'}</Text>
                        </TouchableOpacity>
                        {spot && (
                            <>
                                <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(directionsUrl(spot))}>
                                    <Text style={styles.secondaryButtonText}>Y aller</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.secondaryButton} onPress={async () => { await parking.clear(); setSpot(null); }}>
                                    <Text style={styles.secondaryButtonText}>Effacer</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Échéances</Text>
                    <TouchableOpacity onPress={openForm} style={styles.addButton}>
                        <Ionicons name="add" size={20} color={COLORS.surface} />
                        <Text style={styles.addButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                </View>

                {deadlines.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.muted}>
                            Contrôle technique, assurance, entretien : ajoutez une date et Plaq'Up vous prévient 30 jours, 7 jours et le jour même.
                        </Text>
                    </View>
                ) : (
                    deadlines.map(d => (
                        <View key={d.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: STATUS_COLOR[d.status] }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{d.title}</Text>
                                <TouchableOpacity onPress={() => remove(d)} accessibilityLabel="Supprimer">
                                    <Ionicons name="trash-outline" size={20} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.muted}>{d.plate} · {toFrench(d.dueDate)}</Text>
                            <Text style={[styles.when, { color: STATUS_COLOR[d.status] }]}>{when(d)}</Text>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => done(d)}>
                                <Text style={styles.secondaryButtonText}>Fait</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>

            <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
                <View style={styles.modalBackdrop}>
                    <ScrollView style={styles.modal} keyboardShouldPersistTaps="handled">
                        <Text style={styles.cardTitle}>Nouvelle échéance</Text>

                        <Text style={styles.label}>Véhicule</Text>
                        <View style={styles.chips}>
                            {plates.length === 0 && <Text style={styles.muted}>Aucun véhicule : ajoutez-en un dans Profil.</Text>}
                            {plates.map(p => (
                                <TouchableOpacity key={p} style={[styles.chip, plate === p && styles.chipOn]} onPress={() => setPlate(p)}>
                                    <Text style={[styles.chipText, plate === p && styles.chipTextOn]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Type</Text>
                        <View style={styles.chips}>
                            {KINDS.map(k => (
                                <TouchableOpacity key={k} style={[styles.chip, kind === k && styles.chipOn]} onPress={() => setKind(k)}>
                                    <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{KIND_LABELS[k]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {kind === 'other' && (
                            <>
                                <Text style={styles.label}>Nom</Text>
                                <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Ex. Pneus hiver" placeholderTextColor={COLORS.textSecondary} maxLength={40} />
                            </>
                        )}

                        {kind === 'inspection' && (
                            <>
                                <Text style={styles.label}>Calculer la date (facultatif)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={firstRegText}
                                    onChangeText={t => { const m = maskFrench(t); setFirstRegText(m); suggestInspection(m, lastInspText); }}
                                    placeholder="Mise en circulation JJ/MM/AAAA"
                                    placeholderTextColor={COLORS.textSecondary}
                                    keyboardType="number-pad"
                                />
                                <TextInput
                                    style={styles.input}
                                    value={lastInspText}
                                    onChangeText={t => { const m = maskFrench(t); setLastInspText(m); suggestInspection(firstRegText, m); }}
                                    placeholder="Dernier contrôle JJ/MM/AAAA"
                                    placeholderTextColor={COLORS.textSecondary}
                                    keyboardType="number-pad"
                                />
                                <Text style={styles.hint}>Premier contrôle à 4 ans, puis tous les 2 ans. Vous pouvez corriger la date ci-dessous.</Text>
                            </>
                        )}

                        <Text style={styles.label}>Date d'échéance</Text>
                        <TextInput
                            style={styles.input}
                            value={dateText}
                            onChangeText={t => setDateText(maskFrench(t))}
                            placeholder="JJ/MM/AAAA"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="number-pad"
                        />

                        <View style={styles.row}>
                            <TouchableOpacity style={styles.primaryButton} onPress={submit}>
                                <Text style={styles.primaryButtonText}>Enregistrer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setAdding(false)}>
                                <Text style={styles.secondaryButtonText}>Annuler</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>Les échéances restent sur votre téléphone.</Text>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.m, gap: SPACING.m },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.m, padding: SPACING.m, gap: SPACING.s, ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.s },
    cardTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    muted: { color: COLORS.textSecondary, fontSize: 14 },
    when: { fontSize: 15, fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.s },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s },
    addButtonText: { color: COLORS.surface, fontWeight: 'bold', marginLeft: 4 },
    primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.m, paddingHorizontal: SPACING.m, paddingVertical: 12 },
    primaryButtonText: { color: COLORS.surface, fontWeight: 'bold' },
    secondaryButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.m, paddingHorizontal: SPACING.m, paddingVertical: 12, alignSelf: 'flex-start' },
    secondaryButtonText: { color: COLORS.text, fontWeight: '600' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.l, borderTopRightRadius: RADIUS.l, padding: SPACING.l, maxHeight: '90%' },
    label: { marginTop: SPACING.m, marginBottom: SPACING.xs, color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.m, paddingHorizontal: SPACING.m, height: 48, fontSize: 16, color: COLORS.text, marginBottom: SPACING.s },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
    chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.m, paddingVertical: 8 },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text },
    chipTextOn: { color: COLORS.surface, fontWeight: 'bold' },
    hint: { color: COLORS.textSecondary, fontSize: 12, marginTop: SPACING.s, marginBottom: SPACING.l },
});
