"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuards = createGuards;
/**
 * Guards that look at the account behind a valid token. A token outlives a Suspension,
 * so the state is read on each request rather than trusted from the token.
 */
function createGuards(lookup) {
    const deny = (res, status, error, code) => res.status(status).json({ error, code });
    /** Use after requireAuth: refuses suspended and deleted accounts. */
    const requireActive = async (req, res, next) => {
        try {
            const state = req.userId ? await lookup(req.userId) : null;
            if (!state)
                return deny(res, 401, 'Authentification requise');
            if (state.suspended)
                return deny(res, 403, 'Votre compte est suspendu.', 'ACCOUNT_SUSPENDED');
            next();
        }
        catch (error) {
            console.error('Guard lookup failed:', error);
            deny(res, 500, 'Erreur interne du serveur');
        }
    };
    /** Use after requireAuth: only active administrators. */
    const requireAdmin = async (req, res, next) => {
        try {
            const state = req.userId ? await lookup(req.userId) : null;
            if (!state)
                return deny(res, 401, 'Authentification requise');
            if (state.suspended || !state.isAdmin)
                return deny(res, 403, 'Accès interdit');
            next();
        }
        catch (error) {
            console.error('Guard lookup failed:', error);
            deny(res, 500, 'Erreur interne du serveur');
        }
    };
    return { requireActive, requireAdmin };
}
