import * as Plate from '../domain/plate';

export type PseudoResult =
    | { ok: true; value: string | null }
    | { ok: false; reason: 'length' | 'characters' | 'looks_like_plate' | 'reserved' };

const RESERVED = /plaq|admin|support|moderat|modéra/i;

/** Cleans a pseudo. An empty one removes it (value null). */
export function normalizePseudo(raw: string | null | undefined): PseudoResult {
    const value = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (!value) return { ok: true, value: null };
    if (value.length < 2 || value.length > 20) return { ok: false, reason: 'length' };
    if (!/^[\p{L}\p{N} _.\-]+$/u.test(value)) return { ok: false, reason: 'characters' };
    if (Plate.parse(value)) return { ok: false, reason: 'looks_like_plate' };
    if (RESERVED.test(value)) return { ok: false, reason: 'reserved' };
    return { ok: true, value };
}

/** What other Users see: the pseudo if there is one, otherwise the Plate. */
export const displayName = (pseudo: string | null | undefined, plate: string | null | undefined) =>
    pseudo || plate || 'Inconnu';

export const PSEUDO_MESSAGES = {
    length: 'Le pseudo doit contenir entre 2 et 20 caractères',
    characters: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, points, tirets et underscores',
    looks_like_plate: "Le pseudo ne peut pas ressembler à une plaque d'immatriculation",
    reserved: 'Ce pseudo est réservé',
} as const;
