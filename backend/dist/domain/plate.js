"use strict";
/**
 * Plate: a French SIV license plate, canonical form `AA-123-BB`.
 *
 * Keep in sync with mobile/utils/plate.ts. Both are tested against
 * shared/plate-vectors.json. This is the only place a plate pattern may live.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.forUrl = exports.fromOcr = exports.format = exports.isValid = exports.parse = exports.normalize = void 0;
const SIV = /^([A-Z]{2})(\d{3})([A-Z]{2})$/;
const SIV_IN_TEXT = /(?:^|[^A-Z0-9])([A-Z]{2})[- ]?(\d{3})[- ]?([A-Z]{2})(?![A-Z0-9])/;
/** Uppercase and strip everything that is not a letter or digit. */
const normalize = (input) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
exports.normalize = normalize;
/** Canonical `AA-123-BB` for any spelling of a valid plate, else null. */
const parse = (input) => {
    const m = SIV.exec((0, exports.normalize)(input));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
exports.parse = parse;
const isValid = (input) => (0, exports.parse)(input) !== null;
exports.isValid = isValid;
/** Progressive display formatting while typing (partial input allowed). */
const format = (input) => {
    const clean = (0, exports.normalize)(input);
    if (clean.length <= 2)
        return clean;
    if (clean.length <= 5)
        return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 7)}`;
};
exports.format = format;
/** Extract the first plate from raw OCR text (line by line), or null. */
const fromOcr = (text) => {
    for (const line of text.split(/\r?\n/)) {
        const cleaned = line.toUpperCase().replace(/[^A-Z0-9\- ]/g, '');
        const m = SIV_IN_TEXT.exec(cleaned);
        if (m)
            return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return null;
};
exports.fromOcr = fromOcr;
/** Normalized plate, safe to put in a URL path or query. */
const forUrl = (input) => encodeURIComponent((0, exports.normalize)(input));
exports.forUrl = forUrl;
