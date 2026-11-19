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
exports.getBlockStatus = exports.getBlockedUsers = exports.unblockUser = exports.blockUser = exports.deleteUser = exports.updatePushToken = exports.deleteVehicle = exports.addVehicle = exports.getVehicles = exports.updateUser = exports.getSettings = exports.getUserById = exports.searchUser = void 0;
const db_1 = require("../db");
const account_1 = require("../account");
const pseudo_1 = require("../account/pseudo");
const Plate = __importStar(require("../domain/plate"));
const searchUser = async (req, res) => {
    const { plate: rawPlate } = req.query;
    if (!rawPlate || typeof rawPlate !== 'string') {
        return res.status(400).json({ error: 'Plate query parameter is required' });
    }
    const plate = Plate.parse(rawPlate);
    if (!plate) {
        return res.status(400).json({ error: 'Format de plaque invalide' });
    }
    try {
        const vehicle = await db_1.prisma.vehicle.findUnique({
            where: { plate },
            include: { user: { select: { id: true, createdAt: true } } }
        });
        if (!vehicle) {
            return res.status(404).json({ error: 'Plaque introuvable' });
        }
        // Return user info attached to the plate
        res.json({
            id: vehicle.userId,
            plate: vehicle.plate,
            createdAt: vehicle.user.createdAt
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.searchUser = searchUser;
const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id },
            select: { id: true, createdAt: true, pseudo: true, vehicles: { where: { isPrimary: true }, select: { plate: true } } }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // What other Users may see: the pseudo if set, otherwise the primary Plate. Never the email or the other plates.
        res.json({ id: user.id, createdAt: user.createdAt, displayName: (0, account_1.displayName)(user.pseudo, user.vehicles[0]?.plate) });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUserById = getUserById;
const getSettings = async (req, res) => {
    try {
        const user = await account_1.accountStore.findById(req.params.id);
        if (!user)
            return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json({ email: user.email, pseudo: user.pseudo, acceptNewContacts: user.acceptNewContacts });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSettings = getSettings;
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { pseudo, acceptNewContacts, currentPassword, newPassword } = req.body;
    try {
        if (newPassword !== undefined) {
            const result = await (0, account_1.account)().changePassword(id, currentPassword ?? '', newPassword);
            if (!result.ok) {
                const known = {
                    not_found: [404, 'Utilisateur introuvable'],
                    wrong_password: [400, 'Mot de passe actuel incorrect'],
                    weak_password: [400, 'Le mot de passe doit contenir au moins 8 caractères'],
                };
                const [status, error] = known[result.reason];
                return res.status(status).json({ error });
            }
        }
        if (pseudo !== undefined || acceptNewContacts !== undefined) {
            const result = await (0, account_1.account)().updateSettings(id, { pseudo, acceptNewContacts });
            if (!result.ok) {
                const error = result.reason === 'not_found' ? 'Utilisateur introuvable' : pseudo_1.PSEUDO_MESSAGES[result.reason];
                return res.status(result.reason === 'not_found' ? 404 : 400).json({ error });
            }
        }
        const user = await account_1.accountStore.findById(id);
        res.json({
            message: 'User updated successfully',
            user: { id, email: user?.email, pseudo: user?.pseudo ?? null, acceptNewContacts: user?.acceptNewContacts ?? true },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateUser = updateUser;
const getVehicles = async (req, res) => {
    const { userId } = req.params;
    try {
        const vehicles = await db_1.prisma.vehicle.findMany({
            where: { userId }
        });
        res.json(vehicles);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching vehicles' });
    }
};
exports.getVehicles = getVehicles;
const addVehicle = async (req, res) => {
    const { userId } = req.params;
    const plate = typeof req.body.plate === 'string' ? Plate.parse(req.body.plate) : null;
    if (!plate) {
        return res.status(400).json({ error: 'Format de plaque invalide' });
    }
    try {
        const existing = await db_1.prisma.vehicle.findUnique({ where: { plate } });
        if (existing) {
            return res.status(400).json({ error: 'Plaque déjà enregistrée' });
        }
        const vehicle = await db_1.prisma.vehicle.create({
            data: {
                plate,
                userId
            }
        });
        res.json(vehicle);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error adding vehicle' });
    }
};
exports.addVehicle = addVehicle;
const deleteVehicle = async (req, res) => {
    const { userId, id } = req.params; // id is vehicleId
    try {
        const vehicle = await db_1.prisma.vehicle.findUnique({ where: { id } });
        if (!vehicle || vehicle.userId !== userId) {
            return res.status(404).json({ error: 'Véhicule introuvable' });
        }
        if (vehicle.isPrimary) {
            return res.status(400).json({ error: 'Impossible de supprimer le véhicule principal' });
        }
        await db_1.prisma.vehicle.delete({ where: { id } });
        res.json({ message: 'Véhicule supprimé' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error deleting vehicle' });
    }
};
exports.deleteVehicle = deleteVehicle;
const updatePushToken = async (req, res) => {
    const { id } = req.params;
    const { pushToken } = req.body;
    try {
        await db_1.prisma.user.update({
            where: { id },
            data: { pushToken },
        });
        res.json({ message: 'Push token updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePushToken = updatePushToken;
const deleteUser = async (req, res) => {
    try {
        await (0, account_1.account)().deleteAccount(req.params.id);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteUser = deleteUser;
const blockUser = async (req, res) => {
    const { blockerId, blockedId } = req.body;
    try {
        // Check if already blocked to avoid unique constraint error
        const existing = await db_1.prisma.block.findUnique({
            where: {
                blockerId_blockedId: { blockerId, blockedId }
            }
        });
        if (existing)
            return res.json({ message: 'User already blocked' });
        await db_1.prisma.block.create({
            data: { blockerId, blockedId }
        });
        res.json({ message: 'User blocked' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error blocking user' });
    }
};
exports.blockUser = blockUser;
const unblockUser = async (req, res) => {
    const { blockerId, blockedId } = req.body;
    try {
        await db_1.prisma.block.deleteMany({
            where: { blockerId, blockedId }
        });
        res.json({ message: 'User unblocked' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error unblocking user' });
    }
};
exports.unblockUser = unblockUser;
const getBlockedUsers = async (req, res) => {
    const { userId } = req.params;
    try {
        const blocks = await db_1.prisma.block.findMany({
            where: { blockerId: userId },
            include: {
                blocked: {
                    select: {
                        id: true,
                        pseudo: true,
                        vehicles: {
                            where: { isPrimary: true },
                            select: { plate: true }
                        }
                    }
                }
            }
        });
        res.json(blocks.map(b => ({
            id: b.blocked.id,
            displayName: (0, account_1.displayName)(b.blocked.pseudo, b.blocked.vehicles[0]?.plate)
        })));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching blocked users' });
    }
};
exports.getBlockedUsers = getBlockedUsers;
// Check relationship status (bidirectional block check)
const getBlockStatus = async (req, res) => {
    const { userId, otherId } = req.params;
    try {
        const blocks = await db_1.prisma.block.findMany({
            where: {
                OR: [
                    { blockerId: userId, blockedId: otherId }, // I blocked them
                    { blockerId: otherId, blockedId: userId } // They blocked me
                ]
            }
        });
        const blockedByMe = blocks.some(b => b.blockerId === userId);
        const blockedByOther = blocks.some(b => b.blockerId === otherId);
        res.json({ blockedByMe, blockedByOther });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching block status' });
    }
};
exports.getBlockStatus = getBlockStatus;
