import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { getAuthToken, notifyUnauthorized } from './authToken';

const getBaseUrl = () => {
    if (__DEV__) {
        if (Platform.OS === 'web') return 'http://localhost:3000/api';

        const debuggerHost = Constants.expoConfig?.hostUri;
        const localhost = debuggerHost?.split(':')[0];

        if (!localhost) {
            return 'http://localhost:3000/api';
        }

        return `http://${localhost}:3000/api`;
    }

    return 'https://plaqu-up-production.up.railway.app/api';
};

export const BASE_URL = getBaseUrl();

/** An error answered by the server, with its machine-readable code and extra fields. */
export class ApiError extends Error {
    constructor(message: string, public code?: string, public data: Record<string, any> = {}) {
        super(message);
    }
}

const authFetch = async (url: string, init: RequestInit = {}) => {
    const token = getAuthToken();
    const headers = { ...(init.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) notifyUnauthorized();
    if (response.status === 403) {
        // A suspended account keeps a valid token: sign it out and say why.
        const body = await response.clone().json().catch(() => null);
        if (body?.code === 'ACCOUNT_SUSPENDED') {
            notifyUnauthorized();
            Alert.alert('Compte suspendu', 'Votre compte a été suspendu. Contactez contact@plaq-up.fr pour plus d\'informations.');
        }
    }
    return response;
};


export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    /** Sent as JSON. */
    json?: unknown;
    /** Sent as is (FormData: the boundary header is left to fetch). */
    body?: FormData;
    /** Message when the server gives none. */
    failure?: string;
    /** Resolve with null instead of throwing for these statuses. */
    nullOn?: number[];
}

/**
 * The one way the app talks to the server: adds the token, signs out on 401 and on suspension,
 * and turns any failure into an ApiError carrying the server's message, code and fields.
 */
export async function request<T = any>(path: string, { method = 'GET', json, body, failure = 'Request failed', nullOn = [] }: RequestOptions = {}): Promise<T> {
    const response = await authFetch(`${BASE_URL}${path}`, {
        method,
        ...(json !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) } : {}),
        ...(body ? { body } : {}),
    });
    if (nullOn.includes(response.status)) return null as T;
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(error.error || failure, error.code, error);
    }
    return response.json();
}
