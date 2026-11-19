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
exports.adminRoutes = exports.reportRoutes = void 0;
const express_1 = require("express");
const middleware_1 = require("../auth/middleware");
const auth_1 = require("../auth");
const C = __importStar(require("../controllers/moderationController"));
/** POST /api/reports: any active signed-in User. */
exports.reportRoutes = (0, express_1.Router)();
exports.reportRoutes.use(middleware_1.requireAuth, auth_1.requireActive);
exports.reportRoutes.post('/', C.reportMessage);
/** /api/admin/*: active administrators only. */
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.use(middleware_1.requireAuth, auth_1.requireAdmin);
exports.adminRoutes.get('/stats', C.adminStats);
exports.adminRoutes.get('/reports', C.adminListReports);
exports.adminRoutes.post('/reports/:id/dismiss', C.adminDismissReport);
exports.adminRoutes.post('/reports/:id/suspend', C.adminSuspendFromReport);
exports.adminRoutes.get('/users', C.adminSearchUsers);
exports.adminRoutes.post('/users/:id/suspend', C.adminSetSuspension(true));
exports.adminRoutes.post('/users/:id/unsuspend', C.adminSetSuspension(false));
