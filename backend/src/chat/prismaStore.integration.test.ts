import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createChat, Chat } from './chat';
import { createPrismaChatStore } from './prismaStore';

// Runs only against a throwaway database:
//   TEST_DATABASE_URL=postgresql://localhost/plaqup_chat_test npx prisma db push && npm test
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Chat on Postgres', () => {
    let prisma: PrismaClient;
    let chat: Chat;

    const makeUser = (id: string, extra: Record<string, unknown> = {}) =>
        prisma.user.create({
            data: {
                id, password: 'x', email: `${id}@x.fr`, isVerified: true, ...extra,
                vehicles: { create: { plate: `${id.toUpperCase()}-PLATE`, isPrimary: true } },
            },
        });

    beforeAll(async () => {
        prisma = new PrismaClient({ datasources: { db: { url } } });
        chat = createChat({ store: createPrismaChatStore(prisma), config: { dailyNewConversations: 2 } });
        await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    beforeEach(async () => {
        await prisma.message.deleteMany();
        await prisma.conversation.deleteMany();
        await prisma.block.deleteMany();
        await prisma.vehicle.deleteMany();
        await prisma.user.deleteMany();
        await Promise.all(['a', 'b', 'c', 'd'].map(id => makeUser(id)));
    });

    it('sends, records the conversation once, lists and reads it', async () => {
        const r1 = await chat.send({ senderId: 'a', receiverId: 'b', content: 'hi', relatedPlate: 'B-PLATE' });
        const r2 = await chat.send({ senderId: 'b', receiverId: 'a', content: 'hello' });
        expect(r1.ok && r2.ok).toBe(true);
        expect(await prisma.conversation.count()).toBe(1);

        const [c] = await chat.conversations('a');
        expect(c.partnerId).toBe('b');
        expect(c.unreadCount).toBe(1);
        await chat.markRead('a', 'b');
        expect((await chat.conversations('a'))[0].unreadCount).toBe(0);
        expect((await chat.history('a', 'b')).map(m => m.content)).toEqual(['hi', 'hello']);
    });

    it('enforces block, suspension and the daily limit', async () => {
        await prisma.block.create({ data: { blockerId: 'b', blockedId: 'a' } });
        expect(await chat.send({ senderId: 'a', receiverId: 'b', content: 'x' })).toEqual({ ok: false, reason: 'blocked' });

        await prisma.user.update({ where: { id: 'c' }, data: { suspendedAt: new Date() } });
        expect(await chat.send({ senderId: 'c', receiverId: 'a', content: 'x' })).toEqual({ ok: false, reason: 'sender_suspended' });

        expect((await chat.send({ senderId: 'a', receiverId: 'c', content: 'x' })).ok).toBe(true);
        expect((await chat.send({ senderId: 'a', receiverId: 'd', content: 'x' })).ok).toBe(true);
        await prisma.user.create({ data: { id: 'e', password: 'x', email: 'e@x.fr' } });
        expect(await chat.send({ senderId: 'a', receiverId: 'e', content: 'x' })).toEqual({ ok: false, reason: 'daily_limit' });
    });

    it('keeps the slot after a deletion and removes everything with the user', async () => {
        await chat.send({ senderId: 'a', receiverId: 'b', content: 'x' });
        await chat.deleteFor('a', 'b');
        expect((await chat.quota('a')).used).toBe(1);
        expect(await chat.history('a', 'b')).toEqual([]);

        await prisma.message.deleteMany();
        await prisma.user.delete({ where: { id: 'a' } });
        expect(await prisma.conversation.count()).toBe(0);
    });
});
