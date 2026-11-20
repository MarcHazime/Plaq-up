import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, Linking } from 'react-native';
import { LEGAL_URLS } from '../../constants/legal';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../../context/auth';
import { api } from '../../services/api';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { formatPlate } from '../../utils/formatting';

export default function Register() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [plate, setPlate] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);

    const handleRegister = async () => {
        try {
            setError('');
            if (!email) {
                setError('Email requis pour la vérification');
                return;
            }
            if (!acceptTerms) {
                setError("Acceptez les conditions d'utilisation et la politique de confidentialité");
                return;
            }
            const response = await api.register(plate, password, email, acceptTerms);
            if (response.requiresVerification) {
                router.push({
                    pathname: '/(auth)/verify-email',
                    params: { userId: response.userId, email: response.email }
                });
            } else {
                signIn({ id: response.userId, plate: plate, email: email });
            }
        } catch (err: any) {
            setError(err.message);
            Alert.alert("Erreur d'inscription", err.message);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={COLORS.primaryGradient}
                style={styles.background}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Image
                            source={require('../../assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Rejoindre Plaq'Up</Text>
                        <Text style={styles.subtitle}>Créer votre compte citoyen</Text>
                    </View>

                    <View style={styles.form}>
                        {error ? <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text></View> : null}

                        <View style={styles.inputContainer}>
                            <Ionicons name="car-sport-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Numéro de Plaque (XX-123-XX)"
                                placeholderTextColor={COLORS.textSecondary}
                                value={plate}
                                onChangeText={(text) => setPlate(formatPlate(text))}
                                autoCapitalize="characters"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email (Requis)"
                                placeholderTextColor={COLORS.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Mot de passe (min 8 car.)"
                                placeholderTextColor={COLORS.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.termsRow}
                            onPress={() => setAcceptTerms(v => !v)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: acceptTerms }}
                        >
                            <Ionicons
                                name={acceptTerms ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={acceptTerms ? COLORS.primary : COLORS.textSecondary}
                            />
                            <Text style={styles.termsText}>
                                {"J'accepte les "}
                                <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>conditions d'utilisation</Text>
                                {' et la '}
                                <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>politique de confidentialité</Text>
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={handleRegister}>
                            <LinearGradient
                                colors={COLORS.primaryGradient}
                                style={styles.buttonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.buttonText}>S'inscrire</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Déjà un compte ? </Text>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Text style={styles.link}>Se connecter</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '40%',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: SPACING.l,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.l,
        padding: SPACING.xl,
        ...SHADOWS.medium,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: SPACING.m,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.m,
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 56,
    },
    inputIcon: {
        marginRight: SPACING.s,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        height: '100%',
    },
    button: {
        height: 56,
        borderRadius: RADIUS.m,
        marginBottom: SPACING.l,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: COLORS.surface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    termsText: {
        flex: 1,
        marginLeft: SPACING.s,
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        padding: SPACING.s,
        borderRadius: RADIUS.s,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        color: COLORS.error,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    footerText: {
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    link: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
