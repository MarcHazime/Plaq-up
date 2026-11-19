"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = void 0;
const notificationService_1 = require("./services/notificationService");
const middleware_1 = require("./auth/middleware");
const chat_1 = require("./chat");
const auth_1 = require("./auth");
const DENIED = {
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
const setupSocket = (io) => {
    io.use(middleware_1.authenticateSocket);
    // A suspended account gets no live connection either.
    io.use(async (socket, next) => {
        const state = await (0, auth_1.lookupAccount)(socket.data.userId).catch(() => null);
        next(state && !state.suspended ? undefined : new Error('Accès refusé'));
    });
    const chat = (0, chat_1.chatWith)({
        async messageSent(message, receiver) {
            if (receiver.pushToken) {
                await (0, notificationService_1.sendPushNotification)(receiver.pushToken, `Nouveau message: ${message.content}`, {
                    senderId: message.senderId,
                    messageId: message.id,
                });
            }
        },
    });
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        const userId = socket.data.userId;
        socket.on('join_chat', (room) => {
            // Rooms are named `<idA>_<idB>`; only a participant may join.
            if (typeof room !== 'string' || !room.split('_').includes(userId))
                return;
            socket.join(room);
            console.log(`User ${socket.id} joined room ${room}`);
        });
        socket.on('send_message', async (data) => {
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
                if (result.quota.level !== 'ok')
                    socket.emit('quota_warning', result.quota);
            }
            catch (error) {
                console.error('Error saving message:', error);
                socket.emit('message_error', { tempId, reason: 'server', error: 'Erreur du serveur' });
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};
exports.setupSocket = setupSocket;
