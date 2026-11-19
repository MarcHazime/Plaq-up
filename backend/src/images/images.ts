import { randomUUID } from 'crypto';
import { detectImage } from './detect';
import type { ImagesConfig, ImagesStore, ObjectStorage, UploadResult } from './types';

export const DEFAULT_CONFIG: ImagesConfig = {
    maxBytes: 2 * 1024 * 1024,
    perUserPerDay: 20,
    globalBytes: 8 * 1024 ** 3,
    monthlyUploads: 500_000,
    urlTtlSeconds: 3600,
    urlsPerUserPerHour: 300,
    orphanAfterMs: 24 * 3600 * 1000,
};

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface Images {
    /** Checks the file and the limits, stores it in the bucket and records it. */
    upload(input: { ownerId: string; data: Buffer }): Promise<UploadResult>;
    /** A fresh read link for one image, or null when it no longer exists. Not rate limited: for the server's own use. */
    urlFor(imageId: string): Promise<string | null>;
    /**
     * Adds a read link to each message that carries an image. Only call it for a viewer
     * who is a participant of the Conversation. The links given to one viewer are capped per hour.
     */
    present<T extends { imageId?: string | null; imageUrl?: string | null }>(viewerId: string, messages: T[]): Promise<T[]>;
    /** Deletes images that never got a Message. Returns how many were removed. */
    sweepOrphans(): Promise<number>;
    stats(): Promise<{ images: number; imageBytes: number }>;
}

export interface ImagesDeps {
    /** null when the bucket is not configured: uploads are then refused. */
    storage: ObjectStorage | null;
    store: ImagesStore;
    now?: () => Date;
    config?: Partial<ImagesConfig>;
}

export function createImages({ storage, store, now = () => new Date(), config = {} }: ImagesDeps): Images {
    const cfg: ImagesConfig = { ...DEFAULT_CONFIG, ...config };
    const linkLog = new Map<string, number[]>(); // viewer -> timestamps of links given in the last hour

    const urlFor = async (imageId: string) => {
        if (!storage) return null;
        const image = await store.find(imageId);
        return image ? storage.signedUrl(image.key, cfg.urlTtlSeconds) : null;
    };

    return {
        async upload({ ownerId, data }) {
            if (!storage) return { ok: false, reason: 'storage_unavailable' };
            if (data.length > cfg.maxBytes) return { ok: false, reason: 'too_large' };

            const type = detectImage(data);
            if (!type) return { ok: false, reason: 'unsupported_type' };

            const at = now();
            if ((await store.countByOwnerSince(ownerId, new Date(at.getTime() - DAY_MS))) >= cfg.perUserPerDay) {
                return { ok: false, reason: 'user_daily_limit' };
            }
            if ((await store.totals()).bytes + data.length > cfg.globalBytes) return { ok: false, reason: 'storage_full' };

            const monthStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
            if ((await store.countSince(monthStart)) >= cfg.monthlyUploads) return { ok: false, reason: 'monthly_limit' };

            const key = `${randomUUID()}.${type.extension}`;
            await storage.put(key, data, type.contentType);
            try {
                const record = await store.create({ key, ownerId, bytes: data.length, contentType: type.contentType, createdAt: at });
                return { ok: true, imageId: record.id };
            } catch (error) {
                await storage.remove([key]).catch(() => {}); // no file without a record
                throw error;
            }
        },

        urlFor,

        async present(viewerId, messages) {
            const ids = [...new Set(messages.map(m => m.imageId).filter((id): id is string => !!id))];
            if (!ids.length || !storage) return messages;

            const records = new Map((await store.findMany(ids)).map(r => [r.id, r]));
            const at = now().getTime();
            const recent = (linkLog.get(viewerId) ?? []).filter(t => t > at - HOUR_MS);
            const signed = new Map<string, string>();

            const out: typeof messages = [];
            for (const m of messages) {
                const record = m.imageId ? records.get(m.imageId) : undefined;
                if (!m.imageId) {
                    out.push(m); // text, or an old-style image path
                } else if (!record || recent.length >= cfg.urlsPerUserPerHour) {
                    out.push({ ...m, imageUrl: null });
                } else {
                    if (!signed.has(record.id)) signed.set(record.id, await storage.signedUrl(record.key, cfg.urlTtlSeconds));
                    recent.push(at);
                    out.push({ ...m, imageUrl: signed.get(record.id)! });
                }
            }
            linkLog.set(viewerId, recent);
            return out;
        },

        async sweepOrphans() {
            if (!storage) return 0;
            const orphans = await store.orphansBefore(new Date(now().getTime() - cfg.orphanAfterMs), 500);
            if (!orphans.length) return 0;

            await storage.remove(orphans.map(o => o.key));
            await store.deleteMany(orphans.map(o => o.id));
            return orphans.length;
        },

        async stats() {
            const totals = await store.totals();
            return { images: totals.count, imageBytes: totals.bytes };
        },
    };
}
