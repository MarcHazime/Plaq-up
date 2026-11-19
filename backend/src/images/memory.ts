import type { ImageRecord, ImagesStore, NewImage, ObjectStorage } from './types';

/** In-memory bucket: the second adapter that makes the seam real, and the one tests use. */
export class MemoryStorage implements ObjectStorage {
    objects = new Map<string, { body: Buffer; contentType: string }>();
    failNextPut = false;

    async put(key: string, body: Buffer, contentType: string) {
        if (this.failNextPut) {
            this.failNextPut = false;
            throw new Error('bucket unavailable');
        }
        this.objects.set(key, { body, contentType });
    }

    async remove(keys: string[]) {
        for (const key of keys) this.objects.delete(key);
    }

    async signedUrl(key: string, ttlSeconds: number) {
        return `https://bucket.test/${key}?ttl=${ttlSeconds}`;
    }
}

export class MemoryImagesStore implements ImagesStore {
    images: ImageRecord[] = [];
    /** Image ids that a Message points to. */
    attached = new Set<string>();
    private nextId = 1;

    async countByOwnerSince(ownerId: string, since: Date) {
        return this.images.filter(i => i.ownerId === ownerId && i.createdAt >= since).length;
    }

    async countSince(since: Date) {
        return this.images.filter(i => i.createdAt >= since).length;
    }

    async totals() {
        return { count: this.images.length, bytes: this.images.reduce((sum, i) => sum + i.bytes, 0) };
    }

    async create(image: NewImage) {
        const record = { ...image, id: `img${this.nextId++}` };
        this.images.push(record);
        return record;
    }

    async find(id: string) {
        return this.images.find(i => i.id === id) ?? null;
    }

    async findMany(ids: string[]) {
        return this.images.filter(i => ids.includes(i.id));
    }

    async orphansBefore(before: Date, limit: number) {
        return this.images.filter(i => !this.attached.has(i.id) && i.createdAt < before).slice(0, limit);
    }

    async deleteMany(ids: string[]) {
        this.images = this.images.filter(i => !ids.includes(i.id));
        for (const id of ids) this.attached.delete(id);
    }
}
