"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_REASONS = exports.moderation = void 0;
const db_1 = require("../db");
const moderation_1 = require("./moderation");
const prismaStore_1 = require("./prismaStore");
exports.moderation = (0, moderation_1.createModeration)({ store: (0, prismaStore_1.createPrismaModerationStore)(db_1.prisma) });
var types_1 = require("./types");
Object.defineProperty(exports, "REPORT_REASONS", { enumerable: true, get: function () { return types_1.REPORT_REASONS; } });
