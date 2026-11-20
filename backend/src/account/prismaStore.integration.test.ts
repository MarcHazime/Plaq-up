import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createAccount, Account } from './account';
import { createPrismaAccountStore } from './prismaStore';

// Runs only against a throwaway database (see chat/prismaStore.integration.test.ts).
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Account on Postgres', () => {
    let prisma: PrismaClient;
    let account: Account;

    beforeAll(async () => {
        prisma = new PrismaClient({ datasources: { db: { url } } });
        account = createAccount({
            store: createPrismaAccountStore(prisma),
            mailer: { send: async () => {} },
            hasher: { hash: async p => `h:${p}`, compare: async (p, h) => h === `h:${p}` },
        });
        await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    beforeEach(async () => {
        await prisma.message.deleteMany();
        await prisma.conversation.deleteMany();
        await prisma.block.deleteMany();
        await prisma.vehicle.deleteMany();
        await prisma.user.deleteMany();
    });

    it('registers, verifies, logs in and stores the pseudo', async () => {
        const r = await account.register({ plate: 'AB-123-CD', password: 'password1', email: 'me@x.fr', acceptTerms: true });
        if (!r.ok) throw new Error(r.reason);
        const code = (await prisma.user.findUniqueOrThrow({ where: { id: r.userId } })).verificationToken!;

        expect(await account.verifyEmail(r.userId, code)).toMatchObject({ ok: true });
        expect(await account.login({ plate: 'AB-123-CD', password: 'password1' })).toMatchObject({ ok: true, userId: r.userId });

        await account.updateSettings(r.userId, { pseudo: 'Zoé', acceptNewContacts: false });
        const user = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
        expect([user.pseudo, user.acceptNewContacts]).toEqual(['Zoé', false]);
    });

    it('replaces an unverified account on a new registration', async () => {
        await account.register({ plate: 'AB-123-CD', password: 'password1', email: 'me@x.fr', acceptTerms: true });
        const again = await account.register({ plate: 'AB-123-CD', password: 'password2', email: 'me@x.fr', acceptTerms: true });
        expect(again.ok).toBe(true);
        expect(await prisma.user.count()).toBe(1);
        expect(await prisma.vehicle.count()).toBe(1);
    });

    it('deletes the account with its vehicles, messages in both directions, blocks and conversations', async () => {
        const mk = async (plate: string, email: string) => {
            const r = await account.register({ plate, password: 'password1', email, acceptTerms: true });
            if (!r.ok) throw new Error(r.reason);
            return r.userId;
        };
        const a = await mk('AA-111-AA', 'a@x.fr');
        const b = await mk('BB-222-BB', 'b@x.fr');
        await prisma.message.createMany({ data: [
            { senderId: a, receiverId: b, content: 'out' },
            { senderId: b, receiverId: a, content: 'in' },
        ] });
        await prisma.block.create({ data: { blockerId: b, blockedId: a } });
        await prisma.conversation.create({ data: { userAId: a < b ? a : b, userBId: a < b ? b : a, openedById: a } });

        await account.deleteAccount(a);

        expect(await prisma.user.findUnique({ where: { id: a } })).toBeNull();
        expect(await prisma.vehicle.count({ where: { userId: a } })).toBe(0);
        expect(await prisma.message.count()).toBe(0);
        expect(await prisma.block.count()).toBe(0);
        expect(await prisma.conversation.count()).toBe(0);
        expect(await prisma.user.findUnique({ where: { id: b } })).not.toBeNull();
    });
});
