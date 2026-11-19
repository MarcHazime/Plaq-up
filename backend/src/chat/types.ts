import type { ConversationMessage, MyVehicle } from '../domain/conversations';

export interface StoredMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    imageUrl: string | null;
    relatedPlate: string | null;
    isRead: boolean;
    deletedBySender: boolean;
    deletedByReceiver: boolean;
    createdAt: Date;
}

export interface ChatUser {
    id: string;
    suspended: boolean;
    acceptNewContacts: boolean;
    pushToken: string | null;
}

/** Durable trace of an opened Conversation. It outlives deletions: it is what the Free quota counts. */
export interface OpenedConversation {
    userAId: string;
    userBId: string;
    openedById: string;
    openedAt: Date;
}

export interface NewMessage {
    senderId: string;
    receiverId: string;
    content: string;
    imageUrl: string | null;
    relatedPlate: string | null;
    createdAt: Date;
}

/** The seam between the Chat module and its storage. */
export interface ChatStore {
    getUser(id: string): Promise<ChatUser | null>;
    /** True when either user has blocked the other. */
    isBlocked(a: string, b: string): Promise<boolean>;
    findOpened(a: string, b: string): Promise<OpenedConversation | null>;
    saveOpened(conversation: OpenedConversation): Promise<void>;
    firstMessageBetween(a: string, b: string): Promise<{ senderId: string; createdAt: Date } | null>;
    countOpened(userId: string): Promise<number>;
    countOpenedBySince(userId: string, since: Date): Promise<number>;
    createMessage(message: NewMessage): Promise<StoredMessage>;
    /** Every message between two users, in both directions, oldest first, deleted ones included. */
    messagesBetween(a: string, b: string): Promise<StoredMessage[]>;
    /** Messages involving the user, with both parties and their primary plate. */
    conversationMessages(userId: string): Promise<ConversationMessage[]>;
    vehicles(userId: string): Promise<MyVehicle[]>;
    markRead(userId: string, partnerId: string): Promise<void>;
    markDeleted(userId: string, partnerId: string): Promise<void>;
}

export type DenyReason =
    | 'empty'
    | 'self'
    | 'unknown_receiver'
    | 'unknown_sender'
    | 'sender_suspended'
    | 'blocked'
    | 'receiver_closed'
    | 'daily_limit'
    | 'quota_reached';

export type QuotaLevel = 'ok' | 'near' | 'reached';

export interface QuotaStatus {
    used: number;
    limit: number;
    level: QuotaLevel;
}

export type SendResult =
    | { ok: true; message: StoredMessage; quota: QuotaStatus }
    | { ok: false; reason: DenyReason };

export interface SendInput {
    senderId: string;
    receiverId: string;
    content?: string | null;
    imageUrl?: string | null;
    relatedPlate?: string | null;
}

export interface ChatConfig {
    /** New Conversations a user may open per rolling 24 hours. Replies and incoming ones never count. */
    dailyNewConversations: number;
    /** Free quota: Conversations a user may hold without a subscription. */
    freeQuota: number;
    /** Level at which the user is warned. */
    warnAt: number;
    /** v1 counts and warns but does not block. v1.1 turns this on. */
    enforceQuota: boolean;
}

export interface ChatEvents {
    /** Called once a message is saved: the place to emit over sockets and send push notifications. */
    messageSent?(message: StoredMessage, receiver: ChatUser): Promise<void> | void;
}
