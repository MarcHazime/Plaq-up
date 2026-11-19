import type {
    AdminUser, ContextMessage, ModerationStore, NewReport, PartyInfo, ReportRecord, ReportStatus, ReportedMessage, Stats,
} from './types';

interface SeedUser extends Partial<AdminUser> {
    id: string;
}

interface SeedMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    imageUrl?: string | null;
    createdAt: Date;
}

/** In-memory ModerationStore: the second adapter that makes the seam real, and the one tests use. */
export class MemoryModerationStore implements ModerationStore {
    users = new Map<string, AdminUser>();
    messages: SeedMessage[] = [];
    reports: ReportRecord[] = [];
    conversationCount = 0;
    private nextId = 1;

    addUser(user: SeedUser) {
        this.users.set(user.id, {
            plates: [], pseudo: null, suspended: false, isAdmin: false, verified: true, createdAt: new Date('2026-01-01'), ...user,
        });
    }

    addMessage(message: SeedMessage) {
        this.messages.push(message);
    }

    private party(id: string): PartyInfo {
        const u = this.users.get(id);
        return { id, plates: u?.plates ?? [], pseudo: u?.pseudo ?? null };
    }

    async getMessage(id: string): Promise<ReportedMessage | null> {
        const m = this.messages.find(x => x.id === id);
        return m ? { ...m, imageUrl: m.imageUrl ?? null, sender: this.party(m.senderId), receiver: this.party(m.receiverId) } : null;
    }

    async conversationContext(a: string, b: string, at: Date, exceptId: string, limit: number): Promise<ContextMessage[]> {
        return this.messages
            .filter(m => m.id !== exceptId && m.createdAt <= at && ((m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a)))
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
            .slice(-limit)
            .map(m => ({ senderId: m.senderId, content: m.content, imageUrl: m.imageUrl ?? null, createdAt: m.createdAt }));
    }

    async findOpenReport(reporterId: string, messageId: string) {
        return this.reports.find(r => r.reporterId === reporterId && r.messageId === messageId && r.status === 'open') ?? null;
    }

    async countReportsBySince(reporterId: string, since: Date) {
        return this.reports.filter(r => r.reporterId === reporterId && r.createdAt >= since).length;
    }

    async createReport(report: NewReport) {
        const record: ReportRecord = { ...report, id: `r${this.nextId++}`, status: 'open', decidedAt: null, decisionNote: null };
        this.reports.push(record);
        return record;
    }

    async listReports(status: ReportStatus | 'all', limit: number) {
        return this.reports
            .filter(r => status === 'all' || r.status === status)
            .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
            .slice(0, limit);
    }

    async getReport(id: string) {
        return this.reports.find(r => r.id === id) ?? null;
    }

    async decideReport(id: string, status: Exclude<ReportStatus, 'open'>, at: Date, note: string | null) {
        const r = this.reports.find(x => x.id === id);
        if (r) Object.assign(r, { status, decidedAt: at, decisionNote: note });
    }

    async closeOpenReportsAgainst(userId: string, status: Exclude<ReportStatus, 'open'>, at: Date, note: string | null) {
        for (const r of this.reports) {
            if (r.reportedId === userId && r.status === 'open') Object.assign(r, { status, decidedAt: at, decisionNote: note });
        }
    }

    async getUser(id: string) {
        return this.users.get(id) ?? null;
    }

    async searchUsersByPlate(query: string, limit: number) {
        const q = query.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return [...this.users.values()]
            .filter(u => u.plates.some(p => p.replace(/-/g, '').includes(q)))
            .slice(0, limit);
    }

    async setSuspended(userId: string, at: Date | null) {
        const u = this.users.get(userId);
        if (u) u.suspended = at !== null;
    }

    async counts(since24h: Date, since7d: Date): Promise<Stats> {
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
