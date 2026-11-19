"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayName = exports.accountStore = void 0;
exports.account = account;
exports.assertAccountConfigured = assertAccountConfigured;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const mailer_1 = require("../mailer");
const account_1 = require("./account");
const prismaStore_1 = require("./prismaStore");
exports.accountStore = (0, prismaStore_1.createPrismaAccountStore)(db_1.prisma);
let instance;
/** Built on first use, so the environment is loaded by then. */
function account() {
    return (instance ?? (instance = (0, account_1.createAccount)({
        store: exports.accountStore,
        mailer: (0, mailer_1.mailerFromEnv)(),
        hasher: { hash: p => bcryptjs_1.default.hash(p, 10), compare: (p, h) => bcryptjs_1.default.compare(p, h) },
    })));
}
/** Fails at startup, not at the first signup, when email is misconfigured. */
function assertAccountConfigured() {
    (0, mailer_1.mailerFromEnv)();
}
var pseudo_1 = require("./pseudo");
Object.defineProperty(exports, "displayName", { enumerable: true, get: function () { return pseudo_1.displayName; } });
