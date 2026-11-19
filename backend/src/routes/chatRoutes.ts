import { RequestHandler, Router } from 'express';
import { getChatHistory, getUserChats, uploadImage, deleteConversation, markMessagesAsRead, getQuota } from '../controllers/chatController';
import multer from 'multer';
import { DEFAULT_CONFIG } from '../images/images';

// Files stay in memory: they go straight to the private bucket, never to the server's disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DEFAULT_CONFIG.maxBytes + 1, files: 1 } });

/** Turns multer's size error into the same answer as the module's own check. */
const uploadOne: RequestHandler = (req, res, next) => {
    upload.single('image')(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Image trop lourde (2 Mo maximum)', reason: 'too_large' });
        }
        if (error) return next(error);
        next();
    });
};
import { requireActive } from '../auth';
import { requireAuth, requireSelf, requireParty } from '../auth/middleware';

const router = Router();
router.use(requireAuth, requireActive);

router.get('/history/:userId1/:userId2', requireParty('userId1', 'userId2'), getChatHistory);
router.get('/list/:userId', requireSelf('userId'), getUserChats);
router.get('/quota/:userId', requireSelf('userId'), getQuota);
router.post('/upload', uploadOne, uploadImage);
router.delete('/:userId/:partnerId', requireSelf('userId'), deleteConversation);
router.put('/read/:userId/:partnerId', requireSelf('userId'), markMessagesAsRead);

export default router;
