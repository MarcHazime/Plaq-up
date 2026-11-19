import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createModeration, Moderation } from './moderation';
import { createPrismaModerationStore } from './prismaStore';
import { createAccount } from '../account/account';
import { createPrismaAccountStore } from '../account/prismaStore';

// Runs only against a throwaway database (see chat/prismaStore.integration.test.ts).
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Moderation on Postgres', () => {
    let prisma: PrismaClient;
    let moderation: Moderation;

    const makeUser = (id: string, plate: string, extra: Record<string, unknown> = {}) =>
        prisma.user.create({
            data: { id, password: 'x', email: `${id}@x.fr`, isVerified: true, ...extra, vehicles: { create: { plate, isPrimary: true } } },
        });

    beforeAll(async () => {
        prisma = new PrismaClient({ datasources: { db: { url } } });
        moderation = createModeration({ store: createPrismaModerationStore(prisma) });
        await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    beforeEach(async () => {
        await prisma.report.deleteMany();
        await prisma.message.deleteMany();
        await prisma.conversation.deleteMany();
        await prisma.block.deleteMany();
        await prisma.vehicle.deleteMany();
        await prisma.user.deleteMany();
        await makeUser('me', 'AA-111-AA');
        await makeUser('bob', 'BB-222-BB', { pseudo: 'Bobby' });
        await makeUser('boss', 'ZZ-000-ZZ', { isAdmin: true });
    });

    const send = (senderId: string, receiverId: string, content: string, minutesAgo: number) =>
        prisma.message.create({ data: { senderId, receiverId, content, createdAt: new Date(Date.now() - minutesAgo * 60000) } });

    it('files a report with a frozen snapshot, then suspends from it', async () => {
        await send('me', 'bob', 'hello', 30);
        const bad = await send('bob', 'me', 'you idiot', 20);

        const r = await moderation.report({ reporterId: 'me', messageId: bad.id, reason: 'harassment' });
        if (!r.ok) throw new Error(r.reason);

        const [report] = await moderation.listReports('open');
        expect(report.snapshot.message.content).toBe('you idiot');
        expect(report.snapshot.context.map(c => c.content)).toEqual(['hello']);
        expect(report.snapshot.reported).toMatchObject({ id: 'bob', pseudo: 'Bobby', plates: ['BB-222-BB'] });
        expect(report.snapshot.message.createdAt).toBeInstanceOf(Date);

        expect(await moderation.suspendFromReport(r.reportId)).toEqual({ ok: true });
        expect((await prisma.user.findUniqueOrThrow({ where: { id: 'bob' } })).suspendedAt).not.toBeNull();
        expect((await moderation.listReports('open'))).toHaveLength(0);
        expect((await moderation.listReports('suspended'))).toHaveLength(1);
        expect(await moderation.unsuspendUser('bob')).toEqual({ ok: true });
        expect((await prisma.user.findUniqueOrThrow({ where: { id: 'bob' } })).suspendedAt).toBeNull();
    });

    it('keeps the report, with its evidence, when the reported account is deleted', async () => {
        const bad = await send('bob', 'me', 'you idiot', 5);
        await moderation.report({ reporterId: 'me', messageId: bad.id, reason: 'spam' });

        const accounts = createAccount({
            store: createPrismaAccountStore(prisma),
            mailer: { send: async () => {} },
            hasher: { hash: async p => p, compare: async (p, h) => p === h },
        });
        await accounts.deleteAccount('bob');

        const [report] = await moderation.listReports('open');
        expect(report.reportedId).toBeNull();
        expect(report.snapshot.message.content).toBe('you idiot');
        expect(await moderation.suspendFromReport(report.id)).toEqual({ ok: false, reason: 'no_reported_user' });
        expect(await moderation.dismissReport(report.id)).toEqual({ ok: true });
    });

    it('finds users by plate without dashes and refuses to suspend an administrator', async () => {
        expect((await moderation.searchUsers('bb222')).map(u => u.id)).toEqual(['bob']);
        expect((await moderation.searchUsers('2BB')).map(u => u.id)).toEqual(['bob']);
        expect(await moderation.suspendUser('boss')).toEqual({ ok: false, reason: 'is_admin' });
    });

    it('counts users, messages and open reports', async () => {
        const m = await send('bob', 'me', 'x', 1);
        await moderation.report({ reporterId: 'me', messageId: m.id, reason: 'other' });
        expect(await moderation.stats()).toMatchObject({ users: 3, verifiedUsers: 3, messages: 1, messagesLast24h: 1, openReports: 1 });
    });
});
