import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import { initMonitoring, Sentry } from './monitoring';
initMonitoring();

import { assertAuthConfigured } from './auth/token';
assertAuthConfigured();
import { assertAccountConfigured } from './account';
assertAccountConfigured();
import { assertImagesConfigured, startImageSweeper } from './images';
assertImagesConfigured();

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { setupSocket } from './socket';
import { installPage } from './install';

import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGIN || "*", // Use env var or allow all
        methods: ["GET", "POST"]
    }
});

setupSocket(io);

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';
import sivRoutes from './routes/sivRoutes';
import { reportRoutes, adminRoutes } from './routes/moderationRoutes';

// Security Middlewares
app.use(helmet());

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*", // Use env var or allow all
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/siv', sivRoutes); // Register SIV routes
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
// Administration page: static files, the data behind it needs an administrator token.
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

// Legal pages (privacy policy, terms, account deletion): static, public, linked from the app and the stores.
app.get('/app', installPage);
app.use('/legal', express.static(path.join(__dirname, '..', 'public', 'legal')));

app.get('/', (req, res) => {
    res.send('License Plate App API is running');
});

// After all routes: reports unhandled errors (no-op when Sentry is not configured).
Sentry.setupExpressErrorHandler(app);

const PORT = process.env.PORT || 3000;

startImageSweeper();

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export { io };
