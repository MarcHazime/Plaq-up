import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuth } from '../context/auth';
import { LEGAL_URLS } from '../constants/legal';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

/** Shown to an account that has not accepted the current Terms: nothing else is reachable until it does. */
export default function Terms() {
    const { acceptTerms, signOut } = useAuth();
    const [busy, setBusy] = useState(false);

    const accept = async () => {
        setBusy(true);
        try {
            await acceptTerms();
        } catch (error: any) {
            Alert.alert('Erreur', error.message);
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Nos conditions d'utilisation</Text>
                <Text style={styles.text}>
                    Pour continuer à utiliser Plaq'Up, merci de lire et d'accepter les conditions d'utilisation et la politique de confidentialité.
                </Text>
                <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>Conditions d'utilisation</Text>
                <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>Politique de confidentialité</Text>

                <TouchableOpacity style={[styles.button, busy && { opacity: 0.6 }]} onPress={accept} disabled={busy}>
                    <Text style={styles.buttonText}>J'accepte</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={signOut} disabled={busy}>
                    <Text style={styles.refuse}>Refuser et me déconnecter</Text>
                </TouchableOpacity>
                <Text style={styles.hint}>Vous pouvez aussi supprimer votre compte depuis l'onglet Profil après avoir accepté.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flex: 1, justifyContent: 'center', padding: SPACING.l, gap: SPACING.m },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
    text: { fontSize: 16, color: COLORS.textSecondary },
    link: { fontSize: 16, color: COLORS.primary, fontWeight: 'bold', textDecorationLine: 'underline' },
    button: { backgroundColor: COLORS.primary, borderRadius: RADIUS.m, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.m },
    buttonText: { color: COLORS.surface, fontSize: 18, fontWeight: 'bold' },
    refuse: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 15, padding: SPACING.s },
    hint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
});
