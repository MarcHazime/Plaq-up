/** The seam between the Images module and the bucket that holds the files. */
export interface ObjectStorage {
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    remove(keys: string[]): Promise<void>;
    /** A link that works for `ttlSeconds`. Computed locally, no request to the bucket. */
    signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

export interface ImageRecord {
    id: string;
    key: string;
    ownerId: string | null;
    bytes: number;
    contentType: string;
    createdAt: Date;
}

export type NewImage = Omit<ImageRecord, 'id'>;

/** The seam between the Images module and the database. */
export interface ImagesStore {
    countByOwnerSince(ownerId: string, since: Date): Promise<number>;
    countSince(since: Date): Promise<number>;
    totals(): Promise<{ count: number; bytes: number }>;
    create(image: NewImage): Promise<ImageRecord>;
    find(id: string): Promise<ImageRecord | null>;
    findMany(ids: string[]): Promise<ImageRecord[]>;
    /** Images with no Message that are older than `before`. */
    orphansBefore(before: Date, limit: number): Promise<ImageRecord[]>;
    deleteMany(ids: string[]): Promise<void>;
}

export interface ImagesConfig {
    maxBytes: number;
    /** Uploads per user per rolling 24 hours. */
    perUserPerDay: number;
    /** Ceiling on the bytes held in the bucket, kept under the free tier. */
    globalBytes: number;
    /** Uploads per calendar month across all users, kept under the free write operations. */
    monthlyUploads: number;
    /** How long a read link stays valid. */
    urlTtlSeconds: number;
    /** Read links handed to one user per rolling hour. */
    urlsPerUserPerHour: number;
    /** An Image never attached to a Message is deleted after this long. */
    orphanAfterMs: number;
}

export type UploadResult =
    | { ok: true; imageId: string }
    | { ok: false; reason: 'storage_unavailable' | 'too_large' | 'unsupported_type' | 'user_daily_limit' | 'storage_full' | 'monthly_limit' };
