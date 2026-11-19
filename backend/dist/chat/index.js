"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = exports.chatWith = exports.chatStore = void 0;
const db_1 = require("../db");
const chat_1 = require("./chat");
const prismaStore_1 = require("./prismaStore");
exports.chatStore = (0, prismaStore_1.createPrismaChatStore)(db_1.prisma);
/** Chat wired to the real database. Pass events to react to sent messages (sockets, push). */
const chatWith = (events) => (0, chat_1.createChat)({ store: exports.chatStore, events });
exports.chatWith = chatWith;
exports.chat = (0, exports.chatWith)();
