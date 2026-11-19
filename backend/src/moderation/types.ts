export const REPORT_REASONS = ['harassment', 'spam', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface PartyInfo {
    id: string;
    plates: string[];
    pseudo: string | null;
}

export interface ReportedMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    imageUrl: string | null;
    imageId: string | null;
    createdAt: Date;
    sender: PartyInfo;
    receiver: PartyInfo;
}

export interface ContextMessage {
    senderId: string;
    content: string;
    imageUrl: string | null;
    createdAt: Date;
}

/** The frozen evidence kept with a Report. */
export interface ReportSnapshot {
    message: { id: string; senderId: string; content: string; imageUrl: string | null; imageId: string | null; createdAt: Date };
    context: ContextMessage[];
    reporter: PartyInfo;
    reported: PartyInfo;
}

export type ReportStatus = 'open' | 'dismissed' | 'suspended';

export interface ReportRecord {
    id: string;
    createdAt: Date;
    reporterId: string | null;
    reportedId: string | null;
    messageId: string;
    reason: ReportReason;
    note: string | null;
    snapshot: ReportSnapshot;
    status: ReportStatus;
    decidedAt: Date | null;
    decisionNote: string | null;
}

export type NewReport = Omit<ReportRecord, 'id' | 'status' | 'decidedAt' | 'decisionNote'>;

export interface AdminUser {
    id: string;
    plates: string[];
    pseudo: string | null;
    suspended: boolean;
    isAdmin: boolean;
    verified: boolean;
    createdAt: Date;
}

export interface Stats {
    users: number;
    verifiedUsers: number;
    suspendedUsers: number;
    conversations: number;
    messages: number;
    messagesLast24h: number;
    messagesLast7d: number;
    openReports: number;
}

/** The seam between the Moderation module and its storage. */
export interface ModerationStore {
    getMessage(id: string): Promise<ReportedMessage | null>;
    /** Up to `limit` messages of the pair sent at or before `at`, excluding `exceptId`, oldest first. Deleted ones included. */
    conversationContext(a: string, b: string, at: Date, exceptId: string, limit: number): Promise<ContextMessage[]>;
    findOpenReport(reporterId: string, messageId: string): Promise<ReportRecord | null>;
    countReportsBySince(reporterId: string, since: Date): Promise<number>;
    createReport(report: NewReport): Promise<ReportRecord>;
    listReports(status: ReportStatus | 'all', limit: number): Promise<ReportRecord[]>;
    getReport(id: string): Promise<ReportRecord | null>;
    decideReport(id: string, status: Exclude<ReportStatus, 'open'>, at: Date, note: string | null): Promise<void>;
    /** Closes every open Report against this user. */
    closeOpenReportsAgainst(userId: string, status: Exclude<ReportStatus, 'open'>, at: Date, note: string | null): Promise<void>;
    getUser(id: string): Promise<AdminUser | null>;
    searchUsersByPlate(query: string, limit: number): Promise<AdminUser[]>;
    setSuspended(userId: string, at: Date | null): Promise<void>;
    counts(since24h: Date, since7d: Date): Promise<Stats>;
}

export type ReportResult =
    | { ok: true; reportId: string }
    | { ok: false; reason: 'invalid_reason' | 'message_not_found' | 'not_recipient' | 'duplicate' | 'too_many' };

export type DecisionResult =
    | { ok: true }
    | { ok: false; reason: 'not_found' | 'already_decided' | 'no_reported_user' | 'is_admin' };

export type SuspendResult = { ok: true } | { ok: false; reason: 'not_found' | 'is_admin' };
