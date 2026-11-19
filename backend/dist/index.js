"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const token_1 = require("./auth/token");
(0, token_1.assertAuthConfigured)();
const account_1 = require("./account");
(0, account_1.assertAccountConfigured)();
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_1 = require("./socket");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uploadDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir);
}
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGIN || "*", // Use env var or allow all
        methods: ["GET", "POST"]
    }
});
exports.io = io;
(0, socket_1.setupSocket)(io);
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const sivRoutes_1 = __importDefault(require("./routes/sivRoutes"));
const moderationRoutes_1 = require("./routes/moderationRoutes");
// Security Middlewares
app.use((0, helmet_1.default)());
// Rate limiting: 100 requests per 15 minutes
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGIN || "*", // Use env var or allow all
}));
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static('uploads'));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/chats', chatRoutes_1.default);
app.use('/api/siv', sivRoutes_1.default); // Register SIV routes
app.use('/api/reports', moderationRoutes_1.reportRoutes);
app.use('/api/admin', moderationRoutes_1.adminRoutes);
// Administration page: static files, the data behind it needs an administrator token.
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'admin')));
app.get('/', (req, res) => {
    res.send('License Plate App API is running');
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
