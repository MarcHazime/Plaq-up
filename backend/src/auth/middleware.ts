import { NextFunction, Request, Response } from 'express';
import { verifyToken } from './token';

export interface AuthedRequest extends Request {
    userId?: string;
}

const unauthorized = (res: Response) => res.status(401).json({ error: 'Authentification requise' });
const forbidden = (res: Response) => res.status(403).json({ error: 'Accès interdit' });

function bearer(req: Request): string | undefined {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Rejects requests without a valid token and exposes the caller as `req.userId`. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const userId = verifyToken(bearer(req));
    if (!userId) return unauthorized(res);
    req.userId = userId;
    next();
}

/** The authenticated user must be the one named by the route parameter. */
export const requireSelf = (param: string) => (req: AuthedRequest, res: Response, next: NextFunction) =>
    req.userId === req.params[param] ? next() : forbidden(res);

/** The authenticated user must be the one named by a body field. */
export const requireSelfInBody = (field: string) => (req: AuthedRequest, res: Response, next: NextFunction) =>
    req.userId === req.body?.[field] ? next() : forbidden(res);

/** The authenticated user must be one of the users named by the route parameters. */
export const requireParty = (...params: string[]) => (req: AuthedRequest, res: Response, next: NextFunction) =>
    params.some(p => req.params[p] === req.userId) ? next() : forbidden(res);

interface HandshakeSocket {
    handshake: { auth?: { token?: string } };
    data: { userId?: string };
}

/** socket.io middleware: authenticates the handshake and stores the user id in `socket.data`. */
export function authenticateSocket(socket: HandshakeSocket, next: (err?: Error) => void) {
    const userId = verifyToken(socket.handshake.auth?.token);
    if (!userId) return next(new Error('Authentification requise'));
    socket.data.userId = userId;
    next();
}
