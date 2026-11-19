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
exports.getVehicleInfo = exports.scanPlate = void 0;
const sivService_1 = require("../services/sivService");
const ocrService_1 = require("../services/ocrService");
const db_1 = require("../db");
const Plate = __importStar(require("../domain/plate"));
const scanPlate = async (req, res) => {
    const multerReq = req;
    if (!multerReq.file) {
        res.status(400).json({ error: 'Image requise' });
        return;
    }
    try {
        const plate = await (0, ocrService_1.extractPlateFromImage)(multerReq.file.buffer);
        if (!plate) {
            res.status(404).json({ error: 'Aucune plaque détectée' });
            return;
        }
        // Reuse the logic to fetch info and check user
        const sivData = await (0, sivService_1.getVehicleDetails)(plate);
        const vehicle = await db_1.prisma.vehicle.findUnique({
            where: { plate },
            include: { user: { select: { id: true } } }
        });
        const registeredUser = vehicle && vehicle.user ? {
            id: vehicle.user.id,
            plate: vehicle.plate
        } : null;
        res.json({
            ...sivData,
            registeredUser: registeredUser || null,
            detectedPlate: plate
        });
    }
    catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ error: error.message || 'Échec du scan de la plaque' });
    }
};
exports.scanPlate = scanPlate;
const getVehicleInfo = async (req, res) => {
    const plate = Plate.parse(req.params.plate ?? '');
    if (!plate) {
        res.status(400).json({ error: 'Plaque requise' });
        return;
    }
    try {
        // Fetch SIV data
        const sivData = await (0, sivService_1.getVehicleDetails)(plate);
        // Check if vehicle exists in our DB
        const vehicle = await db_1.prisma.vehicle.findUnique({
            where: { plate },
            include: { user: { select: { id: true } } }
        });
        const registeredUser = vehicle && vehicle.user ? {
            id: vehicle.user.id,
            plate: vehicle.plate
        } : null;
        res.json({
            ...sivData,
            registeredUser: registeredUser || null
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Échec de la récupération des détails du véhicule' });
    }
};
exports.getVehicleInfo = getVehicleInfo;
