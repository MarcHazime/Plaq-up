export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

/** The one password rule. Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: unknown): string | null {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`;
    }
    if (Buffer.byteLength(password) > MAX_PASSWORD_LENGTH) {
        return 'Le mot de passe est trop long (72 caractères maximum)';
    }
    return null;
}
