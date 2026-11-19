import { describe, it, expect } from 'vitest';
import { createImages } from './images';
import { MemoryImagesStore, MemoryStorage } from './memory';
import { detectImage } from './detect';
import type { ImagesConfig } from './types';

const HOUR = 3600 * 1000;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(50)]);

function setup(config: Partial<ImagesConfig> = {}, storage: MemoryStorage | null = new MemoryStorage()) {
    const store = new MemoryImagesStore();
    let current = new Date('2026-03-15T10:00:00Z');
    const images = createImages({ storage, store, now: () => current, config });
    return { images, store, storage, advance: (ms: number) => { current = new Date(current.getTime() + ms); }, now: () => current };
}

describe('detectImage', () => {
    it('recognises jpeg, png and webp from their first bytes', () => {
        expect(detectImage(JPEG)).toMatchObject({ contentType: 'image/jpeg', extension: 'jpg' });
        expect(detectImage(PNG)).toMatchObject({ contentType: 'image/png' });
        expect(detectImage(WEBP)).toMatchObject({ contentType: 'image/webp' });
    });
    it('rejects anything else, whatever its name', () => {
        expect(detectImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
        expect(detectImage(Buffer.from('GIF89a'))).toBeNull();
        expect(detectImage(Buffer.from('#!/bin/sh\nrm -rf /'))).toBeNull();
        expect(detectImage(Buffer.alloc(0))).toBeNull();
        expect(detectImage(Buffer.from('RIFF....WAVE'))).toBeNull();
    });
});

describe('upload', () => {
    it('stores the file under an unguessable key and records it', async () => {
        const { images, store, storage } = setup();
        const r = await images.upload({ ownerId: 'me', data: JPEG });
        expect(r.ok).toBe(true);
        expect(store.images).toHaveLength(1);
        const [rec] = store.images;
        expect(rec).toMatchObject({ ownerId: 'me', bytes: JPEG.length, contentType: 'image/jpeg' });
        expect(rec.key).toMatch(/^[0-9a-f-]{36}\.jpg$/);
        expect(storage!.objects.get(rec.key)!.body.equals(JPEG)).toBe(true);
    });

    it('refuses files that are too large, without storing anything', async () => {
        const { images, store, storage } = setup({ maxBytes: 150 });
        expect(await images.upload({ ownerId: 'me', data: Buffer.concat([JPEG, Buffer.alloc(100)]) })).toEqual({ ok: false, reason: 'too_large' });
        expect(store.images).toHaveLength(0);
        expect(storage!.objects.size).toBe(0);
    });

    it('refuses anything that is not a jpeg, png or webp', async () => {
        const { images } = setup();
        expect(await images.upload({ ownerId: 'me', data: Buffer.from('<svg/>') })).toEqual({ ok: false, reason: 'unsupported_type' });
    });

    it('limits uploads per user per day, then frees after 24 hours', async () => {
        const { images, advance } = setup({ perUserPerDay: 2 });
        expect((await images.upload({ ownerId: 'me', data: JPEG })).ok).toBe(true);
        expect((await images.upload({ ownerId: 'me', data: PNG })).ok).toBe(true);
        expect(await images.upload({ ownerId: 'me', data: JPEG })).toEqual({ ok: false, reason: 'user_daily_limit' });
        expect((await images.upload({ ownerId: 'other', data: JPEG })).ok).toBe(true); // another user is unaffected
        advance(25 * HOUR);
        expect((await images.upload({ ownerId: 'me', data: JPEG })).ok).toBe(true);
    });

    it('stops accepting images when the bucket would pass the global ceiling', async () => {
        const { images } = setup({ globalBytes: JPEG.length * 2 + 10, perUserPerDay: 99 });
        expect((await images.upload({ ownerId: 'a', data: JPEG })).ok).toBe(true);
        expect((await images.upload({ ownerId: 'b', data: JPEG })).ok).toBe(true);
        expect(await images.upload({ ownerId: 'c', data: JPEG })).toEqual({ ok: false, reason: 'storage_full' });
    });

    it('stops at the monthly write budget and starts again next month', async () => {
        const { images, advance } = setup({ monthlyUploads: 2, perUserPerDay: 99 });
        await images.upload({ ownerId: 'a', data: JPEG });
        await images.upload({ ownerId: 'b', data: JPEG });
        expect(await images.upload({ ownerId: 'c', data: JPEG })).toEqual({ ok: false, reason: 'monthly_limit' });
        advance(20 * 24 * HOUR); // into April
        expect((await images.upload({ ownerId: 'c', data: JPEG })).ok).toBe(true);
    });

    it('reports the bucket as unavailable when it is not configured', async () => {
        const { images } = setup({}, null);
        expect(await images.upload({ ownerId: 'me', data: JPEG })).toEqual({ ok: false, reason: 'storage_unavailable' });
    });

    it('leaves no record behind when the bucket refuses the file', async () => {
        const { images, store, storage } = setup();
        storage!.failNextPut = true;
        await expect(images.upload({ ownerId: 'me', data: JPEG })).rejects.toThrow();
        expect(store.images).toHaveLength(0);
    });

    it('removes the stored file when recording it fails', async () => {
        const { images, store, storage } = setup();
        store.create = async () => { throw new Error('db down'); };
        await expect(images.upload({ ownerId: 'me', data: JPEG })).rejects.toThrow();
        expect(storage!.objects.size).toBe(0);
    });
});

describe('links', () => {
    it('gives each image a link that lasts the configured time', async () => {
        const { images } = setup({ urlTtlSeconds: 3600 });
        const r = await images.upload({ ownerId: 'me', data: JPEG });
        if (!r.ok) throw new Error();
        expect(await images.urlFor(r.imageId)).toMatch(/\?ttl=3600$/);
        expect(await images.urlFor('ghost')).toBeNull();
    });

    it('adds links to the messages that carry an image, and only those', async () => {
        const { images } = setup();
        const r = await images.upload({ ownerId: 'me', data: JPEG });
        if (!r.ok) throw new Error();
        const out = await images.present('viewer', [
            { id: 'm1', content: 'text', imageId: null, imageUrl: null },
            { id: 'm2', content: '', imageId: r.imageId, imageUrl: null },
        ]);
        expect(out[0].imageUrl).toBeNull();
        expect(out[1].imageUrl).toMatch(/^https:\/\/bucket\.test\//);
    });

    it('caps the links handed to one viewer per hour, and renews the allowance', async () => {
        const { images, advance } = setup({ urlsPerUserPerHour: 3 });
        const r = await images.upload({ ownerId: 'me', data: JPEG });
        if (!r.ok) throw new Error();
        const msgs = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, imageId: r.imageId, imageUrl: null as string | null }));

        const first = await images.present('viewer', msgs);
        expect(first.filter(m => m.imageUrl).length).toBe(3);
        expect((await images.present('viewer', msgs)).filter(m => m.imageUrl).length).toBe(0);
        // another viewer has their own allowance
        expect((await images.present('someone-else', msgs)).filter(m => m.imageUrl).length).toBe(3);

        advance(61 * 60 * 1000);
        expect((await images.present('viewer', msgs)).filter(m => m.imageUrl).length).toBe(3);
    });

    it('keeps an old-style relative imageUrl untouched when there is no imageId', async () => {
        const { images } = setup();
        const [m] = await images.present('v', [{ id: 'm', imageId: null, imageUrl: '/uploads/old.jpg' }]);
        expect(m.imageUrl).toBe('/uploads/old.jpg');
    });
});

describe('sweepOrphans', () => {
    it('deletes images never attached to a message once they are a day old, file and record', async () => {
        const { images, store, storage, advance } = setup({ perUserPerDay: 99 });
        const keep = await images.upload({ ownerId: 'me', data: JPEG });
        const drop = await images.upload({ ownerId: 'me', data: PNG });
        if (!keep.ok || !drop.ok) throw new Error();
        store.attached.add(keep.imageId);

        advance(2 * HOUR);
        expect(await images.sweepOrphans()).toBe(0); // too recent
        advance(25 * HOUR);
        expect(await images.sweepOrphans()).toBe(1);

        expect(store.images.map(i => i.id)).toEqual([keep.imageId]);
        expect(storage!.objects.size).toBe(1);
    });

    it('does nothing without a bucket', async () => {
        const { images } = setup({}, null);
        expect(await images.sweepOrphans()).toBe(0);
    });
});

describe('stats', () => {
    it('reports how many images and bytes are stored', async () => {
        const { images } = setup();
        await images.upload({ ownerId: 'me', data: JPEG });
        await images.upload({ ownerId: 'me', data: PNG });
        expect(await images.stats()).toEqual({ images: 2, imageBytes: JPEG.length + PNG.length });
    });
});
