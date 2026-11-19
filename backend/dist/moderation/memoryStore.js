"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryModerationStore = void 0;
/** In-memory ModerationStore: the second adapter that makes the seam real, and the one tests use. */
class MemoryModerationStore {
    constructor() {
        this.users = new Map();
        this.messages = [];
        this.reports = [];
        this.conversationCount = 0;
        this.nextId = 1;
    }
    addUser(user) {
        this.users.set(user.id, {
            plates: [], pseudo: null, suspended: false, isAdmin: false, verified: true, createdAt: new Date('2026-01-01'), ...user,
        });
    }
    addMessage(message) {
        this.messages.push(message);
    }
    party(id) {
        const u = this.users.get(id);
        return { id, plates: u?.plates ?? [], pseudo: u?.pseudo ?? null };
    }
    async getMessage(id) {
        const m = this.messages.find(x => x.id === id);
        return m ? { ...m, imageUrl: m.imageUrl ?? null, sender: this.party(m.senderId), receiver: this.party(m.receiverId) } : null;
    }
    async conversationContext(a, b, at, exceptId, limit) {
        return this.messages
            .filter(m => m.id !== exceptId && m.createdAt <= at && ((m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a)))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
            .slice(-limit)
            .map(m => ({ senderId: m.senderId, content: m.content, imageUrl: m.imageUrl ?? null, createdAt: m.createdAt }));
    }
    async findOpenReport(reporterId, messageId) {
        return this.reports.find(r => r.reporterId === reporterId && r.messageId === messageId && r.status === 'open') ?? null;
    }
    async countReportsBySince(reporterId, since) {
        return this.reports.filter(r => r.reporterId === reporterId && r.createdAt >= since).length;
    }
    async createReport(report) {
        const record = { ...report, id: `r${this.nextId++}`, status: 'open', decidedAt: null, decisionNote: null };
        this.reports.push(record);
        return record;
    }
    async listReports(status, limit) {
        return this.reports
            .filter(r => status === 'all' || r.status === status)
            .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
            .slice(0, limit);
    }
    async getReport(id) {
        return this.reports.find(r => r.id === id) ?? null;
    }
    async decideReport(id, status, at, note) {
        const r = this.reports.find(x => x.id === id);
        if (r)
            Object.assign(r, { status, decidedAt: at, decisionNote: note });
    }
    async closeOpenReportsAgainst(userId, status, at, note) {
        for (const r of this.reports) {
            if (r.reportedId === userId && r.status === 'open')
                Object.assign(r, { status, decidedAt: at, decisionNote: note });
        }
    }
    async getUser(id) {
        return this.users.get(id) ?? null;
    }
    async searchUsersByPlate(query, limit) {
        const q = query.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return [...this.users.values()]
            .filter(u => u.plates.some(p => p.replace(/-/g, '').includes(q)))
            .slice(0, limit);
    }
    async setSuspended(userId, at) {
        const u = this.users.get(userId);
        if (u)
            u.suspended = at !== null;
    }
    async counts(since24h, since7d) {
        const users = [...this.users.values()];
        return {
            users: users.length,
            verifiedUsers: users.filter(u => u.verified).length,
            suspendedUsers: users.filter(u => u.suspended).length,
            conversations: this.conversationCount,
            messages: this.messages.length,
            messagesLast24h: this.messages.filter(m => m.createdAt >= since24h).length,
            messagesLast7d: this.messages.filter(m => m.createdAt >= since7d).length,
            openReports: this.reports.filter(r => r.status === 'open').length,
        };
    }
}
exports.MemoryModerationStore = MemoryModerationStore;
