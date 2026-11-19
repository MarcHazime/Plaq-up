import { Request, Response } from 'express';
import { moderation } from '../moderation';
import { images } from '../images';
import type { AuthedRequest } from '../auth/middleware';

const serverError = (res: Response, error: unknown) => {
    console.error(error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
};

const REPORT_ERRORS = {
    invalid_reason: [400, 'Motif invalide'],
    message_not_found: [404, 'Message introuvable'],
    not_recipient: [403, 'Vous ne pouvez signaler que les messages que vous avez reçus'],
    duplicate: [409, 'Vous avez déjà signalé ce message'],
    too_many: [429, 'Trop de signalements aujourd\'hui, réessayez demain'],
} as const;

const DECISION_ERRORS = {
    not_found: [404, 'Signalement introuvable'],
    already_decided: [409, 'Ce signalement a déjà été traité'],
    no_reported_user: [409, 'Le compte signalé n\'existe plus'],
    is_admin: [403, 'Un administrateur ne peut pas être suspendu'],
} as const;

const USER_ERRORS = {
    not_found: [404, 'Utilisateur introuvable'],
    is_admin: [403, 'Un administrateur ne peut pas être suspendu'],
} as const;

// --- Reporting (any signed-in User) ---

export const reportMessage = async (req: Request, res: Response) => {
    try {
        const { messageId, reason, note } = req.body;
        const result = await moderation.report({
            reporterId: (req as AuthedRequest).userId!,
            messageId: typeof messageId === 'string' ? messageId : '',
            reason,
            note: typeof note === 'string' ? note : null,
        });

        if (!result.ok) {
            const [status, error] = REPORT_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.status(201).json({ message: 'Signalement envoyé. Merci.', reportId: result.reportId });
    } catch (error) {
        serverError(res, error);
    }
};

// --- Administration (administrators only) ---

export const adminStats = async (_req: Request, res: Response) => {
    try {
        res.json({ ...(await moderation.stats()), ...(await images().stats()) });
    } catch (error) {
        serverError(res, error);
    }
};

export const adminListReports = async (req: Request, res: Response) => {
    try {
        const status = ['open', 'dismissed', 'suspended', 'all'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
        const reports = await moderation.listReports(status as 'open' | 'dismissed' | 'suspended' | 'all');
        // Administrators get a fresh link to a reported image, if it still exists.
        res.json(await Promise.all(reports.map(async r => ({
            ...r,
            imageUrl: r.snapshot.message.imageId ? await images().urlFor(r.snapshot.message.imageId) : null,
        }))));
    } catch (error) {
        serverError(res, error);
    }
};

export const adminDismissReport = async (req: Request, res: Response) => {
    try {
        const result = await moderation.dismissReport(req.params.id, req.body?.note);
        if (!result.ok) {
            const [status, error] = DECISION_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    } catch (error) {
        serverError(res, error);
    }
};

export const adminSuspendFromReport = async (req: Request, res: Response) => {
    try {
        const result = await moderation.suspendFromReport(req.params.id, req.body?.note);
        if (!result.ok) {
            const [status, error] = DECISION_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    } catch (error) {
        serverError(res, error);
    }
};

export const adminSearchUsers = async (req: Request, res: Response) => {
    try {
        res.json(await moderation.searchUsers(typeof req.query.plate === 'string' ? req.query.plate : ''));
    } catch (error) {
        serverError(res, error);
    }
};

export const adminSetSuspension = (suspend: boolean) => async (req: Request, res: Response) => {
    try {
        const result = suspend ? await moderation.suspendUser(req.params.id) : await moderation.unsuspendUser(req.params.id);
        if (!result.ok) {
            const [status, error] = USER_ERRORS[result.reason as keyof typeof USER_ERRORS];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    } catch (error) {
        serverError(res, error);
    }
};
