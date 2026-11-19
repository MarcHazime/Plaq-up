"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleMailer = exports.BrevoMailer = void 0;
exports.mailerFromEnv = mailerFromEnv;
const brevo_1 = require("./brevo");
const console_1 = require("./console");
var brevo_2 = require("./brevo");
Object.defineProperty(exports, "BrevoMailer", { enumerable: true, get: function () { return brevo_2.BrevoMailer; } });
var console_2 = require("./console");
Object.defineProperty(exports, "ConsoleMailer", { enumerable: true, get: function () { return console_2.ConsoleMailer; } });
/**
 * Picks the adapter from the environment. With a Brevo key the sender address
 * must be set explicitly: a default one is never a verified sender, and the
 * failure would otherwise only show up as emails that never arrive.
 */
function mailerFromEnv(env = process.env) {
    const apiKey = env.BREVO_API_KEY || env.SMTP_PASS;
    if (!apiKey || !apiKey.startsWith('xkeysib-'))
        return new console_1.ConsoleMailer();
    if (!env.SMTP_FROM) {
        throw new Error('SMTP_FROM must be set to a sender address verified in Brevo when BREVO_API_KEY is set');
    }
    return new brevo_1.BrevoMailer({ apiKey, fromEmail: env.SMTP_FROM });
}
