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
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const UserController = __importStar(require("../controllers/userController")); // Assuming UserController is now imported as a whole object for new routes
const auth_1 = require("../auth");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
router.use(middleware_1.requireAuth, auth_1.requireActive);
router.get('/:userId/vehicles', (0, middleware_1.requireSelf)('userId'), UserController.getVehicles);
router.post('/:userId/vehicles', (0, middleware_1.requireSelf)('userId'), UserController.addVehicle);
router.delete('/:userId/vehicles/:id', (0, middleware_1.requireSelf)('userId'), UserController.deleteVehicle);
router.get('/search', UserController.searchUser); // ?plate=AA-123-BB
router.get('/:id/settings', (0, middleware_1.requireSelf)('id'), UserController.getSettings);
router.get('/:id', userController_1.getUserById);
router.put('/:id', (0, middleware_1.requireSelf)('id'), userController_1.updateUser);
router.put('/:id/push-token', (0, middleware_1.requireSelf)('id'), userController_1.updatePushToken);
router.post('/block', (0, middleware_1.requireSelfInBody)('blockerId'), userController_1.blockUser);
router.post('/unblock', (0, middleware_1.requireSelfInBody)('blockerId'), userController_1.unblockUser);
router.get('/blocked/:userId', (0, middleware_1.requireSelf)('userId'), userController_1.getBlockedUsers);
router.get('/relationship/:userId/:otherId', (0, middleware_1.requireSelf)('userId'), userController_1.getBlockStatus);
router.delete('/:id', (0, middleware_1.requireSelf)('id'), userController_1.deleteUser);
exports.default = router;
