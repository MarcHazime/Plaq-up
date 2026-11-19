import { Request, Response } from 'express';
import { chat } from '../chat';
import type { AuthedRequest } from '../auth/middleware';

const serverError = (res: Response, error: unknown) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
};

export const getChatHistory = async (req: Request, res: Response) => {
    const { userId1, userId2 } = req.params;
    // The route guard guarantees the caller is one of the two: they are the viewer.
    const viewerId = (req as AuthedRequest).userId!;
    const partnerId = viewerId === userId1 ? userId2 : userId1;

    try {
        res.json(await chat.history(viewerId, partnerId));
    } catch (error) {
        serverError(res, error);
    }
};

export const deleteConversation = async (req: Request, res: Response) => {
    const { userId, partnerId } = req.params;

    try {
        await chat.deleteFor(userId, partnerId);
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        serverError(res, error);
    }
};

export const getUserChats = async (req: Request, res: Response) => {
    try {
        res.json(await chat.conversations(req.params.userId));
    } catch (error) {
        serverError(res, error);
    }
};

export const markMessagesAsRead = async (req: Request, res: Response) => {
    const { userId, partnerId } = req.params;

    try {
        await chat.markRead(userId, partnerId);
        res.json({ success: true });
    } catch (error) {
        serverError(res, error);
    }
};

export const getQuota = async (req: Request, res: Response) => {
    try {
        res.json(await chat.quota(req.params.userId));
    } catch (error) {
        serverError(res, error);
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

    // Relative path from the server root; the client prepends its base URL.
    const imageUrl = `/uploads/${multerReq.file.filename}`;
    res.json({ imageUrl });
};
