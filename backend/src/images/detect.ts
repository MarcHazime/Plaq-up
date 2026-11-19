export type DetectedImage = { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; extension: 'jpg' | 'png' | 'webp' };

/** Identifies an image from its first bytes. The filename and declared type are never trusted. */
export function detectImage(data: Buffer): DetectedImage | null {
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
        return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { contentType: 'image/png', extension: 'png' };
    }
    if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { contentType: 'image/webp', extension: 'webp' };
    }
    return null;
}
