import { describe, expect, it } from 'vitest';
import { dropPending, mergeIncoming, type ThreadMessage } from './thread';

describe('thread', () => {
    it('adds a message that is not shown yet', () => {
        expect(mergeIncoming<ThreadMessage>([{ id: 'a' }], { id: 'b' })).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('ignores a message already shown, by id', () => {
        const shown: ThreadMessage[] = [{ id: 'a' }];
        expect(mergeIncoming(shown, { id: 'a' })).toBe(shown);
    });

    it('ignores the server copy of our own pending message, by tempId', () => {
        const shown: ThreadMessage[] = [{ tempId: 't1', content: 'hi' }];
        expect(mergeIncoming(shown, { id: 'srv1', tempId: 't1', content: 'hi' })).toBe(shown);
    });

    it('does not confuse two messages that both lack an id', () => {
        const shown: ThreadMessage[] = [{ tempId: 't1' }];
        expect(mergeIncoming(shown, { tempId: 't2' })).toHaveLength(2);
    });

    it('takes back a refused pending message and nothing else', () => {
        expect(dropPending<ThreadMessage>([{ id: 'a' }, { tempId: 't1' }, { tempId: 't2' }], 't1')).toEqual([{ id: 'a' }, { tempId: 't2' }]);
    });
});
