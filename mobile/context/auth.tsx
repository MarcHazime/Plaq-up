import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { api } from '../services/api';
import { setAuthToken, setUnauthorizedHandler } from '../services/authToken';

type User = {
    id: string;
    plate?: string; // Kept for backward compat (maps to primaryPlate)
    email?: string;
    pushToken?: string;
    primaryPlate?: string;
    token?: string;
};

type AuthContextType = {
    user: User | null;
    signIn: (user: User) => void;
    signOut: () => void;
    /** Records the acceptance of the current Terms, then lets the user in. */
    acceptTerms: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    signIn: () => { },
    signOut: () => { },
    acceptTerms: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // True when the account has not accepted the current Terms. Unknown or offline counts as accepted.
    const [needsTerms, setNeedsTerms] = useState(false);
    const router = useRouter();
    const segments = useSegments();
    const navigationState = useRootNavigationState();

    const checkTerms = (userId: string) => {
        api.getSettings(userId).then(
            settings => setNeedsTerms(!settings.termsAccepted),
            () => setNeedsTerms(false)
        );
    };

    const acceptTerms = async () => {
        if (!user) return;
        await api.acceptTerms(user.id);
        setNeedsTerms(false);
        router.replace('/(tabs)/search');
    };

    useEffect(() => {
        const loadSession = async () => {
            if (Platform.OS === 'web') {
                setIsLoading(false);
                return;
            }
            try {
                const storedUser = await SecureStore.getItemAsync('user');
                if (storedUser) {
                    const parsed: User = JSON.parse(storedUser);
                    // Sessions saved before tokens existed must sign in again.
                    if (parsed.token) {
                        setAuthToken(parsed.token);
                        setUser(parsed);
                        checkTerms(parsed.id);
                    } else {
                        await SecureStore.deleteItemAsync('user');
                    }
                }
            } catch (error) {
                console.error('Failed to load session:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSession();
    }, []);

    const signIn = async (userData: User) => {
        // Compatibility: Ensure 'plate' is set from 'primaryPlate' if needed
        if (!userData.plate && userData.primaryPlate) {
            userData.plate = userData.primaryPlate;
        }
        setAuthToken(userData.token ?? null);
        setUser(userData);
        checkTerms(userData.id);
        if (Platform.OS !== 'web') {
            SecureStore.setItemAsync('user', JSON.stringify(userData)).catch(console.error);

            // Register for push notifications
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    // Update token in backend
                    await api.updatePushToken(userData.id, token);
                }
            } catch (error) {
                console.error('Error registering push token:', error);
            }
        }
        router.replace('/(tabs)/search');
    };

    const signOut = () => {
        setAuthToken(null);
        setUser(null);
        setNeedsTerms(false);
        if (Platform.OS !== 'web') {
            SecureStore.deleteItemAsync('user').catch(console.error);
        }
        router.replace('/(auth)/login');
    };

    useEffect(() => {
        setUnauthorizedHandler(signOut);
        return () => setUnauthorizedHandler(null);
    });

    useEffect(() => {
        if (isLoading) return;
        if (!navigationState?.key) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!user && !inAuthGroup) {
            router.replace('/(auth)/login');
        } else if (user && needsTerms) {
            if (segments[0] !== 'terms') router.replace('/terms');
        } else if (user && (inAuthGroup || segments[0] === 'terms')) {
            router.replace('/(tabs)/search');
        }
    }, [user, needsTerms, segments, navigationState?.key, isLoading]);

    return (
        <AuthContext.Provider value={{ user, signIn, signOut, acceptTerms }}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
}
