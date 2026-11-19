import { describe, it, expect } from 'vitest';
import { buildConversations, ConversationMessage } from './conversations';

const me = { id: 'me', pseudo: null, vehicles: [{ plate: 'AA-111-AA' }] };
const bob = { id: 'bob', pseudo: null as string | null, vehicles: [{ plate: 'BB-222-BB' }] };
const eve = { id: 'eve', pseudo: null, vehicles: [] };

const myVehicles = [
    { plate: 'AA-111-AA', isPrimary: true },
    { plate: 'CC-333-CC', isPrimary: false },
];

let t = 0;
function msg(from: { id: string; pseudo: string | null; vehicles: { plate: string }[] }, to: { id: string; pseudo: string | null; vehicles: { plate: string }[] }, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
    return {
        senderId: from.id,
        receiverId: to.id,
        content: 'hello',
        relatedPlate: null,
        isRead: false,
        deletedBySender: false,
        deletedByReceiver: false,
        createdAt: new Date(2026, 0, 1, 0, 0, t++),
        sender: from,
        receiver: to,
        ...overrides,
    };
}

describe('buildConversations', () => {
    it('groups messages by pair of users even across two plates', () => {
        const result = buildConversations('me', [
            msg(bob, me, { relatedPlate: 'AA-111-AA', content: 'first' }),
            msg(me, bob, { relatedPlate: 'BB-222-BB', content: 'latest' }),
        ], myVehicles);

        expect(result).toHaveLength(1);
        expect(result[0].partnerId).toBe('bob');
        expect(result[0].lastMessage).toBe('latest');
        expect(result[0].relatedPlate).toBe('BB-222-BB');
    });

    it('scopes to my plate and shows the partner primary when the subject is my plate', () => {
        const [c] = buildConversations('me', [msg(bob, me, { relatedPlate: 'CC-333-CC' })], myVehicles);
        expect(c.myScope).toBe('CC-333-CC');
        expect(c.otherDisplay).toBe('BB-222-BB');
    });

    it('scopes to my primary and shows the subject when the subject is their plate', () => {
        const [c] = buildConversations('me', [msg(me, bob, { relatedPlate: 'BB-222-BB' })], myVehicles);
        expect(c.myScope).toBe('AA-111-AA');
        expect(c.otherDisplay).toBe('BB-222-BB');
    });

    it('falls back to Inconnu when the partner has no primary vehicle', () => {
        const [c] = buildConversations('me', [msg(eve, me, { relatedPlate: 'AA-111-AA' })], myVehicles);
        expect(c.otherDisplay).toBe('Inconnu');
    });

    it('falls back to Unknown scope when I have no vehicle and the message has no plate', () => {
        const [c] = buildConversations('me', [msg(bob, me)], []);
        expect(c.myScope).toBe('Unknown');
        expect(c.relatedPlate).toBe('Unknown');
    });

    it('counts only unread messages I received', () => {
        const [c] = buildConversations('me', [
            msg(bob, me),
            msg(bob, me, { isRead: true }),
            msg(me, bob),
            msg(bob, me),
        ], myVehicles);
        expect(c.unreadCount).toBe(2);
    });

    it('ignores messages I deleted on my side, keeps those the partner deleted', () => {
        const result = buildConversations('me', [
            msg(me, bob, { deletedBySender: true }),
            msg(bob, me, { deletedByReceiver: true }),
            msg(me, eve, { deletedByReceiver: true, content: 'kept' }),
        ], myVehicles);
        expect(result).toHaveLength(1);
        expect(result[0].partnerId).toBe('eve');
        expect(result[0].lastMessage).toBe('kept');
    });

    it('orders conversations by latest message first', () => {
        const result = buildConversations('me', [
            msg(bob, me),
            msg(eve, me),
            msg(bob, me),
        ], myVehicles);
        expect(result.map(c => c.partnerId)).toEqual(['bob', 'eve']);
    });

    it('shows the partner pseudo instead of any plate when they set one', () => {
        const zoe = { ...bob, pseudo: 'Zoé' };
        const [mine] = buildConversations('me', [msg(zoe, me, { relatedPlate: 'CC-333-CC' })], myVehicles);
        expect(mine.otherDisplay).toBe('Zoé');
        const [theirs] = buildConversations('me', [msg(me, zoe, { relatedPlate: 'BB-222-BB' })], myVehicles);
        expect(theirs.otherDisplay).toBe('Zoé');
    });

    it('never exposes the partner email', () => {
        const [c] = buildConversations('me', [msg(bob, me)], myVehicles);
        expect(JSON.stringify(c)).not.toContain('@');
        expect(c).not.toHaveProperty('email');
    });

    it('returns an empty list when there are no messages', () => {
        expect(buildConversations('me', [], myVehicles)).toEqual([]);
    });
});
