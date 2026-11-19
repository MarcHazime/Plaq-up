import { Server, Socket } from 'socket.io';
import { sendPushNotification } from './services/notificationService';
import { authenticateSocket } from './auth/middleware';
import { chatWith, DenyReason } from './chat';
import { lookupAccount } from './auth';

const DENIED: Record<DenyReason, string> = {
    empty: 'Message vide',
    self: 'Vous ne pouvez pas vous écrire à vous-même',
    unknown_receiver: 'Destinataire introuvable',
    unknown_sender: 'Compte introuvable',
    sender_suspended: 'Votre compte est suspendu',
    blocked: 'Utilisateur bloqué',
    receiver_closed: "Cet utilisateur n'accepte pas de nouvelles conversations",
    daily_limit: "Limite quotidienne de nouvelles conversations atteinte, réessayez demain",
    quota_reached: "Limite de conversations atteinte",
};

export const setupSocket = (io: Server) => {
    io.use(authenticateSocket);
    // A suspended account gets no live connection either.
    io.use(async (socket, next) => {
        const state = await lookupAccount(socket.data.userId).catch(() => null);
        next(state && !state.suspended ? undefined : new Error('Accès refusé'));
    });

    const chat = chatWith({
        async messageSent(message, receiver) {
            if (receiver.pushToken) {
                await sendPushNotification(receiver.pushToken, `Nouveau message: ${message.content}`, {
                    senderId: message.senderId,
                    messageId: message.id,
                });
            }
        },
    });

    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        const userId: string = socket.data.userId;

        socket.on('join_chat', (room: string) => {
            // Rooms are named `<idA>_<idB>`; only a participant may join.
            if (typeof room !== 'string' || !room.split('_').includes(userId)) return;
            socket.join(room);
            console.log(`User ${socket.id} joined room ${room}`);
        });

        socket.on('send_message', async (data: { receiverId: string; content: string; tempId?: string; imageUrl?: string; relatedPlate?: string }) => {
            const { receiverId, content, tempId, imageUrl, relatedPlate } = data;

            try {
                // identity comes from the token, never from the payload
                const result = await chat.send({ senderId: userId, receiverId, content, imageUrl, relatedPlate });

                if (!result.ok) {
                    socket.emit('message_error', { tempId, reason: result.reason, error: DENIED[result.reason] });
                    return;
                }

                // The tempId lets the sender's app swap its optimistic message for the saved one.
                const room = [userId, receiverId].sort().join('_');
                io.to(room).emit('receive_message', { ...result.message, tempId });
                if (result.quota.level !== 'ok') socket.emit('quota_warning', result.quota);
            } catch (error) {
                console.error('Error saving message:', error);
                socket.emit('message_error', { tempId, reason: 'server', error: 'Erreur du serveur' });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};
