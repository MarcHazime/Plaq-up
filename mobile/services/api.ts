import Constants from 'expo-constants';
import * as Plate from '../utils/plate';
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

const BASE_URL = getBaseUrl();

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

export const api = {
    async register(plate: string, password: string, email: string, acceptTerms: boolean) {
        const response = await authFetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plate, password, email, acceptTerms }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }
        return response.json();
    },

    async verifyEmail(userId: string, code: string) {
        const response = await authFetch(`${BASE_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, code }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verification failed');
        }
        return response.json();
    },

    async resendVerification(userId: string) {
        const response = await authFetch(`${BASE_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Impossible d'envoyer le code");
        }
        return response.json();
    },

    async login(plate: string, password: string) {
        const response = await authFetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plate, password }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(error.error || 'Login failed', error.code, error);
        }
        return response.json();
    },

    async forgotPassword(email: string) {
        const response = await authFetch(`${BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async resetPassword(email: string, code: string, newPassword: string) {
        const response = await authFetch(`${BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Reset failed');
        }
        return response.json();
    },

    async getChatHistory(userId1: string, userId2: string, relatedPlate?: string) {
        let url = `${BASE_URL}/chats/history/${userId1}/${userId2}`;
        if (relatedPlate) {
            url += `?relatedPlate=${Plate.forUrl(relatedPlate)}`;
        }
        const response = await authFetch(url);
        if (!response.ok) throw new Error('Failed to fetch history');
        return response.json();
    },

    async getUserChats(userId: string) {
        const response = await authFetch(`${BASE_URL}/chats/list/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user chats');
        }
        return response.json();
    },

    async getUserById(userId: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user');
        }
        return response.json();
    },

    async reportMessage(messageId: string, reason: 'harassment' | 'spam' | 'inappropriate' | 'other') {
        const response = await authFetch(`${BASE_URL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, reason }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Signalement impossible');
        }
        return response.json();
    },

    async getSettings(userId: string): Promise<{ email: string | null; pseudo: string | null; acceptNewContacts: boolean }> {
        const response = await authFetch(`${BASE_URL}/users/${userId}/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
    },

    async updateUser(userId: string, data: { pseudo?: string | null; acceptNewContacts?: boolean; currentPassword?: string; newPassword?: string }) {
        const response = await authFetch(`${BASE_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Update failed');
        }
        return response.json();
    },

    async deleteUser(userId: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }
        return response.json();
    },

    async blockUser(blockerId: string, blockedId: string) {
        const response = await authFetch(`${BASE_URL}/users/block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockerId, blockedId }),
        });
        return response.json();
    },

    async unblockUser(blockerId: string, blockedId: string) {
        const response = await authFetch(`${BASE_URL}/users/unblock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockerId, blockedId }),
        });
        return response.json();
    },

    async getBlockStatus(userId: string, otherId: string) {
        const response = await authFetch(`${BASE_URL}/users/relationship/${userId}/${otherId}`);
        if (!response.ok) throw new Error('Failed to fetch block status');
        return response.json();
    },

    async getBlockedUsers(userId: string) {
        const response = await authFetch(`${BASE_URL}/users/blocked/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch blocked users');
        return response.json();
    },

    async deleteConversation(userId: string, partnerId: string) {
        const response = await authFetch(`${BASE_URL}/chats/${userId}/${partnerId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete conversation');
        return response.json();
    },

    async markMessagesAsRead(userId: string, partnerId: string) {
        const response = await authFetch(`${BASE_URL}/chats/read/${userId}/${partnerId}`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to mark messages as read');
        return response.json();
    },

    async updatePushToken(userId: string, pushToken: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}/push-token`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pushToken }),
        });
        if (!response.ok) {
            // fail silently or log
            console.error('Failed to update push token');
        }
        return response.json();
    },

    async getVehicleInfo(plate: string) {
        const response = await authFetch(`${BASE_URL}/siv/${Plate.forUrl(plate)}`);
        if (response.status === 404) return null; // no account for this plate
        if (!response.ok) {
            throw new Error('Failed to fetch vehicle info');
        }
        return response.json();
    },

    async scanPlate(formData: FormData) {
        console.log('Scanning plate at:', `${BASE_URL}/siv/scan`);
        const response = await authFetch(`${BASE_URL}/siv/scan`, {
            method: 'POST',
            body: formData,
            // Do NOT set Content-Type header for FormData, let fetch handle it with boundary
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Scan failed');
        }
        return response.json();
    },

    async uploadImage(formData: FormData) {
        const response = await authFetch(`${BASE_URL}/chats/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        return response.json();
    },

    getUploadUrl(path: string) {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        // BASE_URL is http://host:3000/api, we need http://host:3000
        const rootUrl = BASE_URL.replace('/api', '');
        return `${rootUrl}${path}`;
    },

    async getVehicles(userId: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}/vehicles`);
        if (!response.ok) throw new Error('Failed to fetch vehicles');
        return response.json();
    },

    async addVehicle(userId: string, plate: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plate }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add vehicle');
        }
        return response.json();
    },

    async deleteVehicle(userId: string, vehicleId: string) {
        const response = await authFetch(`${BASE_URL}/users/${userId}/vehicles/${vehicleId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete vehicle');
        }
        return response.json();
    }
};
