import type { Mailer } from '../mailer';
import type { ReportRecord } from './types';

const REASON_LABELS: Record<string, string> = {
    harassment: 'harcèlement',
    spam: 'spam',
    inappropriate: 'contenu inapproprié',
    other: 'autre',
};

export interface ReportAlertConfig {
    /** Where alerts go. Null means no alert. */
    to: string | null;
    /** Public address of the server, to link the administration page. */
    baseUrl: string | null;
}

/** Alert settings from the environment: REPORT_ALERT_EMAIL, else the sender address; the link from PUBLIC_BASE_URL or Railway's domain. */
export function alertConfigFromEnv(env: Record<string, string | undefined> = process.env): ReportAlertConfig {
    const domain = env.RAILWAY_PUBLIC_DOMAIN;
    return {
        to: env.REPORT_ALERT_EMAIL || env.SMTP_FROM || null,
        baseUrl: env.PUBLIC_BASE_URL || (domain ? `https://${domain}` : null),
    };
}

/**
 * Emails the administrator when a Report comes in. It never carries the reported message itself:
 * the evidence stays in the administration page. A failing mailer never fails the report.
 */
export function reportAlert(mailer: Mailer, config: ReportAlertConfig = alertConfigFromEnv()) {
    return async (report: ReportRecord): Promise<void> => {
        if (!config.to) return;
        const who = report.snapshot.reported.pseudo
            ? `${report.snapshot.reported.pseudo} (${report.snapshot.reported.plates.join(', ') || 'sans plaque'})`
            : report.snapshot.reported.plates.join(', ') || 'compte sans plaque';
        const lines = [
            'Un message vient d\'être signalé sur Plaq\'Up.',
            '',
            `Motif : ${REASON_LABELS[report.reason] ?? report.reason}`,
            `Compte signalé : ${who}`,
        ];
        if (config.baseUrl) lines.push('', `À traiter : ${config.baseUrl.replace(/\/$/, '')}/admin/`);
        try {
            await mailer.send(config.to, "Plaq'Up : nouveau signalement", lines.join('\n'));
        } catch (error) {
            console.error('[moderation] report alert email failed:', error);
        }
    };
}
