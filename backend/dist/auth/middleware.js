"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireParty = exports.requireSelfInBody = exports.requireSelf = void 0;
exports.requireAuth = requireAuth;
exports.authenticateSocket = authenticateSocket;
const token_1 = require("./token");
const unauthorized = (res) => res.status(401).json({ error: 'Authentification requise' });
const forbidden = (res) => res.status(403).json({ error: 'Accès interdit' });
function bearer(req) {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
/** Rejects requests without a valid token and exposes the caller as `req.userId`. */
function requireAuth(req, res, next) {
    const userId = (0, token_1.verifyToken)(bearer(req));
    if (!userId)
        return unauthorized(res);
    req.userId = userId;
    next();
}
/** The authenticated user must be the one named by the route parameter. */
const requireSelf = (param) => (req, res, next) => req.userId === req.params[param] ? next() : forbidden(res);
exports.requireSelf = requireSelf;
/** The authenticated user must be the one named by a body field. */
const requireSelfInBody = (field) => (req, res, next) => req.userId === req.body?.[field] ? next() : forbidden(res);
exports.requireSelfInBody = requireSelfInBody;
/** The authenticated user must be one of the users named by the route parameters. */
const requireParty = (...params) => (req, res, next) => params.some(p => req.params[p] === req.userId) ? next() : forbidden(res);
exports.requireParty = requireParty;
/** socket.io middleware: authenticates the handshake and stores the user id in `socket.data`. */
function authenticateSocket(socket, next) {
    const userId = (0, token_1.verifyToken)(socket.handshake.auth?.token);
    if (!userId)
        return next(new Error('Authentification requise'));
    socket.data.userId = userId;
    next();
}
