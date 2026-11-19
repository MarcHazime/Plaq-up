"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModeration = createModeration;
const types_1 = require("./types");
const DAY_MS = 24 * 3600 * 1000;
const CONTEXT_SIZE = 10;
const MAX_REPORTS_PER_DAY = 10;
const NOTE_MAX = 500;
function createModeration({ store, now = () => new Date() }) {
    const clean = (note) => (note ?? '').trim().slice(0, NOTE_MAX) || null;
    return {
        async report({ reporterId, messageId, reason, note }) {
            if (!types_1.REPORT_REASONS.includes(reason))
                return { ok: false, reason: 'invalid_reason' };
            const message = await store.getMessage(messageId);
            if (!message)
                return { ok: false, reason: 'message_not_found' };
            if (message.receiverId !== reporterId)
                return { ok: false, reason: 'not_recipient' };
            if (await store.findOpenReport(reporterId, messageId))
                return { ok: false, reason: 'duplicate' };
            const at = now();
            if ((await store.countReportsBySince(reporterId, new Date(at.getTime() - DAY_MS))) >= MAX_REPORTS_PER_DAY) {
                return { ok: false, reason: 'too_many' };
            }
            const context = await store.conversationContext(message.senderId, message.receiverId, message.createdAt, message.id, CONTEXT_SIZE);
            const record = await store.createReport({
                createdAt: at,
                reporterId,
                reportedId: message.senderId,
                messageId,
                reason,
                note: clean(note),
                snapshot: {
                    message: { id: message.id, senderId: message.senderId, content: message.content, imageUrl: message.imageUrl, createdAt: message.createdAt },
                    context,
                    reporter: message.receiver,
                    reported: message.sender,
                },
            });
            return { ok: true, reportId: record.id };
        },
        listReports: status => store.listReports(status, 200),
        async dismissReport(reportId, note) {
            const report = await store.getReport(reportId);
            if (!report)
                return { ok: false, reason: 'not_found' };
            if (report.status !== 'open')
                return { ok: false, reason: 'already_decided' };
            await store.decideReport(reportId, 'dismissed', now(), clean(note));
            return { ok: true };
        },
        async suspendFromReport(reportId, note) {
            const report = await store.getReport(reportId);
            if (!report)
                return { ok: false, reason: 'not_found' };
            if (report.status !== 'open')
                return { ok: false, reason: 'already_decided' };
            if (!report.reportedId)
                return { ok: false, reason: 'no_reported_user' };
            const target = await store.getUser(report.reportedId);
            if (!target)
                return { ok: false, reason: 'no_reported_user' };
            if (target.isAdmin)
                return { ok: false, reason: 'is_admin' };
            const at = now();
            await store.setSuspended(target.id, at);
            await store.closeOpenReportsAgainst(target.id, 'suspended', at, clean(note));
            return { ok: true };
        },
        async suspendUser(userId) {
            const user = await store.getUser(userId);
            if (!user)
                return { ok: false, reason: 'not_found' };
            if (user.isAdmin)
                return { ok: false, reason: 'is_admin' };
            await store.setSuspended(userId, now());
            return { ok: true };
        },
        async unsuspendUser(userId) {
            if (!(await store.getUser(userId)))
                return { ok: false, reason: 'not_found' };
            await store.setSuspended(userId, null);
            return { ok: true };
        },
        async searchUsers(plateQuery) {
            if (!plateQuery.replace(/[^A-Za-z0-9]/g, ''))
                return [];
            return store.searchUsersByPlate(plateQuery, 20);
        },
        stats() {
            const at = now();
            return store.counts(new Date(at.getTime() - DAY_MS), new Date(at.getTime() - 7 * DAY_MS));
        },
    };
}
