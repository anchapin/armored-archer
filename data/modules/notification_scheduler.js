"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleNextDailyReward = scheduleNextDailyReward;
exports.notifyUsersAboutEvent = notifyUsersAboutEvent;
exports.notifyUserAboutPvpChallenge = notifyUserAboutPvpChallenge;
exports.startNotificationScheduler = startNotificationScheduler;
exports.stopNotificationScheduler = stopNotificationScheduler;
exports.getSchedulerStatus = getSchedulerStatus;
var tslib_1 = require("tslib");
var logger_1 = require("../config/logger");
var notifications_1 = require("./notifications");
var schedulerInterval = null;
var isRunning = false;
/**
 * Process pending scheduled notifications
 * This runs periodically to send notifications that are due
 */
function processPendingNotifications(nk) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var result, error_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isRunning) {
                        return [2 /*return*/];
                    }
                    isRunning = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, notifications_1.processScheduledNotifications)(nk)];
                case 2:
                    result = _a.sent();
                    if (result.sent > 0 || result.failed > 0) {
                        logger_1.logger.info('Processed scheduled notifications', {
                            sent: result.sent,
                            failed: result.failed,
                        });
                    }
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.error('Error processing scheduled notifications', { error: String(error_1) });
                    return [3 /*break*/, 5];
                case 4:
                    isRunning = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send daily reward reminders to users
 * This is called at a specific time each day (e.g., 9 AM)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sendDailyRewardReminders(nk) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var users, successCount, failCount, users_1, users_1_1, user, result, e_1_1, error_2;
        var e_1, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    return [4 /*yield*/, nk.dbQuery("SELECT u.id, u.username FROM users u\n       JOIN notification_preferences np ON u.id = np.user_id\n       WHERE np.daily_rewards_enabled = true")];
                case 1:
                    users = (_b.sent());
                    logger_1.logger.info('Sending daily reward reminders', { userCount: users.length });
                    successCount = 0;
                    failCount = 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 7, 8, 9]);
                    users_1 = tslib_1.__values(users), users_1_1 = users_1.next();
                    _b.label = 3;
                case 3:
                    if (!!users_1_1.done) return [3 /*break*/, 6];
                    user = users_1_1.value;
                    return [4 /*yield*/, (0, notifications_1.sendDailyRewardNotification)(nk, user.id)];
                case 4:
                    result = _b.sent();
                    if (result.success) {
                        successCount++;
                    }
                    else {
                        failCount++;
                    }
                    _b.label = 5;
                case 5:
                    users_1_1 = users_1.next();
                    return [3 /*break*/, 3];
                case 6: return [3 /*break*/, 9];
                case 7:
                    e_1_1 = _b.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 9];
                case 8:
                    try {
                        if (users_1_1 && !users_1_1.done && (_a = users_1.return)) _a.call(users_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 9:
                    logger_1.logger.info('Daily reward reminders sent', { success: successCount, failed: failCount });
                    return [3 /*break*/, 11];
                case 10:
                    error_2 = _b.sent();
                    logger_1.logger.error('Error sending daily reward reminders', { error: String(error_2) });
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Schedule daily rewards for a user
 * Call this when a user claims their daily reward to schedule the next one
 */
function scheduleNextDailyReward(nk, userId, nextAvailableTime) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var error_3;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, nk.dbQuery("INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)\n       VALUES ($1, 'daily_reward', '\uD83C\uDF81 Daily Rewards Available!', 'Your daily rewards are ready to claim!', '{}', $2, 'pending')\n       ON CONFLICT DO NOTHING", [userId, nextAvailableTime.toISOString()])];
                case 1:
                    _a.sent();
                    logger_1.logger.info('Next daily reward scheduled', {
                        userId: userId,
                        nextAvailable: nextAvailableTime.toISOString(),
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    logger_1.logger.error('Error scheduling next daily reward', { error: String(error_3), userId: userId });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Notify users about a new event
 */
function notifyUsersAboutEvent(nk, eventId, eventName, targetUserIds) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var users, users_2, users_2_1, user, e_2_1, error_4;
        var e_2, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 13, , 14]);
                    users = [];
                    if (!(targetUserIds && targetUserIds.length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, nk.dbQuery("SELECT id FROM users WHERE id = ANY($1)", [targetUserIds])];
                case 1:
                    // Get specific users
                    users = (_b.sent());
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, nk.dbQuery("SELECT u.id FROM users u\n         JOIN notification_preferences np ON u.id = np.user_id\n         WHERE np.events_enabled = true")];
                case 3:
                    // Get all users with events enabled
                    users = (_b.sent());
                    _b.label = 4;
                case 4:
                    logger_1.logger.info('Sending event notifications', { eventId: eventId, userCount: users.length });
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 10, 11, 12]);
                    users_2 = tslib_1.__values(users), users_2_1 = users_2.next();
                    _b.label = 6;
                case 6:
                    if (!!users_2_1.done) return [3 /*break*/, 9];
                    user = users_2_1.value;
                    return [4 /*yield*/, (0, notifications_1.sendEventNotification)(nk, user.id, eventName, eventId)];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8:
                    users_2_1 = users_2.next();
                    return [3 /*break*/, 6];
                case 9: return [3 /*break*/, 12];
                case 10:
                    e_2_1 = _b.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 12];
                case 11:
                    try {
                        if (users_2_1 && !users_2_1.done && (_a = users_2.return)) _a.call(users_2);
                    }
                    finally { if (e_2) throw e_2.error; }
                    return [7 /*endfinally*/];
                case 12: return [3 /*break*/, 14];
                case 13:
                    error_4 = _b.sent();
                    logger_1.logger.error('Error sending event notifications', { error: String(error_4), eventId: eventId });
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/];
            }
        });
    });
}
/**
 * Notify a user about a PvP challenge
 */
function notifyUserAboutPvpChallenge(nk, userId, opponentName) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var result, error_5;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, notifications_1.sendPvpChallengeNotification)(nk, userId, opponentName)];
                case 1:
                    result = _a.sent();
                    logger_1.logger.info('PvP challenge notification sent', { userId: userId, success: result.success });
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    logger_1.logger.error('Error sending PvP challenge notification', { error: String(error_5), userId: userId });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Start the notification scheduler
 * @param intervalMs - How often to check for pending notifications (default: 1 minute)
 */
function startNotificationScheduler(nk, intervalMs) {
    if (intervalMs === void 0) { intervalMs = 60000; }
    if (schedulerInterval) {
        logger_1.logger.warn('Notification scheduler already running');
        return;
    }
    logger_1.logger.info('Starting notification scheduler', { intervalMs: intervalMs });
    // Process pending notifications every minute
    // Using unref() to allow Jest to exit properly in tests
    schedulerInterval = setInterval(function () {
        processPendingNotifications(nk);
    }, intervalMs).unref();
    // Initial processing
    processPendingNotifications(nk);
}
/**
 * Stop the notification scheduler
 */
function stopNotificationScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger_1.logger.info('Notification scheduler stopped');
    }
}
/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return { running: schedulerInterval !== null };
}
