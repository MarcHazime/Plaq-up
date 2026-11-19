import type { PrismaClient } from '@prisma/client';
import type { ChatStore } from './types';

const primaryPlate = { vehicles: { where: { isPrimary: true }, select: { plate: true } } };
const party = { select: { id: true, pseudo: true, ...primaryPlate } };

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export function createPrismaChatStore(prisma: PrismaClient): ChatStore {
    const between = (a: string, b: string) => ({
        OR: [
            { senderId: a, receiverId: b },
            { senderId: b, receiverId: a },
        ],
    });

    return {
        async getUser(id) {
            const u = await prisma.user.findUnique({
                where: { id },
                select: { id: true, suspendedAt: true, acceptNewContacts: true, pushToken: true },
            });
            return u && { id: u.id, suspended: u.suspendedAt !== null, acceptNewContacts: u.acceptNewContacts, pushToken: u.pushToken };
        },

        async isBlocked(a, b) {
            const block = await prisma.block.findFirst({
                where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
            });
            return block !== null;
        },

        async findOpened(a, b) {
            const [userAId, userBId] = pair(a, b);
            const row = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
            return row && { userAId: row.userAId, userBId: row.userBId, openedById: row.openedById, openedAt: row.openedAt };
        },

        async saveOpened(c) {
            await prisma.conversation.upsert({
                where: { userAId_userBId: { userAId: c.userAId, userBId: c.userBId } },
                update: {},
                create: { userAId: c.userAId, userBId: c.userBId, openedById: c.openedById, openedAt: c.openedAt },
            });
        },

        async firstMessageBetween(a, b) {
            const m = await prisma.message.findFirst({
                where: between(a, b),
                orderBy: { createdAt: 'asc' },
                select: { senderId: true, createdAt: true },
            });
            return m;
        },

        countOpened: userId =>
            prisma.conversation.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),

        countOpenedBySince: (userId, since) =>
            prisma.conversation.count({ where: { openedById: userId, openedAt: { gte: since } } }),

        createMessage: message => prisma.message.create({ data: message }),

        messagesBetween: (a, b) => prisma.message.findMany({ where: between(a, b), orderBy: { createdAt: 'asc' } }),

        conversationMessages: userId =>
            prisma.message.findMany({
                where: {
                    OR: [
                        { senderId: userId, deletedBySender: false },
                        { receiverId: userId, deletedByReceiver: false },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                include: { sender: party, receiver: party },
            }),

        vehicles: userId => prisma.vehicle.findMany({ where: { userId }, select: { plate: true, isPrimary: true } }),

        async markRead(userId, partnerId) {
            await prisma.message.updateMany({
                where: { receiverId: userId, senderId: partnerId, isRead: false },
                data: { isRead: true },
            });
        },

        async markDeleted(userId, partnerId) {
            await prisma.message.updateMany({ where: { senderId: userId, receiverId: partnerId }, data: { deletedBySender: true } });
            await prisma.message.updateMany({ where: { senderId: partnerId, receiverId: userId }, data: { deletedByReceiver: true } });
        },
    };
}
