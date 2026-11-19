"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({ storage: storage });
const auth_1 = require("../auth");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
router.use(middleware_1.requireAuth, auth_1.requireActive);
router.get('/history/:userId1/:userId2', (0, middleware_1.requireParty)('userId1', 'userId2'), chatController_1.getChatHistory);
router.get('/list/:userId', (0, middleware_1.requireSelf)('userId'), chatController_1.getUserChats);
router.get('/quota/:userId', (0, middleware_1.requireSelf)('userId'), chatController_1.getQuota);
router.post('/upload', upload.single('image'), chatController_1.uploadImage);
router.delete('/:userId/:partnerId', (0, middleware_1.requireSelf)('userId'), chatController_1.deleteConversation);
router.put('/read/:userId/:partnerId', (0, middleware_1.requireSelf)('userId'), chatController_1.markMessagesAsRead);
exports.default = router;
