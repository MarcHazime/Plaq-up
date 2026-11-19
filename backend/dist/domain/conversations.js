"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildConversations = buildConversations;
/**
 * One Conversation per pair of Users. The plate on the latest Message is kept as context.
 * Messages the user has deleted on their side are ignored. Result is ordered latest first.
 */
function buildConversations(userId, messages, myVehicles) {
    const myPlates = new Set(myVehicles.map(v => v.plate));
    const myPrimary = myVehicles.find(v => v.isPrimary)?.plate || myVehicles[0]?.plate || 'Unknown';
    const visible = messages
        .filter(m => (m.senderId === userId ? !m.deletedBySender : !m.deletedByReceiver))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const conversations = new Map();
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
                relatedPlate: plate,
                lastMessage: msg.content,
                timestamp: msg.createdAt,
                // My plate in the subject -> that plate; otherwise I speak with my primary.
                myScope: isMyPlate ? plate : myPrimary,
                // Their pseudo if they set one. Otherwise: my plate in the subject -> their primary; else the subject.
                otherDisplay: partner.pseudo || (isMyPlate ? partner.vehicles[0]?.plate || 'Inconnu' : plate),
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
