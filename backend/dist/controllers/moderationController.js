"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetSuspension = exports.adminSearchUsers = exports.adminSuspendFromReport = exports.adminDismissReport = exports.adminListReports = exports.adminStats = exports.reportMessage = void 0;
const moderation_1 = require("../moderation");
const serverError = (res, error) => {
    console.error(error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
};
const REPORT_ERRORS = {
    invalid_reason: [400, 'Motif invalide'],
    message_not_found: [404, 'Message introuvable'],
    not_recipient: [403, 'Vous ne pouvez signaler que les messages que vous avez reçus'],
    duplicate: [409, 'Vous avez déjà signalé ce message'],
    too_many: [429, 'Trop de signalements aujourd\'hui, réessayez demain'],
};
const DECISION_ERRORS = {
    not_found: [404, 'Signalement introuvable'],
    already_decided: [409, 'Ce signalement a déjà été traité'],
    no_reported_user: [409, 'Le compte signalé n\'existe plus'],
    is_admin: [403, 'Un administrateur ne peut pas être suspendu'],
};
const USER_ERRORS = {
    not_found: [404, 'Utilisateur introuvable'],
    is_admin: [403, 'Un administrateur ne peut pas être suspendu'],
};
// --- Reporting (any signed-in User) ---
const reportMessage = async (req, res) => {
    try {
        const { messageId, reason, note } = req.body;
        const result = await moderation_1.moderation.report({
            reporterId: req.userId,
            messageId: typeof messageId === 'string' ? messageId : '',
            reason,
            note: typeof note === 'string' ? note : null,
        });
        if (!result.ok) {
            const [status, error] = REPORT_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.status(201).json({ message: 'Signalement envoyé. Merci.', reportId: result.reportId });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.reportMessage = reportMessage;
// --- Administration (administrators only) ---
const adminStats = async (_req, res) => {
    try {
        res.json(await moderation_1.moderation.stats());
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminStats = adminStats;
const adminListReports = async (req, res) => {
    try {
        const status = ['open', 'dismissed', 'suspended', 'all'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
        res.json(await moderation_1.moderation.listReports(status));
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminListReports = adminListReports;
const adminDismissReport = async (req, res) => {
    try {
        const result = await moderation_1.moderation.dismissReport(req.params.id, req.body?.note);
        if (!result.ok) {
            const [status, error] = DECISION_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminDismissReport = adminDismissReport;
const adminSuspendFromReport = async (req, res) => {
    try {
        const result = await moderation_1.moderation.suspendFromReport(req.params.id, req.body?.note);
        if (!result.ok) {
            const [status, error] = DECISION_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminSuspendFromReport = adminSuspendFromReport;
const adminSearchUsers = async (req, res) => {
    try {
        res.json(await moderation_1.moderation.searchUsers(typeof req.query.plate === 'string' ? req.query.plate : ''));
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminSearchUsers = adminSearchUsers;
const adminSetSuspension = (suspend) => async (req, res) => {
    try {
        const result = suspend ? await moderation_1.moderation.suspendUser(req.params.id) : await moderation_1.moderation.unsuspendUser(req.params.id);
        if (!result.ok) {
            const [status, error] = USER_ERRORS[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ ok: true });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.adminSetSuspension = adminSetSuspension;
