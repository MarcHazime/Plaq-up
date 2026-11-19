"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryChatStore = void 0;
/** In-memory ChatStore: the second adapter that makes the seam real, and the one tests use. */
class MemoryChatStore {
    constructor() {
        this.users = new Map();
        this.blocks = [];
        this.opened = [];
        this.messages = [];
        this.nextId = 1;
    }
    addUser(user) {
        this.users.set(user.id, user);
    }
    addBlock(blockerId, blockedId) {
        this.blocks.push({ blockerId, blockedId });
    }
    /** Messages that existed before opened conversations were recorded. */
    addLegacyMessage(message) {
        this.messages.push(this.toStored(message));
    }
    openedRecords() {
        return [...this.opened];
    }
    pair(a, b) {
        return a < b ? [a, b] : [b, a];
    }
    toStored(message) {
        return { ...message, id: `m${this.nextId++}`, isRead: false, deletedBySender: false, deletedByReceiver: false };
    }
    async getUser(id) {
        const u = this.users.get(id);
        if (!u)
            return null;
        return { id, suspended: u.suspended ?? false, acceptNewContacts: u.acceptNewContacts ?? true, pushToken: u.pushToken ?? null };
    }
    async isBlocked(a, b) {
        return this.blocks.some(x => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
    }
    async findOpened(a, b) {
        const [userAId, userBId] = this.pair(a, b);
        return this.opened.find(o => o.userAId === userAId && o.userBId === userBId) ?? null;
    }
    async saveOpened(conversation) {
        const existing = await this.findOpened(conversation.userAId, conversation.userBId);
        if (!existing)
            this.opened.push({ ...conversation });
    }
    async firstMessageBetween(a, b) {
        const first = this.messages
            .filter(m => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())[0];
        return first ? { senderId: first.senderId, createdAt: first.createdAt } : null;
    }
    async countOpened(userId) {
        return this.opened.filter(o => o.userAId === userId || o.userBId === userId).length;
    }
    async countOpenedBySince(userId, since) {
        return this.opened.filter(o => o.openedById === userId && o.openedAt >= since).length;
    }
    async createMessage(message) {
        const stored = this.toStored(message);
        this.messages.push(stored);
        return stored;
    }
    async messagesBetween(a, b) {
        return this.messages
            .filter(m => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    }
    async conversationMessages(userId) {
        const party = (id) => {
            const u = this.users.get(id);
            return { id, pseudo: u?.pseudo ?? null, vehicles: u?.plates?.[0] ? [{ plate: u.plates[0] }] : [] };
        };
        return this.messages
            .filter(m => m.senderId === userId || m.receiverId === userId)
            .map(m => ({ ...m, sender: party(m.senderId), receiver: party(m.receiverId) }));
    }
    async vehicles(userId) {
        return (this.users.get(userId)?.plates ?? []).map((plate, i) => ({ plate, isPrimary: i === 0 }));
    }
    async markRead(userId, partnerId) {
        for (const m of this.messages)
            if (m.receiverId === userId && m.senderId === partnerId)
                m.isRead = true;
    }
    async markDeleted(userId, partnerId) {
        for (const m of this.messages) {
            if (m.senderId === userId && m.receiverId === partnerId)
                m.deletedBySender = true;
            if (m.senderId === partnerId && m.receiverId === userId)
                m.deletedByReceiver = true;
        }
    }
}
exports.MemoryChatStore = MemoryChatStore;
