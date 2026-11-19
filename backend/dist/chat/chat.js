"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.createChat = createChat;
const conversations_1 = require("../domain/conversations");
exports.DEFAULT_CONFIG = {
    dailyNewConversations: 5,
    freeQuota: 20,
    warnAt: 16,
    enforceQuota: false,
};
const DAY_MS = 24 * 3600 * 1000;
function createChat({ store, events = {}, now = () => new Date(), config = {} }) {
    const cfg = { ...exports.DEFAULT_CONFIG, ...config };
    const quotaStatus = (used) => ({
        used,
        limit: cfg.freeQuota,
        level: used >= cfg.freeQuota ? 'reached' : used >= cfg.warnAt ? 'near' : 'ok',
    });
    return {
        async send({ senderId, receiverId, content, imageUrl, relatedPlate }) {
            const text = (content ?? '').trim();
            if (!text && !imageUrl)
                return { ok: false, reason: 'empty' };
            if (senderId === receiverId)
                return { ok: false, reason: 'self' };
            const [sender, receiver] = await Promise.all([store.getUser(senderId), store.getUser(receiverId)]);
            if (!receiver)
                return { ok: false, reason: 'unknown_receiver' };
            if (!sender)
                return { ok: false, reason: 'unknown_sender' };
            if (sender.suspended)
                return { ok: false, reason: 'sender_suspended' };
            if (await store.isBlocked(senderId, receiverId))
                return { ok: false, reason: 'blocked' };
            const at = now();
            let opened = await store.findOpened(senderId, receiverId);
            let isNew = false;
            if (!opened) {
                // Pairs that talked before opened conversations were recorded are known, not new.
                const first = await store.firstMessageBetween(senderId, receiverId);
                isNew = !first;
                if (isNew) {
                    if (!receiver.acceptNewContacts)
                        return { ok: false, reason: 'receiver_closed' };
                    const openedToday = await store.countOpenedBySince(senderId, new Date(at.getTime() - DAY_MS));
                    if (openedToday >= cfg.dailyNewConversations)
                        return { ok: false, reason: 'daily_limit' };
                    if (cfg.enforceQuota && (await store.countOpened(senderId)) >= cfg.freeQuota) {
                        return { ok: false, reason: 'quota_reached' };
                    }
                }
                const [userAId, userBId] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
                opened = {
                    userAId,
                    userBId,
                    openedById: first ? first.senderId : senderId,
                    openedAt: first ? first.createdAt : at,
                };
                await store.saveOpened(opened);
            }
            const message = await store.createMessage({
                senderId,
                receiverId,
                content: text,
                imageUrl: imageUrl ?? null,
                relatedPlate: relatedPlate ?? null,
                createdAt: at,
            });
            await events.messageSent?.(message, receiver);
            return { ok: true, message, quota: quotaStatus(await store.countOpened(senderId)) };
        },
        async history(viewerId, partnerId) {
            const all = await store.messagesBetween(viewerId, partnerId);
            return all.filter(m => (m.senderId === viewerId ? !m.deletedBySender : !m.deletedByReceiver));
        },
        async conversations(userId) {
            const [messages, vehicles] = await Promise.all([store.conversationMessages(userId), store.vehicles(userId)]);
            return (0, conversations_1.buildConversations)(userId, messages, vehicles);
        },
        markRead: (userId, partnerId) => store.markRead(userId, partnerId),
        deleteFor: (userId, partnerId) => store.markDeleted(userId, partnerId),
        async quota(userId) {
            return quotaStatus(await store.countOpened(userId));
        },
    };
}
