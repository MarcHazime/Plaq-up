"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.login = exports.resendVerification = exports.verifyEmail = exports.register = void 0;
const account_1 = require("../account");
const password_1 = require("../account/password");
const token_1 = require("../auth/token");
const serverError = (res, context, error) => {
    console.error(`${context}:`, error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
};
const REGISTER_ERRORS = {
    invalid_plate: 'Format de plaque invalide (ex: AA-123-BB)',
    weak_password: (0, password_1.passwordProblem)(''),
    invalid_email: 'Email requis pour la vérification',
    plate_taken: 'Plaque déjà enregistrée',
    email_taken: 'Email déjà enregistré',
    email_failed: "Impossible d'envoyer l'email de vérification. Réessayez plus tard.",
};
const register = async (req, res) => {
    try {
        const { plate, password, email } = req.body;
        const result = await (0, account_1.account)().register({ plate, password, email });
        if (!result.ok) {
            if (result.reason === 'email_failed')
                console.error('Registration email failed:', result.detail);
            return res.status(result.reason === 'email_failed' ? 502 : 400).json({ error: REGISTER_ERRORS[result.reason] });
        }
        res.status(201).json({
            message: 'Inscription réussie. Veuillez vérifier votre email.',
            userId: result.userId,
            email: result.email,
            requiresVerification: true,
            primaryPlate: result.primaryPlate,
        });
    }
    catch (error) {
        serverError(res, 'Registration Error', error);
    }
};
exports.register = register;
const verifyEmail = async (req, res) => {
    try {
        const { userId, code } = req.body;
        const result = await (0, account_1.account)().verifyEmail(userId, code);
        if (!result.ok) {
            const known = {
                missing: [400, 'ID utilisateur et code requis'],
                not_found: [404, 'Utilisateur introuvable'],
                already_verified: [400, 'Compte déjà vérifié'],
                invalid_code: [400, 'Code invalide ou expiré'],
            };
            const [status, error] = known[result.reason];
            return res.status(status).json({ error });
        }
        res.json({
            message: 'Compte vérifié avec succès',
            userId: result.userId,
            token: (0, token_1.signToken)(result.userId),
            email: result.email,
        });
    }
    catch (error) {
        serverError(res, 'Email Verification Error', error);
    }
};
exports.verifyEmail = verifyEmail;
const resendVerification = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'ID utilisateur requis' });
        const result = await (0, account_1.account)().resendCode(userId);
        if (!result.ok) {
            const known = {
                not_found: [404, 'Utilisateur introuvable'],
                already_verified: [400, 'Compte déjà vérifié'],
                no_email: [400, 'Aucun email associé à ce compte'],
                email_failed: [502, "Impossible d'envoyer le code. Réessayez plus tard."],
            };
            const [status, error] = known[result.reason];
            return res.status(status).json({ error });
        }
        res.json({ message: 'Un nouveau code a été envoyé.' });
    }
    catch (error) {
        serverError(res, 'Resend Verification Error', error);
    }
};
exports.resendVerification = resendVerification;
const login = async (req, res) => {
    try {
        const { plate, password } = req.body;
        const result = await (0, account_1.account)().login({ plate, password });
        if (!result.ok) {
            if (result.reason === 'unverified') {
                // Lets the app send the user straight to the code screen.
                return res.status(403).json({
                    error: 'Email non vérifié. Veuillez vérifier votre email.',
                    code: 'EMAIL_NOT_VERIFIED',
                    userId: result.userId,
                    email: result.email,
                });
            }
            if (result.reason === 'suspended') {
                return res.status(403).json({ error: 'Votre compte est suspendu.', code: 'ACCOUNT_SUSPENDED' });
            }
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
        res.json({
            message: 'Connexion réussie',
            userId: result.userId,
            token: (0, token_1.signToken)(result.userId),
            email: result.email,
            primaryPlate: result.primaryPlate,
        });
    }
    catch (error) {
        serverError(res, 'Login Error', error);
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email requis' });
        const result = await (0, account_1.account)().requestPasswordReset(email);
        if (!result.ok)
            return res.status(502).json({ error: "Impossible d'envoyer l'email. Réessayez plus tard." });
        res.json({ message: 'Si cet email existe, un code a été envoyé.' });
    }
    catch (error) {
        serverError(res, 'Forgot Password Error', error);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword)
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        const result = await (0, account_1.account)().resetPassword({ email, code, newPassword });
        if (!result.ok) {
            const error = result.reason === 'weak_password' ? (0, password_1.passwordProblem)('') : 'Code invalide ou expiré';
            return res.status(400).json({ error });
        }
        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    }
    catch (error) {
        serverError(res, 'Reset Password Error', error);
    }
};
exports.resetPassword = resetPassword;
