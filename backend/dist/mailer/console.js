"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleMailer = void 0;
/** Development adapter: prints the message instead of sending it. */
class ConsoleMailer {
    constructor(log = console.log) {
        this.log = log;
    }
    async send(to, subject, text) {
        this.log('=============================================');
        this.log('[EMAIL DEV MODE] (no Brevo API key configured)');
        this.log(`To: ${to}`);
        this.log(`Subject: ${subject}`);
        this.log(text);
        this.log('=============================================');
    }
}
exports.ConsoleMailer = ConsoleMailer;
