"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeFirebase = initializeFirebase;
exports.isFirebaseInitialized = isFirebaseInitialized;
exports.sendPushNotification = sendPushNotification;
exports.sendBatchNotifications = sendBatchNotifications;
exports.getNotificationTemplate = getNotificationTemplate;
exports.registerDeviceToken = registerDeviceToken;
exports.removeDeviceToken = removeDeviceToken;
exports.getUserDeviceTokens = getUserDeviceTokens;
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.scheduleNotification = scheduleNotification;
exports.cancelScheduledNotification = cancelScheduledNotification;
exports.getPendingNotifications = getPendingNotifications;
exports.markNotificationSent = markNotificationSent;
exports.logNotificationHistory = logNotificationHistory;
exports.shouldSendNotification = shouldSendNotification;
exports.processScheduledNotifications = processScheduledNotifications;
exports.sendDailyRewardNotification = sendDailyRewardNotification;
exports.sendEventNotification = sendEventNotification;
exports.sendPvpChallengeNotification = sendPvpChallengeNotification;
const config_1 = require("../config");
const logger_1 = require("../config/logger");
// Notification templates for different types
const NOTIFICATION_TEMPLATES = {
    daily_reward: {
        title: '🎁 Daily Rewards Await!',
        body: 'Your daily rewards are ready to claim. Come back and collect your gems!',
    },
    event: {
        title: '🎉 New Event Available!',
        body: 'A new event has started. Check it out and earn exclusive rewards!',
    },
    pvp_challenge: {
        title: '⚔️ PvP Challenge Ready!',
        body: 'Your opponents are waiting. Prove your skills in the arena!',
    },
    promotion: {
        title: '🔥 Special Offer!',
        body: 'Limited time offer! Get bonus gems with your purchase.',
    },
    custom: {
        title: '📢 Announcement',
        body: 'You have a new message from Armored Archer.',
    },
};
// Firebase Admin SDK instance
// Using unknown type - Firebase is optional and loaded dynamically via require
let firebaseMessaging = null;
let firebaseInitialized = false;
/**
 * Initialize Firebase Admin SDK for Cloud Messaging
 */
function initializeFirebase() {
    if (firebaseInitialized) {
        return true;
    }
    if (!config_1.config.firebase.enabled) {
        logger_1.logger.info('Firebase is disabled. Push notifications will not be available.');
        return false;
    }
    if (!config_1.config.firebase.projectId || !config_1.config.firebase.privateKey || !config_1.config.firebase.clientEmail) {
        logger_1.logger.warn('Firebase configuration incomplete. Push notifications will not be available.');
        logger_1.logger.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
        return false;
    }
    try {
        // Dynamic import to avoid issues when Firebase is not configured
        const admin = require('firebase-admin');
        const serviceAccount = {
            type: 'service_account',
            project_id: config_1.config.firebase.projectId,
            private_key: config_1.config.firebase.privateKey.replace(/\\n/g, '\n'),
            client_email: config_1.config.firebase.clientEmail,
        };
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: config_1.config.firebase.databaseUrl,
            });
        }
        firebaseMessaging = admin.messaging();
        firebaseInitialized = true;
        logger_1.logger.info('Firebase Admin SDK initialized successfully for Cloud Messaging');
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Firebase Admin SDK', { error: String(error) });
        return false;
    }
}
/**
 * Check if Firebase is initialized
 */
function isFirebaseInitialized() {
    return firebaseInitialized;
}
/**
 * Send a push notification to a device token
 */
async function sendPushNotification(deviceToken, title, body, data = {}, platform = 'android') {
    if (!firebaseInitialized || !firebaseMessaging) {
        return { success: false, error: 'Firebase not initialized' };
    }
    try {
        const payload = {
            notification: { title, body },
            data,
        };
        // Platform-specific configuration
        if (platform === 'android') {
            payload.android = {
                priority: 'high',
                notification: {
                    channel_id: 'armored_archer_notifications',
                    title,
                    body,
                },
            };
        }
        else if (platform === 'ios') {
            payload.apns = {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            };
        }
        const messageId = await firebaseMessaging.send({
            token: deviceToken,
            ...payload,
        });
        logger_1.logger.info('Push notification sent successfully', { messageId, platform });
        return { success: true, messageId };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to send push notification', { error: errorMessage, platform });
        return { success: false, error: errorMessage };
    }
}
/**
 * Send notification to multiple device tokens (batch)
 */
async function sendBatchNotifications(deviceTokens, title, body, data = {}) {
    if (!firebaseInitialized || !firebaseMessaging) {
        return { success: 0, failed: deviceTokens.length, errors: ['Firebase not initialized'] };
    }
    const errors = [];
    let successCount = 0;
    let failedCount = 0;
    // Firebase allows sending to up to 500 tokens at once
    const BATCH_SIZE = 500;
    const batches = [];
    for (let i = 0; i < deviceTokens.length; i += BATCH_SIZE) {
        batches.push(deviceTokens.slice(i, i + BATCH_SIZE));
    }
    for (const batch of batches) {
        try {
            const response = await firebaseMessaging.sendEachForMulticast({
                tokens: batch,
                notification: { title, body },
                data,
                android: {
                    priority: 'high',
                    notification: { channel_id: 'armored_archer_notifications' },
                },
                apns: {
                    payload: { aps: { sound: 'default' } },
                },
            });
            successCount += response.successCount;
            failedCount += response.failureCount;
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorMsg = resp.error?.message || 'Unknown error';
                    errors.push(`Token ${batch[idx]}: ${errorMsg}`);
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`Batch error: ${errorMessage}`);
            failedCount += batch.length;
        }
    }
    logger_1.logger.info('Batch notifications sent', { success: successCount, failed: failedCount });
    return { success: successCount, failed: failedCount, errors };
}
/**
 * Get notification template for a type
 */
function getNotificationTemplate(type) {
    return NOTIFICATION_TEMPLATES[type] || NOTIFICATION_TEMPLATES.custom;
}
/**
 * Register a device token for a user
 */
async function registerDeviceToken(nk, userId, deviceToken, platform, appVersion, fcmToken) {
    try {
        // Use raw SQL for device tokens table
        await nk.dbQuery(`INSERT INTO device_tokens (user_id, device_token, platform, app_version, fcm_token, updated_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (device_token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version,
         fcm_token = EXCLUDED.fcm_token,
         updated_at = NOW(),
         last_used_at = NOW()
       RETURNING token_id`, [userId, deviceToken, platform, appVersion || null, fcmToken || null]);
        logger_1.logger.info('Device token registered', { userId, platform });
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to register device token', { error: errorMessage });
        return { success: false, error: errorMessage };
    }
}
/**
 * Remove a device token
 */
async function removeDeviceToken(nk, deviceToken) {
    try {
        await nk.dbQuery(`DELETE FROM device_tokens WHERE device_token = $1`, [deviceToken]);
        logger_1.logger.info('Device token removed', { deviceToken });
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to remove device token', { error: errorMessage });
        return { success: false, error: errorMessage };
    }
}
/**
 * Get device tokens for a user
 */
async function getUserDeviceTokens(nk, userId) {
    try {
        const result = await nk.dbQuery(`SELECT device_token, platform, fcm_token FROM device_tokens WHERE user_id = $1`, [userId]);
        return result.map((row) => ({
            deviceToken: row.device_token,
            platform: row.platform,
            fcmToken: row.fcm_token,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get user device tokens', { error: String(error), userId });
        return [];
    }
}
/**
 * Get user notification preferences
 */
async function getNotificationPreferences(nk, userId) {
    try {
        const result = await nk.dbQuery(`SELECT * FROM notification_preferences WHERE user_id = $1`, [
            userId,
        ]);
        if (result.length === 0) {
            // Create default preferences
            const insertResult = await nk.dbQuery(`INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`, [userId]);
            return insertResult[0];
        }
        return result[0];
    }
    catch (error) {
        logger_1.logger.error('Failed to get notification preferences', { error: String(error), userId });
        return null;
    }
}
/**
 * Update user notification preferences
 */
async function updateNotificationPreferences(nk, userId, preferences) {
    try {
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (preferences.dailyRewardsEnabled !== undefined) {
            updates.push(`daily_rewards_enabled = $${paramIndex++}`);
            values.push(preferences.dailyRewardsEnabled);
        }
        if (preferences.eventsEnabled !== undefined) {
            updates.push(`events_enabled = $${paramIndex++}`);
            values.push(preferences.eventsEnabled);
        }
        if (preferences.pvpChallengesEnabled !== undefined) {
            updates.push(`pvp_challenges_enabled = $${paramIndex++}`);
            values.push(preferences.pvpChallengesEnabled);
        }
        if (preferences.promotionsEnabled !== undefined) {
            updates.push(`promotions_enabled = $${paramIndex++}`);
            values.push(preferences.promotionsEnabled);
        }
        if (preferences.notificationsEnabled !== undefined) {
            updates.push(`notifications_enabled = $${paramIndex++}`);
            values.push(preferences.notificationsEnabled);
        }
        if (preferences.quietHoursEnabled !== undefined) {
            updates.push(`quiet_hours_enabled = $${paramIndex++}`);
            values.push(preferences.quietHoursEnabled);
        }
        if (preferences.quietHoursStart !== undefined) {
            updates.push(`quiet_hours_start = $${paramIndex++}`);
            values.push(preferences.quietHoursStart);
        }
        if (preferences.quietHoursEnd !== undefined) {
            updates.push(`quiet_hours_end = $${paramIndex++}`);
            values.push(preferences.quietHoursEnd);
        }
        if (preferences.timezone !== undefined) {
            updates.push(`timezone = $${paramIndex++}`);
            values.push(preferences.timezone);
        }
        if (updates.length === 0) {
            return { success: false, error: 'No preferences to update' };
        }
        updates.push(`updated_at = NOW()`);
        values.push(userId);
        await nk.dbQuery(`UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`, values);
        logger_1.logger.info('Notification preferences updated', { userId });
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to update notification preferences', { error: errorMessage, userId });
        return { success: false, error: errorMessage };
    }
}
/**
 * Schedule a notification for a user
 */
async function scheduleNotification(nk, userId, type, title, body, scheduledFor, data = {}) {
    try {
        const result = (await nk.dbQuery(`INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING notification_id`, [userId, type, title, body, JSON.stringify(data), scheduledFor.toISOString()]));
        logger_1.logger.info('Notification scheduled', { userId, type, scheduledFor });
        return { success: true, notificationId: result[0]?.notification_id };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to schedule notification', { error: errorMessage, userId });
        return { success: false, error: errorMessage };
    }
}
/**
 * Cancel a scheduled notification
 */
async function cancelScheduledNotification(nk, notificationId) {
    try {
        await nk.dbQuery(`UPDATE scheduled_notifications SET status = 'cancelled', updated_at = NOW() 
       WHERE notification_id = $1 AND status = 'pending'`, [notificationId]);
        logger_1.logger.info('Scheduled notification cancelled', { notificationId });
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to cancel notification', { error: errorMessage, notificationId });
        return { success: false, error: errorMessage };
    }
}
/**
 * Get pending scheduled notifications to send
 */
async function getPendingNotifications(nk, limit = 100) {
    try {
        const result = await nk.dbQuery(`SELECT * FROM scheduled_notifications 
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC
       LIMIT $1`, [limit]);
        return result;
    }
    catch (error) {
        logger_1.logger.error('Failed to get pending notifications', { error: String(error) });
        return [];
    }
}
/**
 * Mark notification as sent
 */
async function markNotificationSent(nk, notificationId, success, errorMessage) {
    try {
        await nk.dbQuery(`UPDATE scheduled_notifications 
       SET status = $1, sent_at = NOW(), error_message = $2, updated_at = NOW()
       WHERE notification_id = $3`, [success ? 'sent' : 'failed', errorMessage || null, notificationId]);
    }
    catch (error) {
        logger_1.logger.error('Failed to mark notification sent', { error: String(error), notificationId });
    }
}
/**
 * Log notification to history
 */
async function logNotificationHistory(nk, notificationId, userId, notificationType, title, body, deviceToken, status, errorMessage) {
    try {
        await nk.dbQuery(`INSERT INTO notification_history 
       (notification_id, user_id, notification_type, title, body, device_token, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            notificationId,
            userId,
            notificationType,
            title,
            body,
            deviceToken,
            status,
            errorMessage || null,
        ]);
    }
    catch (error) {
        logger_1.logger.error('Failed to log notification history', { error: String(error) });
    }
}
/**
 * Check if user should receive notification based on preferences
 */
async function shouldSendNotification(nk, userId, notificationType) {
    try {
        const prefs = await getNotificationPreferences(nk, userId);
        if (!prefs) {
            return true; // Default to sending if no preferences
        }
        // Check master toggle
        if (!prefs.notifications_enabled) {
            return false;
        }
        // Check type-specific preferences
        switch (notificationType) {
            case 'daily_reward':
                return !!prefs.daily_rewards_enabled;
            case 'event':
                return !!prefs.events_enabled;
            case 'pvp_challenge':
                return !!prefs.pvp_challenges_enabled;
            case 'promotion':
                return !!prefs.promotions_enabled;
            default:
                return true;
        }
    }
    catch (error) {
        logger_1.logger.error('Error checking notification preferences', { error: String(error), userId });
        return true; // Default to sending on error
    }
}
/**
 * Process and send pending scheduled notifications
 */
async function processScheduledNotifications(nk) {
    const pending = await getPendingNotifications(nk, 100);
    let sent = 0;
    let failed = 0;
    for (const notification of pending) {
        // Check user preferences
        const shouldSend = await shouldSendNotification(nk, notification.user_id, notification.notification_type);
        if (!shouldSend) {
            await markNotificationSent(nk, notification.notification_id, true);
            sent++;
            continue;
        }
        // Get user's device tokens
        const deviceTokens = await getUserDeviceTokens(nk, notification.user_id);
        if (deviceTokens.length === 0) {
            await markNotificationSent(nk, notification.notification_id, false, 'No device tokens');
            failed++;
            continue;
        }
        // Send to all devices
        const tokens = deviceTokens.map((t) => t.fcmToken || t.deviceToken);
        const result = await sendBatchNotifications(tokens, notification.title, notification.body, notification.data || {});
        // Log to history
        for (const token of tokens) {
            await logNotificationHistory(nk, notification.notification_id, notification.user_id, notification.notification_type, notification.title, notification.body, token, result.failed > 0 ? 'failed' : 'sent', result.errors[0]);
        }
        await markNotificationSent(nk, notification.notification_id, result.success > 0, result.errors.join('; '));
        sent += result.success;
        failed += result.failed;
    }
    return { sent, failed };
}
/**
 * Send daily reward notification to a user
 */
async function sendDailyRewardNotification(nk, userId) {
    const shouldSend = await shouldSendNotification(nk, userId, 'daily_reward');
    if (!shouldSend) {
        return { success: false, error: 'User disabled daily reward notifications' };
    }
    const template = getNotificationTemplate('daily_reward');
    const deviceTokens = await getUserDeviceTokens(nk, userId);
    if (deviceTokens.length === 0) {
        return { success: false, error: 'No device tokens' };
    }
    const tokens = deviceTokens.map((t) => t.fcmToken || t.deviceToken);
    const result = await sendBatchNotifications(tokens, template.title, template.body, {
        type: 'daily_reward',
        action: 'claim_rewards',
    });
    return {
        success: result.success > 0,
        error: result.errors.join('; '),
    };
}
/**
 * Send event notification to a user
 */
async function sendEventNotification(nk, userId, eventName, eventId) {
    const shouldSend = await shouldSendNotification(nk, userId, 'event');
    if (!shouldSend) {
        return { success: false, error: 'User disabled event notifications' };
    }
    const template = getNotificationTemplate('event');
    const deviceTokens = await getUserDeviceTokens(nk, userId);
    if (deviceTokens.length === 0) {
        return { success: false, error: 'No device tokens' };
    }
    const tokens = deviceTokens.map((t) => t.fcmToken || t.deviceToken);
    const result = await sendBatchNotifications(tokens, `🎉 ${eventName}`, template.body, {
        type: 'event',
        eventId,
        action: 'view_event',
    });
    return {
        success: result.success > 0,
        error: result.errors.join('; '),
    };
}
/**
 * Send PvP challenge notification to a user
 */
async function sendPvpChallengeNotification(nk, userId, opponentName) {
    const shouldSend = await shouldSendNotification(nk, userId, 'pvp_challenge');
    if (!shouldSend) {
        return { success: false, error: 'User disabled PvP challenge notifications' };
    }
    const template = getNotificationTemplate('pvp_challenge');
    const deviceTokens = await getUserDeviceTokens(nk, userId);
    if (deviceTokens.length === 0) {
        return { success: false, error: 'No device tokens' };
    }
    const tokens = deviceTokens.map((t) => t.fcmToken || t.deviceToken);
    const result = await sendBatchNotifications(tokens, template.title, `${opponentName} is waiting for you in the arena!`, {
        type: 'pvp_challenge',
        action: 'join_arena',
    });
    return {
        success: result.success > 0,
        error: result.errors.join('; '),
    };
}
