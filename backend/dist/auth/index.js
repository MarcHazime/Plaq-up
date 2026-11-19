"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireActive = exports.lookupAccount = void 0;
const db_1 = require("../db");
const guards_1 = require("./guards");
const lookupAccount = async (userId) => {
    const u = await db_1.prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, isAdmin: true } });
    return u && { suspended: u.suspendedAt !== null, isAdmin: u.isAdmin };
};
exports.lookupAccount = lookupAccount;
_a = (0, guards_1.createGuards)(exports.lookupAccount), exports.requireActive = _a.requireActive, exports.requireAdmin = _a.requireAdmin;
