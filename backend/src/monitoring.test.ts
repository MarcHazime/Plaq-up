import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { initMonitoring, scrubEvent } from './monitoring';

describe('monitoring', () => {
    it('does nothing without a DSN', () => {
        expect(initMonitoring({})).toBe(false);
    });

    it('strips personal data from an event', () => {
        const event = {
            type: undefined,
            request: {
                data: { password: 'secret', content: 'hello' },
                cookies: { a: 'b' },
                query_string: 'email=a@b.c',
                headers: { authorization: 'Bearer x', cookie: 'c', accept: 'json' },
            },
            user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
        } as unknown as ErrorEvent;

        const out = scrubEvent(event);

        expect(out.request).toEqual({ headers: { accept: 'json' } });
        expect(out.user).toEqual({ id: 'u1' });
    });
});
