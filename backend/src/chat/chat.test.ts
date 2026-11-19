import { describe, it, expect, vi } from 'vitest';
import { createChat } from './chat';
import { MemoryChatStore } from './memoryStore';
import type { ChatConfig } from './types';

const HOUR = 3600 * 1000;

function setup(config: Partial<ChatConfig> = {}, userCount = 30) {
    const store = new MemoryChatStore();
    store.addUser({ id: 'me', plates: ['AA-111-AA'], pushToken: 'ExponentPushToken[me]' });
    store.addUser({ id: 'bob', plates: ['BB-222-BB'], pushToken: 'ExponentPushToken[bob]' });
    for (let i = 0; i < userCount; i++) store.addUser({ id: `u${i}`, plates: [`ZZ-${100 + i}-ZZ`] });

    let current = new Date('2026-01-10T10:00:00Z');
    const clock = {
        now: () => current,
        advance: (ms: number) => { current = new Date(current.getTime() + ms); },
    };
    const events = { messageSent: vi.fn() };
    const chat = createChat({ store, events, now: clock.now, config });
    return { store, chat, clock, events };
}

describe('send: basic delivery', () => {
    it('saves the message, records the conversation and notifies', async () => {
        const { chat, store, events } = setup();
        const result = await chat.send({ senderId: 'me', receiverId: 'bob', content: 'hello', relatedPlate: 'BB-222-BB' });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.message.content).toBe('hello');
        expect(result.message.relatedPlate).toBe('BB-222-BB');
        expect(store.openedRecords()).toHaveLength(1);
        expect(events.messageSent).toHaveBeenCalledTimes(1);
        expect(events.messageSent.mock.calls[0][1].pushToken).toBe('ExponentPushToken[bob]');
    });

    it('accepts an image with no text', async () => {
        const { chat } = setup();
        const result = await chat.send({ senderId: 'me', receiverId: 'bob', content: '', imageUrl: '/uploads/a.jpg' });
        expect(result.ok).toBe(true);
    });

    it('refuses an empty message', async () => {
        const { chat, store } = setup();
        expect(await chat.send({ senderId: 'me', receiverId: 'bob', content: '   ' })).toEqual({ ok: false, reason: 'empty' });
        expect(store.openedRecords()).toHaveLength(0);
    });

    it('refuses to write to oneself and to unknown users', async () => {
        const { chat } = setup();
        expect(await chat.send({ senderId: 'me', receiverId: 'me', content: 'hi' })).toEqual({ ok: false, reason: 'self' });
        expect(await chat.send({ senderId: 'me', receiverId: 'ghost', content: 'hi' })).toEqual({ ok: false, reason: 'unknown_receiver' });
    });
});

describe('send: who may write to whom', () => {
    it('refuses a suspended sender', async () => {
        const { chat, store } = setup();
        store.addUser({ id: 'mallory', suspended: true });
        expect(await chat.send({ senderId: 'mallory', receiverId: 'bob', content: 'hi' })).toEqual({ ok: false, reason: 'sender_suspended' });
    });

    it('refuses in both directions when one has blocked the other', async () => {
        const { chat, store, events } = setup();
        store.addBlock('bob', 'me');
        expect(await chat.send({ senderId: 'me', receiverId: 'bob', content: 'hi' })).toEqual({ ok: false, reason: 'blocked' });
        expect(await chat.send({ senderId: 'bob', receiverId: 'me', content: 'hi' })).toEqual({ ok: false, reason: 'blocked' });
        expect(events.messageSent).not.toHaveBeenCalled();
    });

    it('blocks even inside an existing conversation', async () => {
        const { chat, store } = setup();
        await chat.send({ senderId: 'me', receiverId: 'bob', content: 'before' });
        store.addBlock('me', 'bob');
        expect(await chat.send({ senderId: 'bob', receiverId: 'me', content: 'after' })).toEqual({ ok: false, reason: 'blocked' });
    });

    it('refuses a stranger when the receiver only accepts known conversations', async () => {
        const { chat, store } = setup();
        store.addUser({ id: 'shy', acceptNewContacts: false });
        expect(await chat.send({ senderId: 'me', receiverId: 'shy', content: 'hi' })).toEqual({ ok: false, reason: 'receiver_closed' });
    });

    it('lets the receiver who is closed to strangers reply to someone they know', async () => {
        const { chat, store } = setup();
        store.addUser({ id: 'shy', acceptNewContacts: false });
        // shy opened the conversation themselves
        expect((await chat.send({ senderId: 'shy', receiverId: 'me', content: 'hi' })).ok).toBe(true);
        expect((await chat.send({ senderId: 'me', receiverId: 'shy', content: 'hello back' })).ok).toBe(true);
    });
});

describe('send: daily limit on new conversations', () => {
    it('stops opening new conversations past the limit', async () => {
        const { chat } = setup({ dailyNewConversations: 3 });
        for (const id of ['u0', 'u1', 'u2']) {
            expect((await chat.send({ senderId: 'me', receiverId: id, content: 'hi' })).ok).toBe(true);
        }
        expect(await chat.send({ senderId: 'me', receiverId: 'u3', content: 'hi' })).toEqual({ ok: false, reason: 'daily_limit' });
    });

    it('does not limit more messages in a conversation already open', async () => {
        const { chat } = setup({ dailyNewConversations: 1 });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'one' });
        for (let i = 0; i < 5; i++) {
            expect((await chat.send({ senderId: 'me', receiverId: 'u0', content: `more ${i}` })).ok).toBe(true);
        }
    });

    it('does not count conversations opened by others, nor replies to them', async () => {
        const { chat } = setup({ dailyNewConversations: 1 });
        await chat.send({ senderId: 'u0', receiverId: 'me', content: 'hey' });
        await chat.send({ senderId: 'u1', receiverId: 'me', content: 'hey' });
        expect((await chat.send({ senderId: 'me', receiverId: 'u0', content: 'reply' })).ok).toBe(true);
        expect((await chat.send({ senderId: 'me', receiverId: 'u1', content: 'reply' })).ok).toBe(true);
        expect((await chat.send({ senderId: 'me', receiverId: 'u2', content: 'new' })).ok).toBe(true);
    });

    it('frees the limit after 24 hours', async () => {
        const { chat, clock } = setup({ dailyNewConversations: 1 });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'hi' });
        expect((await chat.send({ senderId: 'me', receiverId: 'u1', content: 'hi' })).ok).toBe(false);
        clock.advance(25 * HOUR);
        expect((await chat.send({ senderId: 'me', receiverId: 'u1', content: 'hi' })).ok).toBe(true);
    });
});

describe('Free quota', () => {
    it('counts conversations opened by me and by others', async () => {
        const { chat } = setup();
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'hi' });
        await chat.send({ senderId: 'u1', receiverId: 'me', content: 'hi' });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'again' });
        expect((await chat.quota('me')).used).toBe(2);
    });

    it('warns near the limit and at the limit', async () => {
        const { chat } = setup({ freeQuota: 4, warnAt: 3, dailyNewConversations: 99, enforceQuota: false });
        const levels: string[] = [];
        for (const id of ['u0', 'u1', 'u2', 'u3']) {
            const r = await chat.send({ senderId: 'me', receiverId: id, content: 'hi' });
            if (r.ok) levels.push(r.quota.level);
        }
        expect(levels).toEqual(['ok', 'ok', 'near', 'reached']);
    });

    it('only warns in v1: the limit does not block when not enforced', async () => {
        const { chat } = setup({ freeQuota: 1, warnAt: 1, dailyNewConversations: 99, enforceQuota: false });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'hi' });
        expect((await chat.send({ senderId: 'me', receiverId: 'u1', content: 'hi' })).ok).toBe(true);
    });

    it('blocks opening new conversations once enforced, but never replies or incoming ones', async () => {
        const { chat } = setup({ freeQuota: 2, warnAt: 2, dailyNewConversations: 99, enforceQuota: true });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'hi' });
        await chat.send({ senderId: 'me', receiverId: 'u1', content: 'hi' });

        expect(await chat.send({ senderId: 'me', receiverId: 'u2', content: 'hi' })).toEqual({ ok: false, reason: 'quota_reached' });
        // existing conversation: still fine
        expect((await chat.send({ senderId: 'me', receiverId: 'u0', content: 'more' })).ok).toBe(true);
        // someone else opens a conversation with me: delivered and I can answer
        expect((await chat.send({ senderId: 'u5', receiverId: 'me', content: 'hey' })).ok).toBe(true);
        expect((await chat.send({ senderId: 'me', receiverId: 'u5', content: 'hey back' })).ok).toBe(true);
        expect((await chat.quota('me')).used).toBe(3);
    });

    it('does not give the slot back when a conversation is deleted', async () => {
        const { chat } = setup({ freeQuota: 1, warnAt: 1, dailyNewConversations: 99, enforceQuota: true });
        await chat.send({ senderId: 'me', receiverId: 'u0', content: 'hi' });
        await chat.deleteFor('me', 'u0');
        expect((await chat.quota('me')).used).toBe(1);
        expect(await chat.send({ senderId: 'me', receiverId: 'u1', content: 'hi' })).toEqual({ ok: false, reason: 'quota_reached' });
    });
});

describe('conversations opened before they were recorded', () => {
    it('treats an old pair as known: no daily-limit hit, no closed-receiver refusal', async () => {
        const { chat, store, clock } = setup({ dailyNewConversations: 0 });
        store.addUser({ id: 'shy', acceptNewContacts: false });
        store.addLegacyMessage({
            senderId: 'shy', receiverId: 'me', content: 'old', imageUrl: null, relatedPlate: null,
            createdAt: new Date(clock.now().getTime() - 48 * HOUR),
        });
        expect((await chat.send({ senderId: 'me', receiverId: 'shy', content: 'reply' })).ok).toBe(true);
        expect((await chat.quota('me')).used).toBe(1);
    });

    it('credits the opening to whoever wrote first', async () => {
        const { chat, store, clock } = setup();
        store.addLegacyMessage({
            senderId: 'bob', receiverId: 'me', content: 'old', imageUrl: null, relatedPlate: null,
            createdAt: new Date(clock.now().getTime() - 48 * HOUR),
        });
        await chat.send({ senderId: 'me', receiverId: 'bob', content: 'reply' });
        expect(store.openedRecords()[0].openedById).toBe('bob');
    });
});

describe('history, read and delete', () => {
    it('returns both directions in order', async () => {
        const { chat, clock } = setup();
        await chat.send({ senderId: 'me', receiverId: 'bob', content: 'one' });
        clock.advance(1000);
        await chat.send({ senderId: 'bob', receiverId: 'me', content: 'two' });
        const history = await chat.history('me', 'bob');
        expect(history.map(m => m.content)).toEqual(['one', 'two']);
    });

    it('deleting hides messages for me only', async () => {
        const { chat, clock } = setup();
        await chat.send({ senderId: 'me', receiverId: 'bob', content: 'one' });
        clock.advance(1000);
        await chat.send({ senderId: 'bob', receiverId: 'me', content: 'two' });

        await chat.deleteFor('me', 'bob');

        expect(await chat.history('me', 'bob')).toEqual([]);
        expect((await chat.history('bob', 'me')).map(m => m.content)).toEqual(['one', 'two']);
    });

    it('messages sent after a deletion are visible again', async () => {
        const { chat, clock } = setup();
        await chat.send({ senderId: 'me', receiverId: 'bob', content: 'old' });
        await chat.deleteFor('me', 'bob');
        clock.advance(1000);
        await chat.send({ senderId: 'bob', receiverId: 'me', content: 'new' });
        expect((await chat.history('me', 'bob')).map(m => m.content)).toEqual(['new']);
    });

    it('marks received messages as read', async () => {
        const { chat } = setup();
        await chat.send({ senderId: 'bob', receiverId: 'me', content: 'hi' });
        expect((await chat.conversations('me'))[0].unreadCount).toBe(1);
        await chat.markRead('me', 'bob');
        expect((await chat.conversations('me'))[0].unreadCount).toBe(0);
    });

    it('lists conversations with my scope and partner display', async () => {
        const { chat } = setup();
        await chat.send({ senderId: 'bob', receiverId: 'me', content: 'hi', relatedPlate: 'AA-111-AA' });
        const [c] = await chat.conversations('me');
        expect(c.partnerId).toBe('bob');
        expect(c.myScope).toBe('AA-111-AA');
        expect(c.otherDisplay).toBe('BB-222-BB');
    });
});
