import { describe, it, expect } from 'vitest';
import { normalizePseudo, displayName } from './pseudo';

describe('normalizePseudo', () => {
    it('trims and collapses spaces', () => {
        expect(normalizePseudo('  Jean   Paul ')).toEqual({ ok: true, value: 'Jean Paul' });
    });
    it('treats empty as removing the pseudo', () => {
        expect(normalizePseudo('   ')).toEqual({ ok: true, value: null });
        expect(normalizePseudo(null)).toEqual({ ok: true, value: null });
    });
    it('accepts accents and common separators', () => {
        expect(normalizePseudo('Éloïse_92')).toEqual({ ok: true, value: 'Éloïse_92' });
    });
    it('enforces the length', () => {
        expect(normalizePseudo('a')).toEqual({ ok: false, reason: 'length' });
        expect(normalizePseudo('a'.repeat(21))).toEqual({ ok: false, reason: 'length' });
    });
    it('rejects symbols and addresses', () => {
        expect(normalizePseudo('me@x.fr')).toEqual({ ok: false, reason: 'characters' });
        expect(normalizePseudo('<b>hi</b>')).toEqual({ ok: false, reason: 'characters' });
    });
    it('rejects anything that parses as a plate, whatever the format', () => {
        expect(normalizePseudo('AB-123-CD')).toEqual({ ok: false, reason: 'looks_like_plate' });
        expect(normalizePseudo('ab123cd')).toEqual({ ok: false, reason: 'looks_like_plate' });
    });
    it('rejects names that pass for the service or its staff', () => {
        expect(normalizePseudo("Plaq'Up")).toMatchObject({ ok: false });
        expect(normalizePseudo('Support')).toEqual({ ok: false, reason: 'reserved' });
        expect(normalizePseudo('administrateur')).toEqual({ ok: false, reason: 'reserved' });
    });
});

describe('displayName', () => {
    it('prefers the pseudo, then the plate', () => {
        expect(displayName('Zoé', 'AA-111-AA')).toBe('Zoé');
        expect(displayName(null, 'AA-111-AA')).toBe('AA-111-AA');
        expect(displayName(null, null)).toBe('Inconnu');
    });
});
