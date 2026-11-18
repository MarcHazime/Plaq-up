export interface ConversationPartner {
    id: string;
    email: string | null;
    vehicles: { plate: string }[]; // primary vehicle only
}

export interface ConversationMessage {
    senderId: string;
    receiverId: string;
    content: string | null;
    relatedPlate: string | null;
    isRead: boolean;
    deletedBySender: boolean;
    deletedByReceiver: boolean;
    createdAt: Date;
    sender: ConversationPartner;
    receiver: ConversationPartner;
}

export interface MyVehicle {
    plate: string;
    isPrimary: boolean;
}

export interface Conversation {
    id: string;
    partnerId: string;
    email: string | null;
    relatedPlate: string;
    lastMessage: string | null;
    timestamp: Date;
    myScope: string;
    otherDisplay: string;
    unreadCount: number;
}

/**
 * One Conversation per pair of Users. The plate on the latest Message is kept as context.
 * Messages the user has deleted on their side are ignored. Result is ordered latest first.
 */
export function buildConversations(
    userId: string,
    messages: ConversationMessage[],
    myVehicles: MyVehicle[]
): Conversation[] {
    const myPlates = new Set(myVehicles.map(v => v.plate));
    const myPrimary = myVehicles.find(v => v.isPrimary)?.plate || myVehicles[0]?.plate || 'Unknown';

    const visible = messages
        .filter(m => (m.senderId === userId ? !m.deletedBySender : !m.deletedByReceiver))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const conversations = new Map<string, Conversation>();

    for (const msg of visible) {
        const isSender = msg.senderId === userId;
        const partner = isSender ? msg.receiver : msg.sender;
        let conversation = conversations.get(partner.id);

        if (!conversation) {
            const plate = msg.relatedPlate || 'Unknown';
            const isMyPlate = myPlates.has(plate);
            conversation = {
                id: partner.id,
                partnerId: partner.id,
                email: partner.email,
                relatedPlate: plate,
                lastMessage: msg.content,
                timestamp: msg.createdAt,
                // My plate in the subject -> that plate; otherwise I speak with my primary.
                myScope: isMyPlate ? plate : myPrimary,
                // My plate in the subject -> show their primary; otherwise show the subject.
                otherDisplay: isMyPlate ? partner.vehicles[0]?.plate || 'Inconnu' : plate,
                unreadCount: 0,
            };
            conversations.set(partner.id, conversation);
        }

        if (!isSender && !msg.isRead) {
            conversation.unreadCount += 1;
        }
    }

    return Array.from(conversations.values());
}
