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
var tslib_1 = require("tslib");
var config_1 = require("../config");
var logger_1 = require("../config/logger");
// Notification templates for different types
var NOTIFICATION_TEMPLATES = {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var firebaseMessaging = null;
var firebaseInitialized = false;
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        var admin = require('firebase-admin');
        var serviceAccount = {
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
function sendPushNotification(deviceToken_1, title_1, body_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (deviceToken, title, body, data, platform) {
        var payload, messageId, error_1, errorMessage;
        if (data === void 0) { data = {}; }
        if (platform === void 0) { platform = 'android'; }
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!firebaseInitialized || !firebaseMessaging) {
                        return [2 /*return*/, { success: false, error: 'Firebase not initialized' }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    payload = {
                        notification: { title: title, body: body },
                        data: data,
                    };
                    // Platform-specific configuration
                    if (platform === 'android') {
                        payload.android = {
                            priority: 'high',
                            notification: {
                                channel_id: 'armored_archer_notifications',
                                title: title,
                                body: body,
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
                    return [4 /*yield*/, firebaseMessaging.send(tslib_1.__assign({ token: deviceToken }, payload))];
                case 2:
                    messageId = _a.sent();
                    logger_1.logger.info('Push notification sent successfully', { messageId: messageId, platform: platform });
                    return [2 /*return*/, { success: true, messageId: messageId }];
                case 3:
                    error_1 = _a.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    logger_1.logger.error('Failed to send push notification', { error: errorMessage, platform: platform });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send notification to multiple device tokens (batch)
 */
function sendBatchNotifications(deviceTokens_1, title_1, body_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (deviceTokens, title, body, data) {
        var errors, successCount, failedCount, BATCH_SIZE, batches, i, _loop_1, batches_1, batches_1_1, batch, e_1_1;
        var e_1, _a;
        if (data === void 0) { data = {}; }
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!firebaseInitialized || !firebaseMessaging) {
                        return [2 /*return*/, { success: 0, failed: deviceTokens.length, errors: ['Firebase not initialized'] }];
                    }
                    errors = [];
                    successCount = 0;
                    failedCount = 0;
                    BATCH_SIZE = 500;
                    batches = [];
                    for (i = 0; i < deviceTokens.length; i += BATCH_SIZE) {
                        batches.push(deviceTokens.slice(i, i + BATCH_SIZE));
                    }
                    _loop_1 = function (batch) {
                        var response, error_2, errorMessage;
                        return tslib_1.__generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, firebaseMessaging.sendEachForMulticast({
                                            tokens: batch,
                                            notification: { title: title, body: body },
                                            data: data,
                                            android: {
                                                priority: 'high',
                                                notification: { channel_id: 'armored_archer_notifications' },
                                            },
                                            apns: {
                                                payload: { aps: { sound: 'default' } },
                                            },
                                        })];
                                case 1:
                                    response = _c.sent();
                                    successCount += response.successCount;
                                    failedCount += response.failureCount;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    response.responses.forEach(function (resp, idx) {
                                        var _a;
                                        if (!resp.success) {
                                            var errorMsg = ((_a = resp.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error';
                                            errors.push("Token ".concat(batch[idx], ": ").concat(errorMsg));
                                        }
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_2 = _c.sent();
                                    errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                                    errors.push("Batch error: ".concat(errorMessage));
                                    failedCount += batch.length;
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    batches_1 = tslib_1.__values(batches), batches_1_1 = batches_1.next();
                    _b.label = 2;
                case 2:
                    if (!!batches_1_1.done) return [3 /*break*/, 5];
                    batch = batches_1_1.value;
                    return [5 /*yield**/, _loop_1(batch)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    batches_1_1 = batches_1.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _b.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (batches_1_1 && !batches_1_1.done && (_a = batches_1.return)) _a.call(batches_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8:
                    logger_1.logger.info('Batch notifications sent', { success: successCount, failed: failedCount });
                    return [2 /*return*/, { success: successCount, failed: failedCount, errors: errors }];
            }
        });
    });
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
function registerDeviceToken(nk, userId, deviceToken, platform, appVersion, fcmToken) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_3, errorMessage;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Use raw SQL for device tokens table
                    return [4 /*yield*/, nk.dbQuery("INSERT INTO device_tokens (user_id, device_token, platform, app_version, fcm_token, updated_at, last_used_at)\n       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())\n       ON CONFLICT (device_token) DO UPDATE SET\n         user_id = EXCLUDED.user_id,\n         platform = EXCLUDED.platform,\n         app_version = EXCLUDED.app_version,\n         fcm_token = EXCLUDED.fcm_token,\n         updated_at = NOW(),\n         last_used_at = NOW()\n       RETURNING token_id", [userId, deviceToken, platform, appVersion || null, fcmToken || null])];
                case 1:
                    // Use raw SQL for device tokens table
                    _a.sent();
                    logger_1.logger.info('Device token registered', { userId: userId, platform: platform });
                    return [2 /*return*/, { success: true }];
                case 2:
                    error_3 = _a.sent();
                    errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                    logger_1.logger.error('Failed to register device token', { error: errorMessage });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Remove a device token
 */
function removeDeviceToken(nk, deviceToken) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_4, errorMessage;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("DELETE FROM device_tokens WHERE device_token = $1", [deviceToken])];
                case 1:
                    _a.sent();
                    logger_1.logger.info('Device token removed', { deviceToken: deviceToken });
                    return [2 /*return*/, { success: true }];
                case 2:
                    error_4 = _a.sent();
                    errorMessage = error_4 instanceof Error ? error_4.message : String(error_4);
                    logger_1.logger.error('Failed to remove device token', { error: errorMessage });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get device tokens for a user
 */
function getUserDeviceTokens(nk, userId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var result, error_5;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("SELECT device_token, platform, fcm_token FROM device_tokens WHERE user_id = $1", [userId])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.map(function (row) { return ({
                            deviceToken: row.device_token,
                            platform: row.platform,
                            fcmToken: row.fcm_token,
                        }); })];
                case 2:
                    error_5 = _a.sent();
                    logger_1.logger.error('Failed to get user device tokens', { error: String(error_5), userId: userId });
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user notification preferences
 */
function getNotificationPreferences(nk, userId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var result, insertResult, error_6;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, nk.dbQuery("SELECT * FROM notification_preferences WHERE user_id = $1", [
                            userId,
                        ])];
                case 1:
                    result = _a.sent();
                    if (!(result.length === 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, nk.dbQuery("INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *", [userId])];
                case 2:
                    insertResult = _a.sent();
                    return [2 /*return*/, insertResult[0]];
                case 3: return [2 /*return*/, result[0]];
                case 4:
                    error_6 = _a.sent();
                    logger_1.logger.error('Failed to get notification preferences', { error: String(error_6), userId: userId });
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Update user notification preferences
 */
function updateNotificationPreferences(nk, userId, preferences) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var updates, values, paramIndex, error_7, errorMessage;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    updates = [];
                    values = [];
                    paramIndex = 1;
                    if (preferences.dailyRewardsEnabled !== undefined) {
                        updates.push("daily_rewards_enabled = $".concat(paramIndex++));
                        values.push(preferences.dailyRewardsEnabled);
                    }
                    if (preferences.eventsEnabled !== undefined) {
                        updates.push("events_enabled = $".concat(paramIndex++));
                        values.push(preferences.eventsEnabled);
                    }
                    if (preferences.pvpChallengesEnabled !== undefined) {
                        updates.push("pvp_challenges_enabled = $".concat(paramIndex++));
                        values.push(preferences.pvpChallengesEnabled);
                    }
                    if (preferences.promotionsEnabled !== undefined) {
                        updates.push("promotions_enabled = $".concat(paramIndex++));
                        values.push(preferences.promotionsEnabled);
                    }
                    if (preferences.notificationsEnabled !== undefined) {
                        updates.push("notifications_enabled = $".concat(paramIndex++));
                        values.push(preferences.notificationsEnabled);
                    }
                    if (preferences.quietHoursEnabled !== undefined) {
                        updates.push("quiet_hours_enabled = $".concat(paramIndex++));
                        values.push(preferences.quietHoursEnabled);
                    }
                    if (preferences.quietHoursStart !== undefined) {
                        updates.push("quiet_hours_start = $".concat(paramIndex++));
                        values.push(preferences.quietHoursStart);
                    }
                    if (preferences.quietHoursEnd !== undefined) {
                        updates.push("quiet_hours_end = $".concat(paramIndex++));
                        values.push(preferences.quietHoursEnd);
                    }
                    if (preferences.timezone !== undefined) {
                        updates.push("timezone = $".concat(paramIndex++));
                        values.push(preferences.timezone);
                    }
                    if (updates.length === 0) {
                        return [2 /*return*/, { success: false, error: 'No preferences to update' }];
                    }
                    updates.push("updated_at = NOW()");
                    values.push(userId);
                    return [4 /*yield*/, nk.dbQuery("UPDATE notification_preferences SET ".concat(updates.join(', '), " WHERE user_id = $").concat(paramIndex), values)];
                case 1:
                    _a.sent();
                    logger_1.logger.info('Notification preferences updated', { userId: userId });
                    return [2 /*return*/, { success: true }];
                case 2:
                    error_7 = _a.sent();
                    errorMessage = error_7 instanceof Error ? error_7.message : String(error_7);
                    logger_1.logger.error('Failed to update notification preferences', { error: errorMessage, userId: userId });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Schedule a notification for a user
 */
function scheduleNotification(nk_1, userId_1, type_1, title_1, body_1, scheduledFor_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (nk, userId, type, title, body, scheduledFor, data) {
        var result, error_8, errorMessage;
        var _a;
        if (data === void 0) { data = {}; }
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)\n       VALUES ($1, $2, $3, $4, $5, $6, 'pending')\n       RETURNING notification_id", [userId, type, title, body, JSON.stringify(data), scheduledFor.toISOString()])];
                case 1:
                    result = (_b.sent());
                    logger_1.logger.info('Notification scheduled', { userId: userId, type: type, scheduledFor: scheduledFor });
                    return [2 /*return*/, { success: true, notificationId: (_a = result[0]) === null || _a === void 0 ? void 0 : _a.notification_id }];
                case 2:
                    error_8 = _b.sent();
                    errorMessage = error_8 instanceof Error ? error_8.message : String(error_8);
                    logger_1.logger.error('Failed to schedule notification', { error: errorMessage, userId: userId });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Cancel a scheduled notification
 */
function cancelScheduledNotification(nk, notificationId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_9, errorMessage;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("UPDATE scheduled_notifications SET status = 'cancelled', updated_at = NOW() \n       WHERE notification_id = $1 AND status = 'pending'", [notificationId])];
                case 1:
                    _a.sent();
                    logger_1.logger.info('Scheduled notification cancelled', { notificationId: notificationId });
                    return [2 /*return*/, { success: true }];
                case 2:
                    error_9 = _a.sent();
                    errorMessage = error_9 instanceof Error ? error_9.message : String(error_9);
                    logger_1.logger.error('Failed to cancel notification', { error: errorMessage, notificationId: notificationId });
                    return [2 /*return*/, { success: false, error: errorMessage }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get pending scheduled notifications to send
 */
function getPendingNotifications(nk_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (nk, limit) {
        var result, error_10;
        if (limit === void 0) { limit = 100; }
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("SELECT * FROM scheduled_notifications \n       WHERE status = 'pending' AND scheduled_for <= NOW()\n       ORDER BY scheduled_for ASC\n       LIMIT $1", [limit])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 2:
                    error_10 = _a.sent();
                    logger_1.logger.error('Failed to get pending notifications', { error: String(error_10) });
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Mark notification as sent
 */
function markNotificationSent(nk, notificationId, success, errorMessage) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_11;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("UPDATE scheduled_notifications \n       SET status = $1, sent_at = NOW(), error_message = $2, updated_at = NOW()\n       WHERE notification_id = $3", [success ? 'sent' : 'failed', errorMessage || null, notificationId])];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_11 = _a.sent();
                    logger_1.logger.error('Failed to mark notification sent', { error: String(error_11), notificationId: notificationId });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Log notification to history
 */
function logNotificationHistory(nk, notificationId, userId, notificationType, title, body, deviceToken, status, errorMessage) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_12;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("INSERT INTO notification_history \n       (notification_id, user_id, notification_type, title, body, device_token, status, error_message)\n       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
                            notificationId,
                            userId,
                            notificationType,
                            title,
                            body,
                            deviceToken,
                            status,
                            errorMessage || null,
                        ])];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_12 = _a.sent();
                    logger_1.logger.error('Failed to log notification history', { error: String(error_12) });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if user should receive notification based on preferences
 */
function shouldSendNotification(nk, userId, notificationType) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var prefs, error_13;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getNotificationPreferences(nk, userId)];
                case 1:
                    prefs = _a.sent();
                    if (!prefs) {
                        return [2 /*return*/, true]; // Default to sending if no preferences
                    }
                    // Check master toggle
                    if (!prefs.notifications_enabled) {
                        return [2 /*return*/, false];
                    }
                    // Check type-specific preferences
                    switch (notificationType) {
                        case 'daily_reward':
                            return [2 /*return*/, !!prefs.daily_rewards_enabled];
                        case 'event':
                            return [2 /*return*/, !!prefs.events_enabled];
                        case 'pvp_challenge':
                            return [2 /*return*/, !!prefs.pvp_challenges_enabled];
                        case 'promotion':
                            return [2 /*return*/, !!prefs.promotions_enabled];
                        default:
                            return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_13 = _a.sent();
                    logger_1.logger.error('Error checking notification preferences', { error: String(error_13), userId: userId });
                    return [2 /*return*/, true]; // Default to sending on error
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Process and send pending scheduled notifications
 */
function processScheduledNotifications(nk) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var pending, sent, failed, pending_1, pending_1_1, notification, shouldSend, deviceTokens, tokens, result, tokens_1, tokens_1_1, token, e_2_1, e_3_1;
        var e_3, _a, e_2, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getPendingNotifications(nk, 100)];
                case 1:
                    pending = _c.sent();
                    sent = 0;
                    failed = 0;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 22, 23, 24]);
                    pending_1 = tslib_1.__values(pending), pending_1_1 = pending_1.next();
                    _c.label = 3;
                case 3:
                    if (!!pending_1_1.done) return [3 /*break*/, 21];
                    notification = pending_1_1.value;
                    return [4 /*yield*/, shouldSendNotification(nk, notification.user_id, notification.notification_type)];
                case 4:
                    shouldSend = _c.sent();
                    if (!!shouldSend) return [3 /*break*/, 6];
                    return [4 /*yield*/, markNotificationSent(nk, notification.notification_id, true)];
                case 5:
                    _c.sent();
                    sent++;
                    return [3 /*break*/, 20];
                case 6: return [4 /*yield*/, getUserDeviceTokens(nk, notification.user_id)];
                case 7:
                    deviceTokens = _c.sent();
                    if (!(deviceTokens.length === 0)) return [3 /*break*/, 9];
                    return [4 /*yield*/, markNotificationSent(nk, notification.notification_id, false, 'No device tokens')];
                case 8:
                    _c.sent();
                    failed++;
                    return [3 /*break*/, 20];
                case 9:
                    tokens = deviceTokens.map(function (t) { return t.fcmToken || t.deviceToken; });
                    return [4 /*yield*/, sendBatchNotifications(tokens, notification.title, notification.body, notification.data || {})];
                case 10:
                    result = _c.sent();
                    _c.label = 11;
                case 11:
                    _c.trys.push([11, 16, 17, 18]);
                    tokens_1 = (e_2 = void 0, tslib_1.__values(tokens)), tokens_1_1 = tokens_1.next();
                    _c.label = 12;
                case 12:
                    if (!!tokens_1_1.done) return [3 /*break*/, 15];
                    token = tokens_1_1.value;
                    return [4 /*yield*/, logNotificationHistory(nk, notification.notification_id, notification.user_id, notification.notification_type, notification.title, notification.body, token, result.failed > 0 ? 'failed' : 'sent', result.errors[0])];
                case 13:
                    _c.sent();
                    _c.label = 14;
                case 14:
                    tokens_1_1 = tokens_1.next();
                    return [3 /*break*/, 12];
                case 15: return [3 /*break*/, 18];
                case 16:
                    e_2_1 = _c.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 18];
                case 17:
                    try {
                        if (tokens_1_1 && !tokens_1_1.done && (_b = tokens_1.return)) _b.call(tokens_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                    return [7 /*endfinally*/];
                case 18: return [4 /*yield*/, markNotificationSent(nk, notification.notification_id, result.success > 0, result.errors.join('; '))];
                case 19:
                    _c.sent();
                    sent += result.success;
                    failed += result.failed;
                    _c.label = 20;
                case 20:
                    pending_1_1 = pending_1.next();
                    return [3 /*break*/, 3];
                case 21: return [3 /*break*/, 24];
                case 22:
                    e_3_1 = _c.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 24];
                case 23:
                    try {
                        if (pending_1_1 && !pending_1_1.done && (_a = pending_1.return)) _a.call(pending_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                    return [7 /*endfinally*/];
                case 24: return [2 /*return*/, { sent: sent, failed: failed }];
            }
        });
    });
}
/**
 * Send daily reward notification to a user
 */
function sendDailyRewardNotification(nk, userId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var shouldSend, template, deviceTokens, tokens, result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, shouldSendNotification(nk, userId, 'daily_reward')];
                case 1:
                    shouldSend = _a.sent();
                    if (!shouldSend) {
                        return [2 /*return*/, { success: false, error: 'User disabled daily reward notifications' }];
                    }
                    template = getNotificationTemplate('daily_reward');
                    return [4 /*yield*/, getUserDeviceTokens(nk, userId)];
                case 2:
                    deviceTokens = _a.sent();
                    if (deviceTokens.length === 0) {
                        return [2 /*return*/, { success: false, error: 'No device tokens' }];
                    }
                    tokens = deviceTokens.map(function (t) { return t.fcmToken || t.deviceToken; });
                    return [4 /*yield*/, sendBatchNotifications(tokens, template.title, template.body, {
                            type: 'daily_reward',
                            action: 'claim_rewards',
                        })];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: result.success > 0,
                            error: result.errors.join('; '),
                        }];
            }
        });
    });
}
/**
 * Send event notification to a user
 */
function sendEventNotification(nk, userId, eventName, eventId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var shouldSend, template, deviceTokens, tokens, result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, shouldSendNotification(nk, userId, 'event')];
                case 1:
                    shouldSend = _a.sent();
                    if (!shouldSend) {
                        return [2 /*return*/, { success: false, error: 'User disabled event notifications' }];
                    }
                    template = getNotificationTemplate('event');
                    return [4 /*yield*/, getUserDeviceTokens(nk, userId)];
                case 2:
                    deviceTokens = _a.sent();
                    if (deviceTokens.length === 0) {
                        return [2 /*return*/, { success: false, error: 'No device tokens' }];
                    }
                    tokens = deviceTokens.map(function (t) { return t.fcmToken || t.deviceToken; });
                    return [4 /*yield*/, sendBatchNotifications(tokens, "\uD83C\uDF89 ".concat(eventName), template.body, {
                            type: 'event',
                            eventId: eventId,
                            action: 'view_event',
                        })];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: result.success > 0,
                            error: result.errors.join('; '),
                        }];
            }
        });
    });
}
/**
 * Send PvP challenge notification to a user
 */
function sendPvpChallengeNotification(nk, userId, opponentName) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var shouldSend, template, deviceTokens, tokens, result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, shouldSendNotification(nk, userId, 'pvp_challenge')];
                case 1:
                    shouldSend = _a.sent();
                    if (!shouldSend) {
                        return [2 /*return*/, { success: false, error: 'User disabled PvP challenge notifications' }];
                    }
                    template = getNotificationTemplate('pvp_challenge');
                    return [4 /*yield*/, getUserDeviceTokens(nk, userId)];
                case 2:
                    deviceTokens = _a.sent();
                    if (deviceTokens.length === 0) {
                        return [2 /*return*/, { success: false, error: 'No device tokens' }];
                    }
                    tokens = deviceTokens.map(function (t) { return t.fcmToken || t.deviceToken; });
                    return [4 /*yield*/, sendBatchNotifications(tokens, template.title, "".concat(opponentName, " is waiting for you in the arena!"), {
                            type: 'pvp_challenge',
                            action: 'join_arena',
                        })];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: result.success > 0,
                            error: result.errors.join('; '),
                        }];
            }
        });
    });
}
