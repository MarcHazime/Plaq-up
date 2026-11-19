"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = exports.getQuota = exports.markMessagesAsRead = exports.getUserChats = exports.deleteConversation = exports.getChatHistory = void 0;
const chat_1 = require("../chat");
const serverError = (res, error) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
};
const getChatHistory = async (req, res) => {
    const { userId1, userId2 } = req.params;
    // The route guard guarantees the caller is one of the two: they are the viewer.
    const viewerId = req.userId;
    const partnerId = viewerId === userId1 ? userId2 : userId1;
    try {
        res.json(await chat_1.chat.history(viewerId, partnerId));
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.getChatHistory = getChatHistory;
const deleteConversation = async (req, res) => {
    const { userId, partnerId } = req.params;
    try {
        await chat_1.chat.deleteFor(userId, partnerId);
        res.json({ message: 'Conversation deleted' });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.deleteConversation = deleteConversation;
const getUserChats = async (req, res) => {
    try {
        res.json(await chat_1.chat.conversations(req.params.userId));
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.getUserChats = getUserChats;
const markMessagesAsRead = async (req, res) => {
    const { userId, partnerId } = req.params;
    try {
        await chat_1.chat.markRead(userId, partnerId);
        res.json({ success: true });
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.markMessagesAsRead = markMessagesAsRead;
const getQuota = async (req, res) => {
    try {
        res.json(await chat_1.chat.quota(req.params.userId));
    }
    catch (error) {
        serverError(res, error);
    }
};
exports.getQuota = getQuota;
const uploadImage = async (req, res) => {
    const multerReq = req;
    if (!multerReq.file) {
        return res.status(400).json({ error: 'Aucune image téléchargée' });
    }
    // Relative path from the server root; the client prepends its base URL.
    const imageUrl = `/uploads/${multerReq.file.filename}`;
    res.json({ imageUrl });
};
exports.uploadImage = uploadImage;
