import { describe, it, expect } from 'vitest';
import { R2Storage, storageFromEnv } from './r2';

const env = { R2_ENDPOINT: 'https://acc.eu.r2.cloudflarestorage.com', R2_ACCESS_KEY_ID: 'AKIA', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'plaqup-images' };

describe('storageFromEnv', () => {
    it('is disabled when no R2 variable is set', () => {
        expect(storageFromEnv({})).toBeNull();
    });
    it('builds the R2 adapter from a full configuration', () => {
        expect(storageFromEnv(env)).toBeInstanceOf(R2Storage);
    });
    it('refuses a partial configuration and names what is missing', () => {
        expect(() => storageFromEnv({ R2_ENDPOINT: env.R2_ENDPOINT, R2_BUCKET: env.R2_BUCKET })).toThrow(/R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/);
    });
});

describe('R2Storage.signedUrl', () => {
    it('signs a read link locally for the right bucket, key and lifetime', async () => {
        const url = new URL(await storageFromEnv(env)!.signedUrl('abc.jpg', 3600));
        expect(url.hostname).toContain('r2.cloudflarestorage.com');
        expect(url.pathname).toContain('plaqup-images');
        expect(url.pathname).toContain('abc.jpg');
        expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
        expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
        expect(url.toString()).not.toContain('secret');
    });
});
