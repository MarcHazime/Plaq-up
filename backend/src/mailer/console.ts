import type { Mailer } from './types';

/** Development adapter: prints the message instead of sending it. */
export class ConsoleMailer implements Mailer {
    constructor(private log: (line: string) => void = console.log) {}

    async send(to: string, subject: string, text: string) {
        this.log('=============================================');
        this.log('[EMAIL DEV MODE] (no Brevo API key configured)');
        this.log(`To: ${to}`);
        this.log(`Subject: ${subject}`);
        this.log(text);
        this.log('=============================================');
    }
}
