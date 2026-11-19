import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage } from './types';

export interface R2Options {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region?: string;
}

/** Cloudflare R2 through its S3-compatible API. */
export class R2Storage implements ObjectStorage {
    private client: S3Client;
    private bucket: string;

    constructor(options: R2Options) {
        this.bucket = options.bucket;
        this.client = new S3Client({
            region: options.region ?? 'auto',
            endpoint: options.endpoint,
            forcePathStyle: true, // https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
            credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
        });
    }

    async put(key: string, body: Buffer, contentType: string) {
        await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    }

    async remove(keys: string[]) {
        if (!keys.length) return;
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } }));
    }

    signedUrl(key: string, ttlSeconds: number) {
        return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
    }
}

const NAMES = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

/**
 * null when no R2 variable is set (images are then refused). A partial setup is an error:
 * it would otherwise only show up as uploads that fail.
 */
export function storageFromEnv(env: Record<string, string | undefined> = process.env): ObjectStorage | null {
    const present = NAMES.filter(n => env[n]);
    if (present.length === 0) return null;
    if (present.length < NAMES.length) {
        throw new Error(`Incomplete R2 configuration, missing: ${NAMES.filter(n => !env[n]).join(', ')}`);
    }
    return new R2Storage({
        endpoint: env.R2_ENDPOINT!,
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
        bucket: env.R2_BUCKET!,
        region: env.R2_REGION || 'auto',
    });
}
