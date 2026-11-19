import { NextFunction, Response } from 'express';
import type { AuthedRequest } from './middleware';

export interface AccountState {
    suspended: boolean;
    isAdmin: boolean;
}

export type AccountLookup = (userId: string) => Promise<AccountState | null>;

/**
 * Guards that look at the account behind a valid token. A token outlives a Suspension,
 * so the state is read on each request rather than trusted from the token.
 */
export function createGuards(lookup: AccountLookup) {
    const deny = (res: Response, status: number, error: string, code?: string) => res.status(status).json({ error, code });

    /** Use after requireAuth: refuses suspended and deleted accounts. */
    const requireActive = async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const state = req.userId ? await lookup(req.userId) : null;
            if (!state) return deny(res, 401, 'Authentification requise');
            if (state.suspended) return deny(res, 403, 'Votre compte est suspendu.', 'ACCOUNT_SUSPENDED');
            next();
        } catch (error) {
            console.error('Guard lookup failed:', error);
            deny(res, 500, 'Erreur interne du serveur');
        }
    };

    /** Use after requireAuth: only active administrators. */
    const requireAdmin = async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const state = req.userId ? await lookup(req.userId) : null;
            if (!state) return deny(res, 401, 'Authentification requise');
            if (state.suspended || !state.isAdmin) return deny(res, 403, 'Accès interdit');
            next();
        } catch (error) {
            console.error('Guard lookup failed:', error);
            deny(res, 500, 'Erreur interne du serveur');
        }
    };

    return { requireActive, requireAdmin };
}
