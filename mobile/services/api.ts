import * as Plate from '../utils/plate';
import { ApiError, BASE_URL, request } from './http';

export { ApiError };

type ReportReason = 'harassment' | 'spam' | 'inappropriate' | 'other';

export interface Settings {
    email: string | null;
    pseudo: string | null;
    acceptNewContacts: boolean;
    /** False for an account that has not accepted the current Terms yet. */
    termsAccepted: boolean;
}

export const api = {
    // --- account ---
    register: (plate: string, password: string, email: string, acceptTerms: boolean) =>
        request('/auth/register', { method: 'POST', json: { plate, password, email, acceptTerms }, failure: 'Registration failed' }),

    verifyEmail: (userId: string, code: string) =>
        request('/auth/verify', { method: 'POST', json: { userId, code }, failure: 'Verification failed' }),

    resendVerification: (userId: string) =>
        request('/auth/resend-verification', { method: 'POST', json: { userId }, failure: "Impossible d'envoyer le code" }),

    login: (plate: string, password: string) =>
        request('/auth/login', { method: 'POST', json: { plate, password }, failure: 'Login failed' }),

    forgotPassword: (email: string) =>
        request('/auth/forgot-password', { method: 'POST', json: { email }, failure: 'Request failed' }),

    resetPassword: (email: string, code: string, newPassword: string) =>
        request('/auth/reset-password', { method: 'POST', json: { email, code, newPassword }, failure: 'Reset failed' }),

    getSettings: (userId: string) => request<Settings>(`/users/${userId}/settings`, { failure: 'Failed to fetch settings' }),

    acceptTerms: (userId: string) => request(`/users/${userId}/accept-terms`, { method: 'POST', failure: 'Failed to accept the terms' }),

    updateUser: (userId: string, data: { pseudo?: string | null; acceptNewContacts?: boolean; currentPassword?: string; newPassword?: string }) =>
        request(`/users/${userId}`, { method: 'PUT', json: data, failure: 'Update failed' }),

    deleteUser: (userId: string) => request(`/users/${userId}`, { method: 'DELETE', failure: 'Delete failed' }),

    getUserById: (userId: string) => request(`/users/${userId}`, { failure: 'Failed to fetch user' }),

    updatePushToken: (userId: string, pushToken: string) =>
        request(`/users/${userId}/push-token`, { method: 'PUT', json: { pushToken }, failure: 'Failed to update push token' }),

    // --- vehicles ---
    getVehicles: (userId: string) => request(`/users/${userId}/vehicles`, { failure: 'Failed to fetch vehicles' }),

    addVehicle: (userId: string, plate: string) =>
        request(`/users/${userId}/vehicles`, { method: 'POST', json: { plate }, failure: 'Failed to add vehicle' }),

    deleteVehicle: (userId: string, vehicleId: string) =>
        request(`/users/${userId}/vehicles/${vehicleId}`, { method: 'DELETE', failure: 'Failed to delete vehicle' }),

    /** Null when no account owns this plate. */
    getVehicleInfo: (plate: string) =>
        request(`/siv/${Plate.forUrl(plate)}`, { failure: 'Failed to fetch vehicle info', nullOn: [404] }),

    scanPlate: (formData: FormData) => request('/siv/scan', { method: 'POST', body: formData, failure: 'Scan failed' }),

    // --- chat ---
    getChatHistory: (userId1: string, userId2: string, relatedPlate?: string) =>
        request(`/chats/history/${userId1}/${userId2}${relatedPlate ? `?relatedPlate=${Plate.forUrl(relatedPlate)}` : ''}`, {
            failure: 'Failed to fetch history',
        }),

    getUserChats: (userId: string) => request(`/chats/list/${userId}`, { failure: 'Failed to fetch user chats' }),

    deleteConversation: (userId: string, partnerId: string) =>
        request(`/chats/${userId}/${partnerId}`, { method: 'DELETE', failure: 'Failed to delete conversation' }),

    markMessagesAsRead: (userId: string, partnerId: string) =>
        request(`/chats/read/${userId}/${partnerId}`, { method: 'PUT', failure: 'Failed to mark messages as read' }),

    uploadImage: (formData: FormData) => request('/chats/upload', { method: 'POST', body: formData, failure: 'Upload failed' }),

    reportMessage: (messageId: string, reason: ReportReason) =>
        request('/reports', { method: 'POST', json: { messageId, reason }, failure: 'Signalement impossible' }),

    // --- blocking ---
    blockUser: (blockerId: string, blockedId: string) =>
        request('/users/block', { method: 'POST', json: { blockerId, blockedId }, failure: 'Failed to block user' }),

    unblockUser: (blockerId: string, blockedId: string) =>
        request('/users/unblock', { method: 'POST', json: { blockerId, blockedId }, failure: 'Failed to unblock user' }),

    getBlockStatus: (userId: string, otherId: string) =>
        request(`/users/relationship/${userId}/${otherId}`, { failure: 'Failed to fetch block status' }),

    getBlockedUsers: (userId: string) => request(`/users/blocked/${userId}`, { failure: 'Failed to fetch blocked users' }),

    getUploadUrl(path: string) {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        // BASE_URL is http://host:3000/api, we need http://host:3000
        return `${BASE_URL.replace('/api', '')}${path}`;
    },
};
