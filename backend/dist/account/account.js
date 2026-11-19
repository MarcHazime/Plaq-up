"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccount = createAccount;
const crypto_1 = require("crypto");
const Plate = __importStar(require("../domain/plate"));
const password_1 = require("./password");
const pseudo_1 = require("./pseudo");
const HOUR = 3600 * 1000;
const VERIFICATION_TTL = 24 * HOUR;
const RESET_TTL = HOUR;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function createAccount({ store, mailer, hasher, now = () => new Date(), newCode = () => String((0, crypto_1.randomInt)(100000, 1000000)), }) {
    const codeIsValid = (expected, expires, given) => expected !== null && expected === given && expires !== null && expires > now();
    /** Stores a fresh verification code and emails it. */
    async function sendVerificationCode(user, subject, intro) {
        const code = newCode();
        await store.update(user.id, { verificationToken: code, verificationExpires: new Date(now().getTime() + VERIFICATION_TTL) });
        await mailer.send(user.email, subject, `Bonjour,\n\n${intro}\n\n${code}\n\nCe code est valable 24 heures.\n\nL'équipe Plaq'Up`);
    }
    return {
        async register({ plate: rawPlate, password, email: rawEmail }) {
            const plate = typeof rawPlate === 'string' ? Plate.parse(rawPlate) : null;
            if (!plate)
                return { ok: false, reason: 'invalid_plate' };
            if ((0, password_1.passwordProblem)(password))
                return { ok: false, reason: 'weak_password' };
            const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
            if (!EMAIL.test(email))
                return { ok: false, reason: 'invalid_email' };
            // A verified account owns its plate and email. An unverified one reserves nothing:
            // otherwise a failed signup, or a squatter, would lock the plate for its real owner.
            const [plateOwner, emailOwner] = await Promise.all([store.findByPlate(plate), store.findByEmail(email)]);
            if (plateOwner?.isVerified)
                return { ok: false, reason: 'plate_taken' };
            if (emailOwner?.isVerified)
                return { ok: false, reason: 'email_taken' };
            for (const stale of new Set([plateOwner?.id, emailOwner?.id])) {
                if (stale)
                    await store.delete(stale);
            }
            const code = newCode();
            const user = await store.createWithVehicle({
                email,
                passwordHash: await hasher.hash(password),
                plate,
                verificationToken: code,
                verificationExpires: new Date(now().getTime() + VERIFICATION_TTL),
            });
            try {
                await mailer.send(email, "Bienvenue sur Plaq'Up - Vérifiez votre compte", `Bonjour,\n\nBienvenue sur Plaq'Up !\n\nPour activer votre compte, veuillez saisir le code de vérification suivant :\n\n${code}\n\nCe code est valable 24 heures.\n\nÀ bientôt,\nL'équipe Plaq'Up`);
            }
            catch (error) {
                // No half-created account: the user can simply try again.
                await store.delete(user.id);
                return { ok: false, reason: 'email_failed', detail: error?.message };
            }
            return { ok: true, userId: user.id, email, primaryPlate: plate };
        },
        async verifyEmail(userId, code) {
            if (!userId || !code)
                return { ok: false, reason: 'missing' };
            const user = await store.findById(userId);
            if (!user)
                return { ok: false, reason: 'not_found' };
            if (user.isVerified)
                return { ok: false, reason: 'already_verified' };
            if (!codeIsValid(user.verificationToken, user.verificationExpires, code))
                return { ok: false, reason: 'invalid_code' };
            await store.update(userId, { isVerified: true, verificationToken: null, verificationExpires: null });
            return { ok: true, userId, email: user.email };
        },
        async resendCode(userId) {
            const user = await store.findById(userId);
            if (!user)
                return { ok: false, reason: 'not_found' };
            if (user.isVerified)
                return { ok: false, reason: 'already_verified' };
            if (!user.email)
                return { ok: false, reason: 'no_email' };
            try {
                await sendVerificationCode(user, "Plaq'Up - Votre nouveau code de vérification", 'Voici votre nouveau code de vérification :');
            }
            catch {
                return { ok: false, reason: 'email_failed' };
            }
            return { ok: true };
        },
        async login({ plate: rawPlate, password }) {
            const plate = typeof rawPlate === 'string' ? Plate.parse(rawPlate) : null;
            if (!plate || typeof password !== 'string')
                return { ok: false, reason: 'invalid' };
            const user = await store.findByPlate(plate);
            if (!user || !(await hasher.compare(password, user.passwordHash)))
                return { ok: false, reason: 'invalid' };
            // Only someone who knows the password learns the account exists but is unverified.
            if (user.suspended)
                return { ok: false, reason: 'suspended' };
            if (!user.isVerified)
                return { ok: false, reason: 'unverified', userId: user.id, email: user.email };
            return { ok: true, userId: user.id, email: user.email, primaryPlate: plate };
        },
        async requestPasswordReset(rawEmail) {
            const user = await store.findByEmail(rawEmail.trim().toLowerCase());
            if (!user?.email)
                return { ok: true }; // never reveal whether an email has an account
            const code = newCode();
            await store.update(user.id, { resetToken: code, resetTokenExpires: new Date(now().getTime() + RESET_TTL) });
            try {
                await mailer.send(user.email, "Réinitialisation mot de passe - Plaq'Up", `Bonjour,\n\nVoici votre code de réinitialisation : ${code}\n\nCe code est valable 1 heure.\n\nL'équipe Plaq'Up`);
            }
            catch {
                return { ok: false, reason: 'email_failed' };
            }
            return { ok: true };
        },
        async resetPassword({ email, code, newPassword }) {
            if ((0, password_1.passwordProblem)(newPassword))
                return { ok: false, reason: 'weak_password' };
            const user = await store.findByEmail(email.trim().toLowerCase());
            if (!user || !codeIsValid(user.resetToken, user.resetTokenExpires, code))
                return { ok: false, reason: 'invalid_code' };
            await store.update(user.id, { passwordHash: await hasher.hash(newPassword), resetToken: null, resetTokenExpires: null });
            return { ok: true };
        },
        async changePassword(userId, currentPassword, newPassword) {
            const user = await store.findById(userId);
            if (!user)
                return { ok: false, reason: 'not_found' };
            if (!(await hasher.compare(currentPassword, user.passwordHash)))
                return { ok: false, reason: 'wrong_password' };
            if ((0, password_1.passwordProblem)(newPassword))
                return { ok: false, reason: 'weak_password' };
            await store.update(userId, { passwordHash: await hasher.hash(newPassword) });
            return { ok: true };
        },
        async updateSettings(userId, { pseudo, acceptNewContacts }) {
            const user = await store.findById(userId);
            if (!user)
                return { ok: false, reason: 'not_found' };
            const patch = {};
            if (pseudo !== undefined) {
                const result = (0, pseudo_1.normalizePseudo)(pseudo);
                if (!result.ok)
                    return { ok: false, reason: result.reason };
                patch.pseudo = result.value;
            }
            if (acceptNewContacts !== undefined)
                patch.acceptNewContacts = acceptNewContacts;
            await store.update(userId, patch);
            return {
                ok: true,
                pseudo: patch.pseudo !== undefined ? patch.pseudo : user.pseudo,
                acceptNewContacts: patch.acceptNewContacts ?? user.acceptNewContacts,
            };
        },
        deleteAccount: userId => store.delete(userId),
    };
}
