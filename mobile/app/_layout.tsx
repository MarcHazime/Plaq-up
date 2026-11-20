import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';

// Opt-in: without EXPO_PUBLIC_SENTRY_DSN nothing is sent.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn) {
    Sentry.init({
        dsn,
        sendDefaultPii: false,
        enableAutoSessionTracking: true,
        tracesSampleRate: 0,
    });
}

function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="terms" />
            </Stack>
        </AuthProvider>
    );
}

export default dsn ? Sentry.wrap(RootLayout) : RootLayout;
