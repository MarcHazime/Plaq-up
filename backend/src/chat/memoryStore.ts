import type { ConversationMessage, MyVehicle } from '../domain/conversations';
import type { ChatStore, ChatUser, NewMessage, OpenedConversation, StoredMessage } from './types';

interface SeedUser extends Partial<ChatUser> {
    id: string;
    pseudo?: string | null;
    plates?: string[]; // first one is the primary vehicle
}

/** In-memory ChatStore: the second adapter that makes the seam real, and the one tests use. */
export class MemoryChatStore implements ChatStore {
    private users = new Map<string, SeedUser>();
    private blocks: { blockerId: string; blockedId: string }[] = [];
    private opened: OpenedConversation[] = [];
    private messages: StoredMessage[] = [];
    private images = new Map<string, { ownerId: string | null; attached: boolean }>();
    private nextId = 1;

    addUser(user: SeedUser) {
        this.users.set(user.id, user);
    }

    addBlock(blockerId: string, blockedId: string) {
        this.blocks.push({ blockerId, blockedId });
    }

    /** Messages that existed before opened conversations were recorded. */
    addLegacyMessage(message: NewMessage) {
        this.messages.push(this.toStored(message));
    }

    addImage(id: string, ownerId: string | null) {
        this.images.set(id, { ownerId, attached: false });
    }

    openedRecords() {
        return [...this.opened];
    }

    private pair(a: string, b: string): [string, string] {
        return a < b ? [a, b] : [b, a];
    }

    private toStored(message: NewMessage): StoredMessage {
        return { ...message, imageUrl: null, id: `m${this.nextId++}`, isRead: false, deletedBySender: false, deletedByReceiver: false };
    }

    async getUser(id: string): Promise<ChatUser | null> {
        const u = this.users.get(id);
        if (!u) return null;
        return { id, suspended: u.suspended ?? false, acceptNewContacts: u.acceptNewContacts ?? true, pushToken: u.pushToken ?? null };
    }

    async isBlocked(a: string, b: string) {
        return this.blocks.some(x => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
    }

    async findOpened(a: string, b: string) {
        const [userAId, userBId] = this.pair(a, b);
        return this.opened.find(o => o.userAId === userAId && o.userBId === userBId) ?? null;
    }

    async saveOpened(conversation: OpenedConversation) {
        const existing = await this.findOpened(conversation.userAId, conversation.userBId);
        if (!existing) this.opened.push({ ...conversation });
    }

    async firstMessageBetween(a: string, b: string) {
        const first = this.messages
            .filter(m => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())[0];
        return first ? { senderId: first.senderId, createdAt: first.createdAt } : null;
    }

    async countOpened(userId: string) {
        return this.opened.filter(o => o.userAId === userId || o.userBId === userId).length;
    }

    async countOpenedBySince(userId: string, since: Date) {
        return this.opened.filter(o => o.openedById === userId && o.openedAt >= since).length;
    }

    async findImage(id: string) {
        return this.images.get(id) ?? null;
    }

    async createMessage(message: NewMessage) {
        const stored = this.toStored(message);
        if (message.imageId) this.images.get(message.imageId)!.attached = true;
        this.messages.push(stored);
        return stored;
    }

    async messagesBetween(a: string, b: string) {
        return this.messages
            .filter(m => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    }

    async conversationMessages(userId: string): Promise<ConversationMessage[]> {
        const party = (id: string) => {
            const u = this.users.get(id);
            return { id, pseudo: u?.pseudo ?? null, vehicles: u?.plates?.[0] ? [{ plate: u.plates[0] }] : [] };
        };
        return this.messages
            .filter(m => m.senderId === userId || m.receiverId === userId)
            .map(m => ({ ...m, sender: party(m.senderId), receiver: party(m.receiverId) }));
    }

    async vehicles(userId: string): Promise<MyVehicle[]> {
        return (this.users.get(userId)?.plates ?? []).map((plate, i) => ({ plate, isPrimary: i === 0 }));
    }

    async markRead(userId: string, partnerId: string) {
        for (const m of this.messages) if (m.receiverId === userId && m.senderId === partnerId) m.isRead = true;
    }

    async markDeleted(userId: string, partnerId: string) {
        for (const m of this.messages) {
            if (m.senderId === userId && m.receiverId === partnerId) m.deletedBySender = true;
            if (m.senderId === partnerId && m.receiverId === userId) m.deletedByReceiver = true;
        }
    }
}
