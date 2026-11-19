"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sivController_1 = require("../controllers/sivController");
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const auth_1 = require("../auth");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
router.use(middleware_1.requireAuth, auth_1.requireActive);
router.get('/:plate', sivController_1.getVehicleInfo);
router.post('/scan', upload.single('image'), sivController_1.scanPlate);
exports.default = router;
