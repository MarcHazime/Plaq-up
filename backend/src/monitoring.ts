import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';

dotenv.config();

/**
 * Removes everything personal from an error report before it leaves the server:
 * request bodies (passwords, messages), cookies, auth headers, query strings, IPs.
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
    if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
        }
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
    return event;
}

/** Sentry is opt-in: without SENTRY_DSN nothing is sent and nothing changes. */
export function initMonitoring(env: NodeJS.ProcessEnv = process.env): boolean {
    if (!env.SENTRY_DSN) return false;
    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT || 'production',
        tracesSampleRate: 0,
        beforeSend: scrubEvent,
    });
    return true;
}

export { Sentry };
