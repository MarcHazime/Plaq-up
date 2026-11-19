import { prisma } from '../db';
import { createImages, Images } from './images';
import { createPrismaImagesStore } from './prismaStore';
import { storageFromEnv } from './r2';

export const imagesStore = createPrismaImagesStore(prisma);

let instance: Images | undefined;

/** Built on first use, so the environment is loaded by then. */
export function images(): Images {
    return (instance ??= createImages({ storage: storageFromEnv(), store: imagesStore }));
}

/** Fails at startup, not at the first upload, when R2 is half configured. */
export function assertImagesConfigured() {
    const storage = storageFromEnv();
    if (!storage) console.warn('[images] R2 is not configured: image uploads are disabled');
}

/** Hourly sweep of images that never got a message. */
export function startImageSweeper(intervalMs = 3600 * 1000) {
    const timer = setInterval(() => {
        images().sweepOrphans().then(
            n => n && console.log(`[images] removed ${n} orphan image(s)`),
            error => console.error('[images] sweep failed:', error)
        );
    }, intervalMs);
    timer.unref();
}
