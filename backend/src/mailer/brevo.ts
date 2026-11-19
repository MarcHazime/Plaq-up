import axios from 'axios';
import type { Mailer } from './types';

export type HttpPost = (url: string, body: unknown, headers: Record<string, string>) => Promise<void>;

const axiosPost: HttpPost = async (url, body, headers) => {
    await axios.post(url, body, { headers });
};

/** Sends through Brevo's HTTP API (port 443: Railway blocks SMTP). */
export class BrevoMailer implements Mailer {
    constructor(
        private options: { apiKey: string; fromEmail: string; fromName?: string },
        private post: HttpPost = axiosPost
    ) {}

    async send(to: string, subject: string, text: string) {
        try {
            await this.post(
                'https://api.brevo.com/v3/smtp/email',
                {
                    sender: { name: this.options.fromName ?? "Plaq'Up", email: this.options.fromEmail },
                    to: [{ email: to }],
                    subject,
                    textContent: text,
                },
                { accept: 'application/json', 'api-key': this.options.apiKey, 'content-type': 'application/json' }
            );
        } catch (error: any) {
            const detail = error.response?.data ?? error.message;
            throw new Error(`Email failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
    }
}
