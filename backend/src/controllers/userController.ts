import { Request, Response } from 'express';
import { prisma } from '../db';
import { account, accountStore, displayName } from '../account';
import { PSEUDO_MESSAGES } from '../account/pseudo';
import * as Plate from '../domain/plate';


export const searchUser = async (req: Request, res: Response) => {
    const { plate: rawPlate } = req.query;

    if (!rawPlate || typeof rawPlate !== 'string') {
        return res.status(400).json({ error: 'Plate query parameter is required' });
    }

    const plate = Plate.parse(rawPlate);
    if (!plate) {
        return res.status(400).json({ error: 'Format de plaque invalide' });
    }

    try {
        const vehicle = await prisma.vehicle.findUnique({
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, createdAt: true, pseudo: true, vehicles: { where: { isPrimary: true }, select: { plate: true } } }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // What other Users may see: the pseudo if set, otherwise the primary Plate. Never the email or the other plates.
        res.json({ id: user.id, createdAt: user.createdAt, displayName: displayName(user.pseudo, user.vehicles[0]?.plate) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getSettings = async (req: Request, res: Response) => {
    try {
        const user = await accountStore.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json({
            email: user.email,
            pseudo: user.pseudo,
            acceptNewContacts: user.acceptNewContacts,
            termsAccepted: await account().hasAcceptedCurrentTerms(user.id),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { pseudo, acceptNewContacts, currentPassword, newPassword } = req.body;

    try {
        if (newPassword !== undefined) {
            const result = await account().changePassword(id, currentPassword ?? '', newPassword);
            if (!result.ok) {
                const known = {
                    not_found: [404, 'Utilisateur introuvable'],
                    wrong_password: [400, 'Mot de passe actuel incorrect'],
                    weak_password: [400, 'Le mot de passe doit contenir au moins 8 caractères'],
                } as const;
                const [status, error] = known[result.reason];
                return res.status(status).json({ error });
            }
        }

        if (pseudo !== undefined || acceptNewContacts !== undefined) {
            const result = await account().updateSettings(id, { pseudo, acceptNewContacts });
            if (!result.ok) {
                const error = result.reason === 'not_found' ? 'Utilisateur introuvable' : PSEUDO_MESSAGES[result.reason];
                return res.status(result.reason === 'not_found' ? 404 : 400).json({ error });
            }
        }

        const user = await accountStore.findById(id);
        res.json({
            message: 'User updated successfully',
            user: { id, email: user?.email, pseudo: user?.pseudo ?? null, acceptNewContacts: user?.acceptNewContacts ?? true },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getVehicles = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { userId }
        });
        res.json(vehicles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching vehicles' });
    }
};

export const addVehicle = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const plate = typeof req.body.plate === 'string' ? Plate.parse(req.body.plate) : null;

    if (!plate) {
        return res.status(400).json({ error: 'Format de plaque invalide' });
    }

    try {
        const existing = await prisma.vehicle.findUnique({ where: { plate } });
        if (existing) {
            return res.status(400).json({ error: 'Plaque déjà enregistrée' });
        }

        const vehicle = await prisma.vehicle.create({
            data: {
                plate,
                userId
            }
        });
        res.json(vehicle);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error adding vehicle' });
    }
};

export const deleteVehicle = async (req: Request, res: Response) => {
    const { userId, id } = req.params; // id is vehicleId

    try {
        const vehicle = await prisma.vehicle.findUnique({ where: { id } });
        if (!vehicle || vehicle.userId !== userId) {
            return res.status(404).json({ error: 'Véhicule introuvable' });
        }

        if (vehicle.isPrimary) {
            return res.status(400).json({ error: 'Impossible de supprimer le véhicule principal' });
        }

        await prisma.vehicle.delete({ where: { id } });
        res.json({ message: 'Véhicule supprimé' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error deleting vehicle' });
    }
};

export const updatePushToken = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { pushToken } = req.body;

    try {
        await prisma.user.update({
            where: { id },
            data: { pushToken },
        });

        res.json({ message: 'Push token updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        await account().deleteAccount(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const blockUser = async (req: Request, res: Response) => {
    const { blockerId, blockedId } = req.body;
    try {
        // Check if already blocked to avoid unique constraint error
        const existing = await prisma.block.findUnique({
            where: {
                blockerId_blockedId: { blockerId, blockedId }
            }
        });

        if (existing) return res.json({ message: 'User already blocked' });

        await prisma.block.create({
            data: { blockerId, blockedId }
        });
        res.json({ message: 'User blocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error blocking user' });
    }
};

export const unblockUser = async (req: Request, res: Response) => {
    const { blockerId, blockedId } = req.body;
    try {
        await prisma.block.deleteMany({
            where: { blockerId, blockedId }
        });
        res.json({ message: 'User unblocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error unblocking user' });
    }
};

export const getBlockedUsers = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const blocks = await prisma.block.findMany({
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
            displayName: displayName(b.blocked.pseudo, b.blocked.vehicles[0]?.plate)
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching blocked users' });
    }
};
// Check relationship status (bidirectional block check)
export const getBlockStatus = async (req: Request, res: Response) => {
    const { userId, otherId } = req.params;

    try {
        const blocks = await prisma.block.findMany({
            where: {
                OR: [
                    { blockerId: userId, blockedId: otherId }, // I blocked them
                    { blockerId: otherId, blockedId: userId }  // They blocked me
                ]
            }
        });

        const blockedByMe = blocks.some(b => b.blockerId === userId);
        const blockedByOther = blocks.some(b => b.blockerId === otherId);

        res.json({ blockedByMe, blockedByOther });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching block status' });
    }
};

export const acceptTerms = async (req: Request, res: Response) => {
    try {
        if (!(await account().acceptTerms(req.params.id))) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json({ message: 'Conditions acceptées' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
