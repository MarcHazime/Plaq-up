import { BrevoMailer } from './brevo';
import { ConsoleMailer } from './console';
import type { Mailer } from './types';

export type { Mailer } from './types';
export { BrevoMailer } from './brevo';
export { ConsoleMailer } from './console';

/**
 * Picks the adapter from the environment. With a Brevo key the sender address
 * must be set explicitly: a default one is never a verified sender, and the
 * failure would otherwise only show up as emails that never arrive.
 */
export function mailerFromEnv(env: Record<string, string | undefined> = process.env): Mailer {
    const apiKey = env.BREVO_API_KEY || env.SMTP_PASS;
    if (!apiKey || !apiKey.startsWith('xkeysib-')) return new ConsoleMailer();

    if (!env.SMTP_FROM) {
        throw new Error('SMTP_FROM must be set to a sender address verified in Brevo when BREVO_API_KEY is set');
    }
    return new BrevoMailer({ apiKey, fromEmail: env.SMTP_FROM });
}
