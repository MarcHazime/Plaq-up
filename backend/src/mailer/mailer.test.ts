import { describe, it, expect, vi } from 'vitest';
import { BrevoMailer } from './brevo';
import { ConsoleMailer } from './console';
import { mailerFromEnv } from './index';

describe('BrevoMailer', () => {
    it('posts the message with the configured sender and api key', async () => {
        const post = vi.fn().mockResolvedValue(undefined);
        await new BrevoMailer({ apiKey: 'xkeysib-1', fromEmail: 'contact@plaq-up.fr' }, post).send('a@x.fr', 'Hello', 'Body');

        const [url, body, headers] = post.mock.calls[0];
        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(body).toMatchObject({
            sender: { email: 'contact@plaq-up.fr' },
            to: [{ email: 'a@x.fr' }],
            subject: 'Hello',
            textContent: 'Body',
        });
        expect(headers['api-key']).toBe('xkeysib-1');
    });

    it('throws with the provider detail when the send is refused', async () => {
        const post = vi.fn().mockRejectedValue({ response: { data: { message: 'sender not valid' } } });
        await expect(new BrevoMailer({ apiKey: 'xkeysib-1', fromEmail: 'x@y.fr' }, post).send('a@x.fr', 's', 't'))
            .rejects.toThrow(/sender not valid/);
    });
});

describe('ConsoleMailer', () => {
    it('prints instead of sending', async () => {
        const log = vi.fn();
        await new ConsoleMailer(log).send('a@x.fr', 'Subject', 'Code 123456');
        expect(log.mock.calls.flat().join('\n')).toContain('Code 123456');
    });
});

describe('mailerFromEnv', () => {
    it('uses the console without a Brevo key', () => {
        expect(mailerFromEnv({})).toBeInstanceOf(ConsoleMailer);
        expect(mailerFromEnv({ BREVO_API_KEY: 'not-a-brevo-key' })).toBeInstanceOf(ConsoleMailer);
    });

    it('uses Brevo with a key and a sender', () => {
        expect(mailerFromEnv({ BREVO_API_KEY: 'xkeysib-1', SMTP_FROM: 'contact@plaq-up.fr' })).toBeInstanceOf(BrevoMailer);
    });

    it('refuses to start with a Brevo key but no sender address', () => {
        expect(() => mailerFromEnv({ BREVO_API_KEY: 'xkeysib-1' })).toThrow(/SMTP_FROM/);
    });

    it('accepts the key from the legacy SMTP_PASS variable', () => {
        expect(mailerFromEnv({ SMTP_PASS: 'xkeysib-1', SMTP_FROM: 'a@b.fr' })).toBeInstanceOf(BrevoMailer);
    });
});
