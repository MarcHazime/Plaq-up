import jwt from 'jsonwebtoken';

const TOKEN_LIFETIME = '30d';

function secret(): string {
    const value = process.env.JWT_SECRET;
    if (!value) throw new Error('JWT_SECRET is not set');
    return value;
}

export function signToken(userId: string): string {
    return jwt.sign({ sub: userId }, secret(), { expiresIn: TOKEN_LIFETIME });
}

/** Returns the user id carried by a valid token, or null if the token is missing, invalid or expired. */
export function verifyToken(token: string | undefined): string | null {
    if (!token) return null;
    try {
        const payload = jwt.verify(token, secret());
        return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
        return null;
    }
}

export function assertAuthConfigured(): void {
    secret();
}
