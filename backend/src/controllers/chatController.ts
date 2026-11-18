import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildConversations } from '../domain/conversations';

const prisma = new PrismaClient();

export const getChatHistory = async (req: Request, res: Response) => {
    const { userId1, userId2 } = req.params;
    const { relatedPlate } = req.query;

    try {
        const whereClause: any = {
            OR: [
                { senderId: userId1, receiverId: userId2, deletedBySender: false },
                { senderId: userId2, receiverId: userId1, deletedByReceiver: false }
            ]
        };

        // if (relatedPlate) {
        //     whereClause.relatedPlate = relatedPlate;
        // }

        const finalMessages = await prisma.message.findMany({
            where: whereClause,
            orderBy: { createdAt: 'asc' }
        });

        res.json(finalMessages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteConversation = async (req: Request, res: Response) => {
    const { userId, partnerId } = req.params;

    try {
        // Mark messages sent by userId as deletedBySender
        await prisma.message.updateMany({
            where: { senderId: userId, receiverId: partnerId },
            data: { deletedBySender: true }
        });

        // Mark messages received by userId as deletedByReceiver
        await prisma.message.updateMany({
            where: { senderId: partnerId, receiverId: userId },
            data: { deletedByReceiver: true }
        });

        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserChats = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const myVehicles = await prisma.vehicle.findMany({
            where: { userId },
            select: { plate: true, isPrimary: true }
        });

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, deletedBySender: false },
                    { receiverId: userId, deletedByReceiver: false }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        vehicles: { where: { isPrimary: true }, select: { plate: true } }
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        vehicles: { where: { isPrimary: true }, select: { plate: true } }
                    }
                },
            }
        });

        res.json(buildConversations(userId, messages, myVehicles));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const markMessagesAsRead = async (req: Request, res: Response) => {
    const { userId, partnerId } = req.params;

    try {
        await prisma.message.updateMany({
            where: {
                receiverId: userId,
                senderId: partnerId,
                isRead: false
            },
            data: { isRead: true }
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

export const uploadImage = async (req: Request, res: Response) => {
    const multerReq = req as MulterRequest;
    if (!multerReq.file) {
        return res.status(400).json({ error: 'Aucune image téléchargée' });
    }

    // Return the URL of the uploaded image
    // Assuming server is running on localhost:3000 for now, client should prepend BASE_URL
    // But wait, client BASE_URL includes /api. 
    // We should return a relative path or full path. 
    // Let's return the relative path from root, client can construct full URL.
    const imageUrl = `/uploads/${multerReq.file.filename}`;
    res.json({ imageUrl });
};
