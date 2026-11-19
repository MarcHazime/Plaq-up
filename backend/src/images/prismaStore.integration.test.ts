import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createImages, Images } from './images';
import { createPrismaImagesStore } from './prismaStore';
import { MemoryStorage } from './memory';
import { createChat, Chat } from '../chat/chat';
import { createPrismaChatStore } from '../chat/prismaStore';
import { createAccount } from '../account/account';
import { createPrismaAccountStore } from '../account/prismaStore';

// Runs only against a throwaway database (see chat/prismaStore.integration.test.ts).
const url = process.env.TEST_DATABASE_URL;
const HOUR = 3600 * 1000;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);

describe.skipIf(!url)('Images on Postgres', () => {
    let prisma: PrismaClient;
    let images: Images;
    let chat: Chat;
    let storage: MemoryStorage;
    let clock: Date;

    const makeUser = (id: string) =>
        prisma.user.create({ data: { id, password: 'x', email: `${id}@x.fr`, isVerified: true, vehicles: { create: { plate: `${id.toUpperCase()}-PLATE`, isPrimary: true } } } });

    beforeAll(async () => {
        prisma = new PrismaClient({ datasources: { db: { url } } });
        await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    beforeEach(async () => {
        await prisma.report.deleteMany();
        await prisma.message.deleteMany();
        await prisma.image.deleteMany();
        await prisma.conversation.deleteMany();
        await prisma.vehicle.deleteMany();
        await prisma.user.deleteMany();
        await Promise.all(['a', 'b'].map(makeUser));

        storage = new MemoryStorage();
        clock = new Date();
        images = createImages({ storage, store: createPrismaImagesStore(prisma), now: () => clock });
        chat = createChat({ store: createPrismaChatStore(prisma), now: () => clock });
    });

    const upload = async (ownerId: string) => {
        const r = await images.upload({ ownerId, data: JPEG });
        if (!r.ok) throw new Error(r.reason);
        return r.imageId;
    };

    it('sends an uploaded image once and gives both sides a link in the history', async () => {
        const imageId = await upload('a');
        const sent = await chat.send({ senderId: 'a', receiverId: 'b', content: '', imageId });
        expect(sent.ok).toBe(true);
        expect(await chat.send({ senderId: 'a', receiverId: 'b', content: '', imageId })).toEqual({ ok: false, reason: 'invalid_image' });

        for (const viewer of ['a', 'b']) {
            const partner = viewer === 'a' ? 'b' : 'a';
            const [m] = await images.present(viewer, await chat.history(viewer, partner));
            expect(m.imageUrl).toMatch(/^https:\/\/bucket\.test\//);
        }
    });

    it('refuses to send someone else\'s image', async () => {
        const imageId = await upload('b');
        expect(await chat.send({ senderId: 'a', receiverId: 'b', content: 'mine', imageId })).toEqual({ ok: false, reason: 'invalid_image' });
    });

    it('keeps sent images and sweeps the ones never sent', async () => {
        const sentId = await upload('a');
        await chat.send({ senderId: 'a', receiverId: 'b', content: '', imageId: sentId });
        const unsentId = await upload('a');

        clock = new Date(clock.getTime() + 25 * HOUR);
        expect(await images.sweepOrphans()).toBe(1);
        expect(await prisma.image.findUnique({ where: { id: unsentId } })).toBeNull();
        expect(await prisma.image.findUnique({ where: { id: sentId } })).not.toBeNull();
        expect(storage.objects.size).toBe(1);
    });

    it('sweeps the files of a deleted account: its messages go, so its images become orphans', async () => {
        const imageId = await upload('a');
        await chat.send({ senderId: 'a', receiverId: 'b', content: '', imageId });

        const accounts = createAccount({
            store: createPrismaAccountStore(prisma),
            mailer: { send: async () => {} },
            hasher: { hash: async p => p, compare: async (p, h) => p === h },
        });
        await accounts.deleteAccount('a');

        const row = await prisma.image.findUnique({ where: { id: imageId } });
        expect(row).not.toBeNull();       // the record survives the user...
        expect(row!.ownerId).toBeNull();  // ...detached from them

        clock = new Date(clock.getTime() + 25 * HOUR);
        expect(await images.sweepOrphans()).toBe(1); // ...and the next sweep removes record and file
        expect(storage.objects.size).toBe(0);
    });

    it('counts images and bytes', async () => {
        await upload('a');
        await upload('b');
        expect(await images.stats()).toEqual({ images: 2, imageBytes: JPEG.length * 2 });
    });
});
