import { Request, Response } from 'express';
import { chat } from '../chat';
import { images } from '../images';
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
        const history = await chat.history(viewerId, partnerId);
        // Read links are made now, for this viewer, and last an hour.
        res.json(await images().present(viewerId, history));
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

const UPLOAD_ERRORS = {
    storage_unavailable: [503, "L'envoi d'images est momentanément indisponible"],
    too_large: [413, 'Image trop lourde (2 Mo maximum)'],
    unsupported_type: [415, 'Format non pris en charge (JPEG, PNG ou WebP)'],
    user_daily_limit: [429, "Limite d'images atteinte pour aujourd'hui, réessayez demain"],
    storage_full: [503, "L'envoi d'images est momentanément indisponible"],
    monthly_limit: [503, "L'envoi d'images est momentanément indisponible"],
} as const;

export const uploadImage = async (req: Request, res: Response) => {
    const file = (req as MulterRequest).file;
    if (!file) {
        return res.status(400).json({ error: 'Aucune image téléchargée' });
    }

    try {
        const result = await images().upload({ ownerId: (req as AuthedRequest).userId!, data: file.buffer });
        if (!result.ok) {
            const [status, error] = UPLOAD_ERRORS[result.reason];
            return res.status(status).json({ error, reason: result.reason });
        }
        // The app sends the imageId with its message; imageUrl is a preview link for the sender.
        res.json({ imageId: result.imageId, imageUrl: await images().urlFor(result.imageId) });
    } catch (error) {
        serverError(res, error);
    }
};
