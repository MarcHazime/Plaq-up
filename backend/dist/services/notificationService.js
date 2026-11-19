"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
const sendPushNotification = async (pushToken, message, data) => {
    if (!expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        return;
    }
    const messages = [];
    messages.push({
        to: pushToken,
        sound: 'default',
        body: message,
        data: data || {},
    });
    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
    }
    catch (error) {
        console.error('Error sending push notification:', error);
    }
};
exports.sendPushNotification = sendPushNotification;
