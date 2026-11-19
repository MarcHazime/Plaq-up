import { describe, it, expect } from 'vitest';
import { passwordProblem } from './password';

describe('passwordProblem', () => {
    it('accepts a password of 8 characters or more', () => {
        expect(passwordProblem('12345678')).toBeNull();
        expect(passwordProblem('Laddition2026')).toBeNull();
    });
    it('rejects short, missing and non-string passwords', () => {
        expect(passwordProblem('1234567')).toMatch(/8 caractères/);
        expect(passwordProblem('')).not.toBeNull();
        expect(passwordProblem(undefined)).not.toBeNull();
        expect(passwordProblem(12345678)).not.toBeNull();
    });
    it('rejects passwords bcrypt would truncate', () => {
        expect(passwordProblem('a'.repeat(73))).toMatch(/trop long/);
        expect(passwordProblem('a'.repeat(72))).toBeNull();
    });
});
