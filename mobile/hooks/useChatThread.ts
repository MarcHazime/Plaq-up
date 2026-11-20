import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { dropPending, mergeIncoming } from '../chat/thread';

interface Options {
    userId: string | undefined;
    partnerId: string | undefined;
    relatedPlate?: string;
    /** Called when the list changed and should scroll to the end. */
    onChanged?: (animated: boolean) => void;
}

/**
 * Everything a conversation screen needs from the server: the messages (history, live arrivals,
 * refusals), who the partner is, and whether either side blocked the other.
 */
export function useChatThread({ userId, partnerId, relatedPlate, onChanged }: Options) {
    const [messages, setMessages] = useState<any[]>([]);
    const [partnerName, setPartnerName] = useState('');
    const [isBlockedByMe, setIsBlockedByMe] = useState(false);
    const [isBlockedByPartner, setIsBlockedByPartner] = useState(false);

    const reload = useCallback(async () => {
        if (!userId || !partnerId) return;
        try {
            setMessages(await api.getChatHistory(userId, partnerId, relatedPlate));
            await api.markMessagesAsRead(userId, partnerId);
            onChanged?.(false);
        } catch (error) {
            console.error(error);
        }
    }, [userId, partnerId, relatedPlate]);

    useEffect(() => {
        if (!userId || !partnerId) return;

        api.getUserById(partnerId).then(
            partner => setPartnerName(partner.displayName || 'Utilisateur'),
            error => {
                console.error('Error fetching partner:', error);
                setPartnerName('Utilisateur');
            }
        );
        api.getBlockStatus(userId, partnerId).then(
            status => {
                setIsBlockedByMe(status.blockedByMe);
                setIsBlockedByPartner(status.blockedByOther);
            },
            error => console.error('Error checking block status:', error)
        );

        socket.connect();
        socket.emit('join_chat', [userId, partnerId].sort().join('_'));
        reload();

        socket.on('receive_message', message => {
            setMessages(prev => mergeIncoming(prev, message));
            onChanged?.(true);
        });
        socket.on('message_error', data => {
            // The optimistic message was refused: take it back and tell the user why.
            if (data.tempId) setMessages(prev => dropPending(prev, data.tempId));
            Alert.alert('Message non envoyé', data.error || 'Une erreur est survenue');
        });
        socket.on('quota_warning', (quota: { used: number; limit: number; level: string }) => {
            Alert.alert(
                quota.level === 'reached' ? 'Limite atteinte' : 'Bientôt la limite',
                `Vous avez utilisé ${quota.used} conversations sur ${quota.limit}.`
            );
        });

        return () => {
            socket.off('receive_message');
            socket.off('message_error');
            socket.off('quota_warning');
            socket.disconnect();
        };
    }, [userId, partnerId, relatedPlate]);

    /** Shows a message sent from this phone right away, before the server confirms it. */
    const addPending = useCallback((message: any) => {
        setMessages(prev => [...prev, message]);
        onChanged?.(true);
    }, []);

    return { messages, partnerName, isBlockedByMe, isBlockedByPartner, setIsBlockedByMe, reload, addPending };
}
