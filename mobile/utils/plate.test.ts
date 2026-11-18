import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import * as Plate from './plate';

const v = JSON.parse(readFileSync(resolve(__dirname, '../../shared/plate-vectors.json'), 'utf8'));

describe('Plate', () => {
    it.each<any>(v.valid)('valid: $input', ({ input, normalized, parsed }: any) => {
        expect(Plate.normalize(input)).toBe(normalized);
        expect(Plate.parse(input)).toBe(parsed);
        expect(Plate.isValid(input)).toBe(true);
    });
    it.each<any>(v.invalid.map((i: string) => [i]))('invalid: %j', (input: string) => {
        expect(Plate.parse(input)).toBeNull();
        expect(Plate.isValid(input)).toBe(false);
    });
    it.each<any>(v.format)('format: $input', ({ input, expected }: any) => {
        expect(Plate.format(input)).toBe(expected);
    });
    it.each<any>(v.ocr)('fromOcr: $text', ({ text, expected }: any) => {
        expect(Plate.fromOcr(text)).toBe(expected);
    });
    it.each<any>(v.url)('forUrl: $input', ({ input, expected }: any) => {
        expect(Plate.forUrl(input)).toBe(expected);
    });
});
