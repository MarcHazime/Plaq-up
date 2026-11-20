import { describe, expect, it, vi } from 'vitest';
import type { Mailer } from '../mailer';
import { alertConfigFromEnv, reportAlert } from './alert';
import type { ReportRecord } from './types';

const report = {
    id: 'r1',
    reason: 'harassment',
    snapshot: {
        message: { content: 'SECRET MESSAGE TEXT' },
        reported: { id: 'bob', pseudo: 'Bobby', plates: ['BB-222-BB'] },
        reporter: { id: 'me', pseudo: null, plates: ['AA-111-AA'] },
    },
} as unknown as ReportRecord;

const mailer = () => {
    const sent: { to: string; subject: string; text: string }[] = [];
    const m: Mailer = { send: vi.fn(async (to, subject, text) => { sent.push({ to, subject, text }); }) };
    return { m, sent };
};

describe('report alert', () => {
    it('emails the administrator with reason, account and link, but not the message', async () => {
        const { m, sent } = mailer();
        await reportAlert(m, { to: 'boss@x.fr', baseUrl: 'https://app.example/' })(report);
        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe('boss@x.fr');
        expect(sent[0].text).toContain('harcèlement');
        expect(sent[0].text).toContain('Bobby (BB-222-BB)');
        expect(sent[0].text).toContain('https://app.example/admin/');
        expect(sent[0].text).not.toContain('SECRET');
    });

    it('sends nothing without a recipient', async () => {
        const { m } = mailer();
        await reportAlert(m, { to: null, baseUrl: null })(report);
        expect(m.send).not.toHaveBeenCalled();
    });

    it('swallows a mailer failure', async () => {
        const failing: Mailer = { send: async () => { throw new Error('down'); } };
        await expect(reportAlert(failing, { to: 'a@b.c', baseUrl: null })(report)).resolves.toBeUndefined();
    });

    it('reads the recipient and link from the environment', () => {
        expect(alertConfigFromEnv({ REPORT_ALERT_EMAIL: 'boss@x.fr', SMTP_FROM: 'sender@x.fr', RAILWAY_PUBLIC_DOMAIN: 'a.up.railway.app' })).toEqual({
            to: 'boss@x.fr',
            baseUrl: 'https://a.up.railway.app',
        });
        expect(alertConfigFromEnv({ SMTP_FROM: 'sender@x.fr' })).toEqual({ to: 'sender@x.fr', baseUrl: null });
        expect(alertConfigFromEnv({})).toEqual({ to: null, baseUrl: null });
    });
});
