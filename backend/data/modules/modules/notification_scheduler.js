"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleNextDailyReward = scheduleNextDailyReward;
exports.notifyUsersAboutEvent = notifyUsersAboutEvent;
exports.notifyUserAboutPvpChallenge = notifyUserAboutPvpChallenge;
exports.startNotificationScheduler = startNotificationScheduler;
exports.stopNotificationScheduler = stopNotificationScheduler;
exports.getSchedulerStatus = getSchedulerStatus;
const logger_1 = require("../config/logger");
const notifications_1 = require("./notifications");
let schedulerInterval = null;
let isRunning = false;
/**
 * Process pending scheduled notifications
 * This runs periodically to send notifications that are due
 */
async function processPendingNotifications(nk) {
    if (isRunning) {
        return;
    }
    isRunning = true;
    try {
        const result = await (0, notifications_1.processScheduledNotifications)(nk);
        if (result.sent > 0 || result.failed > 0) {
            logger_1.logger.info('Processed scheduled notifications', {
                sent: result.sent,
                failed: result.failed,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error processing scheduled notifications', { error: String(error) });
    }
    finally {
        isRunning = false;
    }
}
/**
 * Send daily reward reminders to users
 * This is called at a specific time each day (e.g., 9 AM)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendDailyRewardReminders(nk) {
    try {
        // Get all users who have daily rewards enabled
        const users = (await nk.dbQuery(`SELECT u.id, u.username FROM users u
       JOIN notification_preferences np ON u.id = np.user_id
       WHERE np.daily_rewards_enabled = true`));
        logger_1.logger.info('Sending daily reward reminders', { userCount: users.length });
        let successCount = 0;
        let failCount = 0;
        for (const user of users) {
            const result = await (0, notifications_1.sendDailyRewardNotification)(nk, user.id);
            if (result.success) {
                successCount++;
            }
            else {
                failCount++;
            }
        }
        logger_1.logger.info('Daily reward reminders sent', { success: successCount, failed: failCount });
    }
    catch (error) {
        logger_1.logger.error('Error sending daily reward reminders', { error: String(error) });
    }
}
/**
 * Schedule daily rewards for a user
 * Call this when a user claims their daily reward to schedule the next one
 */
async function scheduleNextDailyReward(nk, userId, nextAvailableTime) {
    try {
        await nk.dbQuery(`INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)
       VALUES ($1, 'daily_reward', '🎁 Daily Rewards Available!', 'Your daily rewards are ready to claim!', '{}', $2, 'pending')
       ON CONFLICT DO NOTHING`, [userId, nextAvailableTime.toISOString()]);
        logger_1.logger.info('Next daily reward scheduled', {
            userId,
            nextAvailable: nextAvailableTime.toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Error scheduling next daily reward', { error: String(error), userId });
    }
}
/**
 * Notify users about a new event
 */
async function notifyUsersAboutEvent(nk, eventId, eventName, targetUserIds) {
    try {
        let users = [];
        if (targetUserIds && targetUserIds.length > 0) {
            // Get specific users
            users = (await nk.dbQuery(`SELECT id FROM users WHERE id = ANY($1)`, [targetUserIds]));
        }
        else {
            // Get all users with events enabled
            users = (await nk.dbQuery(`SELECT u.id FROM users u
         JOIN notification_preferences np ON u.id = np.user_id
         WHERE np.events_enabled = true`));
        }
        logger_1.logger.info('Sending event notifications', { eventId, userCount: users.length });
        for (const user of users) {
            await (0, notifications_1.sendEventNotification)(nk, user.id, eventName, eventId);
        }
    }
    catch (error) {
        logger_1.logger.error('Error sending event notifications', { error: String(error), eventId });
    }
}
/**
 * Notify a user about a PvP challenge
 */
async function notifyUserAboutPvpChallenge(nk, userId, opponentName) {
    try {
        const result = await (0, notifications_1.sendPvpChallengeNotification)(nk, userId, opponentName);
        logger_1.logger.info('PvP challenge notification sent', { userId, success: result.success });
    }
    catch (error) {
        logger_1.logger.error('Error sending PvP challenge notification', { error: String(error), userId });
    }
}
/**
 * Start the notification scheduler
 * @param intervalMs - How often to check for pending notifications (default: 1 minute)
 */
function startNotificationScheduler(nk, intervalMs = 60000) {
    if (process.env.NODE_ENV === 'test') {
        logger_1.logger.info('Skipping notification scheduler in test mode');
        return;
    }
    if (schedulerInterval) {
        logger_1.logger.warn('Notification scheduler already running');
        return;
    }
    logger_1.logger.info('Starting notification scheduler', { intervalMs });
    // Process pending notifications every minute
    // Using unref() to allow Jest to exit properly in tests
    schedulerInterval = setInterval(() => {
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
