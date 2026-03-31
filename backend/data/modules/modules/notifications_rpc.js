"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcRegisterDeviceToken = registerRpcRegisterDeviceToken;
exports.registerRpcRemoveDeviceToken = registerRpcRemoveDeviceToken;
exports.registerRpcGetNotificationPreferences = registerRpcGetNotificationPreferences;
exports.registerRpcUpdateNotificationPreferences = registerRpcUpdateNotificationPreferences;
exports.registerRpcScheduleNotification = registerRpcScheduleNotification;
exports.registerRpcCancelNotification = registerRpcCancelNotification;
exports.registerRpcGetNotificationStatus = registerRpcGetNotificationStatus;
exports.registerNotificationEndpoints = registerNotificationEndpoints;
exports.initializeNotifications = initializeNotifications;
var tslib_1 = require("tslib");
var logger_1 = require("../config/logger");
var notifications_1 = require("./notifications");
/**
 * Register RPC: Register device token for push notifications
 * Payload: { "deviceToken": string, "platform": "android" | "ios", "appVersion"?: string }
 */
function registerRpcRegisterDeviceToken(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_register_device_token', function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var _a, deviceToken, platform, appVersion, fcmToken, result, error_1;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = JSON.parse(payload), deviceToken = _a.deviceToken, platform = _a.platform, appVersion = _a.appVersion, fcmToken = _a.fcmToken;
                    if (!deviceToken || !platform) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing deviceToken or platform' })];
                    }
                    if (!['android', 'ios'].includes(platform)) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Invalid platform' })];
                    }
                    return [4 /*yield*/, (0, notifications_1.registerDeviceToken)(nk, ctx.userId, deviceToken, platform, appVersion, fcmToken)];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, JSON.stringify(result)];
                case 2:
                    error_1 = _b.sent();
                    logger.error('Failed to register device token', { error: String(error_1) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_1) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Remove device token
 * Payload: { "deviceToken": string }
 */
function registerRpcRemoveDeviceToken(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_remove_device_token', function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var deviceToken, result, error_2;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    deviceToken = JSON.parse(payload).deviceToken;
                    if (!deviceToken) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing deviceToken' })];
                    }
                    return [4 /*yield*/, (0, notifications_1.removeDeviceToken)(nk, deviceToken)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, JSON.stringify(result)];
                case 2:
                    error_2 = _a.sent();
                    logger.error('Failed to remove device token', { error: String(error_2) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_2) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Get notification preferences
 * Payload: {}
 */
function registerRpcGetNotificationPreferences(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_get_notification_preferences', 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var prefs, error_3;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, notifications_1.getNotificationPreferences)(nk, ctx.userId)];
                case 1:
                    prefs = _a.sent();
                    if (!prefs) {
                        return [2 /*return*/, JSON.stringify({
                                success: false,
                                error: 'Failed to get preferences',
                            })];
                    }
                    return [2 /*return*/, JSON.stringify({
                            success: true,
                            preferences: {
                                dailyRewardsEnabled: prefs.daily_rewards_enabled,
                                eventsEnabled: prefs.events_enabled,
                                pvpChallengesEnabled: prefs.pvp_challenges_enabled,
                                promotionsEnabled: prefs.promotions_enabled,
                                notificationsEnabled: prefs.notifications_enabled,
                                quietHoursEnabled: prefs.quiet_hours_enabled,
                                quietHoursStart: prefs.quiet_hours_start,
                                quietHoursEnd: prefs.quiet_hours_end,
                                timezone: prefs.timezone,
                            },
                        })];
                case 2:
                    error_3 = _a.sent();
                    logger.error('Failed to get notification preferences', { error: String(error_3) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_3) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Update notification preferences
 * Payload: { "dailyRewardsEnabled"?: boolean, "eventsEnabled"?: boolean, ... }
 */
function registerRpcUpdateNotificationPreferences(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_update_notification_preferences', function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var preferences, validFields, _a, _b, key, result, error_4;
        var e_1, _c;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    preferences = JSON.parse(payload);
                    validFields = [
                        'dailyRewardsEnabled',
                        'eventsEnabled',
                        'pvpChallengesEnabled',
                        'promotionsEnabled',
                        'notificationsEnabled',
                        'quietHoursEnabled',
                    ];
                    try {
                        for (_a = tslib_1.__values(Object.keys(preferences)), _b = _a.next(); !_b.done; _b = _a.next()) {
                            key = _b.value;
                            if (!validFields.includes(key) &&
                                !['quietHoursStart', 'quietHoursEnd', 'timezone'].includes(key)) {
                                return [2 /*return*/, JSON.stringify({ success: false, error: "Invalid field: ".concat(key) })];
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return [4 /*yield*/, (0, notifications_1.updateNotificationPreferences)(nk, ctx.userId, preferences)];
                case 1:
                    result = _d.sent();
                    return [2 /*return*/, JSON.stringify(result)];
                case 2:
                    error_4 = _d.sent();
                    logger.error('Failed to update notification preferences', { error: String(error_4) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_4) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Schedule a notification
 * Payload: { "type": "daily_reward" | "event" | "pvp_challenge" | "promotion" | "custom", "title": string, "body": string, "scheduledFor": ISO date string }
 */
function registerRpcScheduleNotification(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_schedule_notification', function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var _a, type, title, body, scheduledFor, data, validTypes, template, notificationTitle, notificationBody, result, error_5;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = JSON.parse(payload), type = _a.type, title = _a.title, body = _a.body, scheduledFor = _a.scheduledFor, data = _a.data;
                    if (!type || !scheduledFor) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing type or scheduledFor' })];
                    }
                    validTypes = ['daily_reward', 'event', 'pvp_challenge', 'promotion', 'custom'];
                    if (!validTypes.includes(type)) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Invalid notification type' })];
                    }
                    template = (0, notifications_1.getNotificationTemplate)(type);
                    notificationTitle = title || template.title;
                    notificationBody = body || template.body;
                    return [4 /*yield*/, (0, notifications_1.scheduleNotification)(nk, ctx.userId, type, notificationTitle, notificationBody, new Date(scheduledFor), data || {})];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, JSON.stringify(result)];
                case 2:
                    error_5 = _b.sent();
                    logger.error('Failed to schedule notification', { error: String(error_5) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_5) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Cancel a scheduled notification
 * Payload: { "notificationId": string }
 */
function registerRpcCancelNotification(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_cancel_notification', function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var notificationId, result, error_6;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    notificationId = JSON.parse(payload).notificationId;
                    if (!notificationId) {
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing notificationId' })];
                    }
                    return [4 /*yield*/, (0, notifications_1.cancelScheduledNotification)(nk, notificationId)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, JSON.stringify(result)];
                case 2:
                    error_6 = _a.sent();
                    logger.error('Failed to cancel notification', { error: String(error_6) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_6) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register RPC: Get notification status
 * Payload: {}
 */
function registerRpcGetNotificationStatus(initializer) {
    var _this = this;
    initializer.registerRpc('armored_archer_get_notification_status', 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var initialized, deviceTokens, error_7;
        var _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    initialized = (0, notifications_1.isFirebaseInitialized)();
                    return [4 /*yield*/, nk.dbQuery("SELECT COUNT(*) as count FROM device_tokens WHERE user_id = $1", [ctx.userId])];
                case 1:
                    deviceTokens = (_b.sent());
                    return [2 /*return*/, JSON.stringify({
                            firebaseEnabled: initialized,
                            registeredDevices: ((_a = deviceTokens[0]) === null || _a === void 0 ? void 0 : _a.count) || 0,
                        })];
                case 2:
                    error_7 = _b.sent();
                    logger.error('Failed to get notification status', { error: String(error_7) });
                    return [2 /*return*/, JSON.stringify({ success: false, error: String(error_7) })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Register all notification RPCs
 */
function registerNotificationEndpoints(initializer) {
    registerRpcRegisterDeviceToken(initializer);
    registerRpcRemoveDeviceToken(initializer);
    registerRpcGetNotificationPreferences(initializer);
    registerRpcUpdateNotificationPreferences(initializer);
    registerRpcScheduleNotification(initializer);
    registerRpcCancelNotification(initializer);
    registerRpcGetNotificationStatus(initializer);
    logger_1.logger.info('Notification RPCs registered');
}
/**
 * Initialize notification system
 */
function initializeNotifications() {
    (0, notifications_1.initializeFirebase)();
    logger_1.logger.info('Notification system initialized');
}
