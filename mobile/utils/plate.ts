/**
 * Plate: a French SIV license plate, canonical form `AA-123-BB`.
 *
 * Keep in sync with mobile/utils/plate.ts. Both are tested against
 * shared/plate-vectors.json. This is the only place a plate pattern may live.
 */

const SIV = /^([A-Z]{2})(\d{3})([A-Z]{2})$/;
const SIV_IN_TEXT = /(?:^|[^A-Z0-9])([A-Z]{2})[- ]?(\d{3})[- ]?([A-Z]{2})(?![A-Z0-9])/;

/** Uppercase and strip everything that is not a letter or digit. */
export const normalize = (input: string): string =>
    input.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Canonical `AA-123-BB` for any spelling of a valid plate, else null. */
export const parse = (input: string): string | null => {
    const m = SIV.exec(normalize(input));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

export const isValid = (input: string): boolean => parse(input) !== null;

/** Progressive display formatting while typing (partial input allowed). */
export const format = (input: string): string => {
    const clean = normalize(input);
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 7)}`;
};

/** Extract the first plate from raw OCR text (line by line), or null. */
export const fromOcr = (text: string): string | null => {
    for (const line of text.split(/\r?\n/)) {
        const cleaned = line.toUpperCase().replace(/[^A-Z0-9\- ]/g, '');
        const m = SIV_IN_TEXT.exec(cleaned);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return null;
};

/** Normalized plate, safe to put in a URL path or query. */
export const forUrl = (input: string): string => encodeURIComponent(normalize(input));
