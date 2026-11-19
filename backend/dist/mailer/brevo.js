"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrevoMailer = void 0;
const axios_1 = __importDefault(require("axios"));
const axiosPost = async (url, body, headers) => {
    await axios_1.default.post(url, body, { headers });
};
/** Sends through Brevo's HTTP API (port 443: Railway blocks SMTP). */
class BrevoMailer {
    constructor(options, post = axiosPost) {
        this.options = options;
        this.post = post;
    }
    async send(to, subject, text) {
        try {
            await this.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: this.options.fromName ?? "Plaq'Up", email: this.options.fromEmail },
                to: [{ email: to }],
                subject,
                textContent: text,
            }, { accept: 'application/json', 'api-key': this.options.apiKey, 'content-type': 'application/json' });
        }
        catch (error) {
            const detail = error.response?.data ?? error.message;
            throw new Error(`Email failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
    }
}
exports.BrevoMailer = BrevoMailer;
