import { Router } from 'express';
import { getChatHistory, getUserChats, uploadImage, deleteConversation, markMessagesAsRead } from '../controllers/chatController';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
import { requireAuth, requireSelf, requireParty } from '../auth/middleware';

const router = Router();
router.use(requireAuth);

router.get('/history/:userId1/:userId2', requireParty('userId1', 'userId2'), getChatHistory);
router.get('/list/:userId', requireSelf('userId'), getUserChats);
router.post('/upload', upload.single('image'), uploadImage);
router.delete('/:userId/:partnerId', requireSelf('userId'), deleteConversation);
router.put('/read/:userId/:partnerId', requireSelf('userId'), markMessagesAsRead);

export default router;
