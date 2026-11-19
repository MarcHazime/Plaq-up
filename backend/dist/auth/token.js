"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.assertAuthConfigured = assertAuthConfigured;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const TOKEN_LIFETIME = '30d';
function secret() {
    const value = process.env.JWT_SECRET;
    if (!value)
        throw new Error('JWT_SECRET is not set');
    return value;
}
function signToken(userId) {
    return jsonwebtoken_1.default.sign({ sub: userId }, secret(), { expiresIn: TOKEN_LIFETIME });
}
/** Returns the user id carried by a valid token, or null if the token is missing, invalid or expired. */
function verifyToken(token) {
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret());
        return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
    }
    catch {
        return null;
    }
}
function assertAuthConfigured() {
    secret();
}
