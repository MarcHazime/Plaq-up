"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrismaModerationStore = createPrismaModerationStore;
const withPlates = { vehicles: { select: { plate: true, isPrimary: true }, orderBy: { isPrimary: 'desc' } } };
const party = (u) => ({ id: u.id, plates: u.vehicles.map(v => v.plate), pseudo: u.pseudo });
const adminUser = (u) => ({
    id: u.id,
    plates: u.vehicles.map(v => v.plate),
    pseudo: u.pseudo,
    suspended: u.suspendedAt !== null,
    isAdmin: u.isAdmin,
    verified: u.isVerified,
    createdAt: u.createdAt,
});
// The snapshot is stored as JSON, so its dates come back as strings.
const toRecord = (r) => {
    const snap = r.snapshot;
    return {
        id: r.id,
        createdAt: r.createdAt,
        reporterId: r.reporterId,
        reportedId: r.reportedId,
        messageId: r.messageId,
        reason: r.reason,
        note: r.note,
        status: r.status,
        decidedAt: r.decidedAt,
        decisionNote: r.decisionNote,
        snapshot: {
            ...snap,
            message: { ...snap.message, createdAt: new Date(snap.message.createdAt) },
            context: snap.context.map(c => ({ ...c, createdAt: new Date(c.createdAt) })),
        },
    };
};
function createPrismaModerationStore(prisma) {
    return {
        async getMessage(id) {
            const m = await prisma.message.findUnique({
                where: { id },
                include: { sender: { include: withPlates }, receiver: { include: withPlates } },
            });
            return m && {
                id: m.id, senderId: m.senderId, receiverId: m.receiverId, content: m.content,
                imageUrl: m.imageUrl, createdAt: m.createdAt, sender: party(m.sender), receiver: party(m.receiver),
            };
        },
        async conversationContext(a, b, at, exceptId, limit) {
            const rows = await prisma.message.findMany({
                where: {
                    id: { not: exceptId },
                    createdAt: { lte: at },
                    OR: [{ senderId: a, receiverId: b }, { senderId: b, receiverId: a }],
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            return rows.reverse().map(m => ({ senderId: m.senderId, content: m.content, imageUrl: m.imageUrl, createdAt: m.createdAt }));
        },
        async findOpenReport(reporterId, messageId) {
            const r = await prisma.report.findFirst({ where: { reporterId, messageId, status: 'open' } });
            return r && toRecord(r);
        },
        countReportsBySince: (reporterId, since) => prisma.report.count({ where: { reporterId, createdAt: { gte: since } } }),
        async createReport(report) {
            const r = await prisma.report.create({
                data: {
                    createdAt: report.createdAt,
                    reporterId: report.reporterId,
                    reportedId: report.reportedId,
                    messageId: report.messageId,
                    reason: report.reason,
                    note: report.note,
                    snapshot: report.snapshot,
                },
            });
            return toRecord(r);
        },
        async listReports(status, limit) {
            const rows = await prisma.report.findMany({
                where: status === 'all' ? {} : { status },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            return rows.map(toRecord);
        },
        async getReport(id) {
            const r = await prisma.report.findUnique({ where: { id } });
            return r && toRecord(r);
        },
        async decideReport(id, status, at, note) {
            await prisma.report.update({ where: { id }, data: { status, decidedAt: at, decisionNote: note } });
        },
        async closeOpenReportsAgainst(userId, status, at, note) {
            await prisma.report.updateMany({
                where: { reportedId: userId, status: 'open' },
                data: { status, decidedAt: at, decisionNote: note },
            });
        },
        async getUser(id) {
            const u = await prisma.user.findUnique({ where: { id }, include: withPlates });
            return u && adminUser(u);
        },
        async searchUsersByPlate(query, limit) {
            const q = query.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (!q)
                return [];
            // Plates are stored as AA-123-BB: compare with the dashes removed.
            const owners = await prisma.$queryRaw `
                SELECT DISTINCT "userId" FROM "Vehicle" WHERE REPLACE(plate, '-', '') LIKE ${'%' + q + '%'} LIMIT ${limit}`;
            const rows = await prisma.user.findMany({ where: { id: { in: owners.map(o => o.userId) } }, include: withPlates });
            return rows.map(adminUser);
        },
        async setSuspended(userId, at) {
            await prisma.user.update({ where: { id: userId }, data: { suspendedAt: at } });
        },
        async counts(since24h, since7d) {
            const [users, verifiedUsers, suspendedUsers, conversations, messages, messagesLast24h, messagesLast7d, openReports] = await Promise.all([
                prisma.user.count(),
                prisma.user.count({ where: { isVerified: true } }),
                prisma.user.count({ where: { suspendedAt: { not: null } } }),
                prisma.conversation.count(),
                prisma.message.count(),
                prisma.message.count({ where: { createdAt: { gte: since24h } } }),
                prisma.message.count({ where: { createdAt: { gte: since7d } } }),
                prisma.report.count({ where: { status: 'open' } }),
            ]);
            return { users, verifiedUsers, suspendedUsers, conversations, messages, messagesLast24h, messagesLast7d, openReports };
        },
    };
}
