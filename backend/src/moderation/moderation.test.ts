import { describe, it, expect } from 'vitest';
import { createModeration } from './moderation';
import { MemoryModerationStore } from './memoryStore';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function setup() {
    const store = new MemoryModerationStore();
    store.addUser({ id: 'me', plates: ['AA-111-AA'] });
    store.addUser({ id: 'bob', plates: ['BB-222-BB'], pseudo: 'Bobby' });
    store.addUser({ id: 'eve', plates: ['EE-555-EE'] });
    store.addUser({ id: 'boss', plates: ['ZZ-000-ZZ'], isAdmin: true });

    let current = new Date('2026-01-10T12:00:00Z');
    const at = (minutesAgo: number) => new Date(current.getTime() - minutesAgo * MIN);
    // bob -> me conversation, oldest first
    store.addMessage({ id: 'm1', senderId: 'me', receiverId: 'bob', content: 'hello', createdAt: at(30) });
    store.addMessage({ id: 'm2', senderId: 'bob', receiverId: 'me', content: 'you idiot', createdAt: at(20) });
    store.addMessage({ id: 'm3', senderId: 'bob', receiverId: 'me', content: 'later message', createdAt: at(10) });
    store.addMessage({ id: 'm4', senderId: 'me', receiverId: 'bob', content: 'my own', createdAt: at(5) });

    const moderation = createModeration({ store, now: () => current });
    return { store, moderation, advance: (ms: number) => { current = new Date(current.getTime() + ms); } };
}

describe('report', () => {
    it('freezes the message, its context and both parties', async () => {
        const { moderation, store } = setup();
        const r = await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'harassment', note: 'insulting' });
        expect(r.ok).toBe(true);

        const [saved] = store.reports;
        expect(saved).toMatchObject({ reporterId: 'me', reportedId: 'bob', reason: 'harassment', note: 'insulting', status: 'open' });
        expect(saved.snapshot.message.content).toBe('you idiot');
        expect(saved.snapshot.context.map(c => c.content)).toEqual(['hello']); // only what came before
        expect(saved.snapshot.reporter.plates).toEqual(['AA-111-AA']);
        expect(saved.snapshot.reported).toMatchObject({ id: 'bob', pseudo: 'Bobby', plates: ['BB-222-BB'] });
    });

    it('keeps the evidence even if the original message is later deleted', async () => {
        const { moderation, store } = setup();
        await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' });
        store.messages = [];
        expect(store.reports[0].snapshot.message.content).toBe('you idiot');
    });

    it('limits the context to the last ten messages', async () => {
        const { moderation, store } = setup();
        for (let i = 0; i < 15; i++) {
            store.addMessage({ id: `x${i}`, senderId: 'bob', receiverId: 'me', content: `c${i}`, createdAt: new Date(2026, 0, 9, 0, i) });
        }
        await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' });
        expect(store.reports[0].snapshot.context).toHaveLength(10);
    });

    it('only the recipient can report a message', async () => {
        const { moderation } = setup();
        expect(await moderation.report({ reporterId: 'me', messageId: 'm1', reason: 'spam' })).toEqual({ ok: false, reason: 'not_recipient' });
        expect(await moderation.report({ reporterId: 'eve', messageId: 'm2', reason: 'spam' })).toEqual({ ok: false, reason: 'not_recipient' });
    });

    it('rejects an unknown message and an unknown reason', async () => {
        const { moderation, store } = setup();
        expect(await moderation.report({ reporterId: 'me', messageId: 'nope', reason: 'spam' })).toEqual({ ok: false, reason: 'message_not_found' });
        expect(await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'because' as any })).toEqual({ ok: false, reason: 'invalid_reason' });
        expect(store.reports).toHaveLength(0);
    });

    it('does not accept the same message twice while the first report is open', async () => {
        const { moderation } = setup();
        await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' });
        expect(await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'harassment' })).toEqual({ ok: false, reason: 'duplicate' });
        // another message from the same person is a separate report
        expect((await moderation.report({ reporterId: 'me', messageId: 'm3', reason: 'spam' })).ok).toBe(true);
    });

    it('caps the number of reports one user can file per day', async () => {
        const { moderation, store, advance } = setup();
        for (let i = 0; i < 10; i++) {
            store.addMessage({ id: `s${i}`, senderId: 'eve', receiverId: 'me', content: 'spam', createdAt: new Date() });
            expect((await moderation.report({ reporterId: 'me', messageId: `s${i}`, reason: 'spam' })).ok).toBe(true);
        }
        expect(await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' })).toEqual({ ok: false, reason: 'too_many' });
        advance(25 * HOUR);
        expect((await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' })).ok).toBe(true);
    });
});

describe('decisions', () => {
    async function withReport() {
        const s = setup();
        const r = await s.moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'harassment' });
        if (!r.ok) throw new Error();
        return { ...s, reportId: r.reportId };
    }

    it('dismisses a report without touching the reported user', async () => {
        const { moderation, store, reportId } = await withReport();
        expect(await moderation.dismissReport(reportId, 'fine')).toEqual({ ok: true });
        expect(store.reports[0]).toMatchObject({ status: 'dismissed', decisionNote: 'fine' });
        expect(store.users.get('bob')!.suspended).toBe(false);
    });

    it('suspends the reported user and closes every open report against them', async () => {
        const { moderation, store, reportId } = await withReport();
        store.addMessage({ id: 'e1', senderId: 'bob', receiverId: 'eve', content: 'hey', createdAt: new Date() });
        await moderation.report({ reporterId: 'eve', messageId: 'e1', reason: 'spam' });

        expect(await moderation.suspendFromReport(reportId, 'repeat offender')).toEqual({ ok: true });
        expect(store.users.get('bob')!.suspended).toBe(true);
        expect(store.reports.map(r => r.status)).toEqual(['suspended', 'suspended']);
    });

    it('does not decide a report twice', async () => {
        const { moderation, reportId } = await withReport();
        await moderation.dismissReport(reportId);
        expect(await moderation.dismissReport(reportId)).toEqual({ ok: false, reason: 'already_decided' });
        expect(await moderation.suspendFromReport(reportId)).toEqual({ ok: false, reason: 'already_decided' });
    });

    it('cannot suspend an administrator through a report', async () => {
        const { moderation, store } = setup();
        store.addMessage({ id: 'b1', senderId: 'boss', receiverId: 'me', content: 'hi', createdAt: new Date() });
        const r = await moderation.report({ reporterId: 'me', messageId: 'b1', reason: 'other' });
        if (!r.ok) throw new Error();
        expect(await moderation.suspendFromReport(r.reportId)).toEqual({ ok: false, reason: 'is_admin' });
        expect(store.users.get('boss')!.suspended).toBe(false);
    });

    it('reports an unknown report', async () => {
        const { moderation } = setup();
        expect(await moderation.dismissReport('ghost')).toEqual({ ok: false, reason: 'not_found' });
    });

    it('reports the account of a deleted user as having no one to suspend', async () => {
        const { moderation, store, reportId } = await withReport();
        store.reports[0].reportedId = null;
        expect(await moderation.suspendFromReport(reportId)).toEqual({ ok: false, reason: 'no_reported_user' });
    });
});

describe('suspending and reinstating users', () => {
    it('suspends and unsuspends', async () => {
        const { moderation, store } = setup();
        expect(await moderation.suspendUser('bob')).toEqual({ ok: true });
        expect(store.users.get('bob')!.suspended).toBe(true);
        expect(await moderation.unsuspendUser('bob')).toEqual({ ok: true });
        expect(store.users.get('bob')!.suspended).toBe(false);
    });

    it('refuses to suspend an administrator or an unknown user', async () => {
        const { moderation } = setup();
        expect(await moderation.suspendUser('boss')).toEqual({ ok: false, reason: 'is_admin' });
        expect(await moderation.suspendUser('ghost')).toEqual({ ok: false, reason: 'not_found' });
        expect(await moderation.unsuspendUser('ghost')).toEqual({ ok: false, reason: 'not_found' });
    });

    it('finds users by plate, however it is typed', async () => {
        const { moderation } = setup();
        expect((await moderation.searchUsers('bb 222')).map(u => u.id)).toEqual(['bob']);
        expect((await moderation.searchUsers('')).length).toBe(0);
    });
});

describe('stats', () => {
    it('counts users, messages and open reports', async () => {
        const { moderation, store } = setup();
        store.addUser({ id: 'ghost', verified: false });
        store.users.get('eve')!.suspended = true;
        await moderation.report({ reporterId: 'me', messageId: 'm2', reason: 'spam' });

        const s = await moderation.stats();
        expect(s).toMatchObject({ users: 5, verifiedUsers: 4, suspendedUsers: 1, messages: 4, messagesLast24h: 4, openReports: 1 });
    });
});

describe('report events', () => {
    it('notifies once the report is saved, and a failing handler does not fail the report', async () => {
        const store = new MemoryModerationStore();
        store.addUser({ id: 'me', plates: ['AA-111-AA'] });
        store.addUser({ id: 'bob', plates: ['BB-222-BB'] });
        store.addMessage({ id: 'm1', senderId: 'bob', receiverId: 'me', content: 'rude', createdAt: new Date('2026-01-10T11:00:00Z') });
        const seen: string[] = [];
        const moderation = createModeration({
            store,
            now: () => new Date('2026-01-10T12:00:00Z'),
            events: { reportCreated: async r => { seen.push(r.messageId); throw new Error('mailer down'); } },
        });

        const r = await moderation.report({ reporterId: 'me', messageId: 'm1', reason: 'spam' });

        expect(r.ok).toBe(true);
        expect(seen).toEqual(['m1']);
        expect(store.reports).toHaveLength(1);
    });
});
