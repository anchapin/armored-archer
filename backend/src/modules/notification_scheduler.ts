import { Runtime, Runtime.Nakama } from '../types/nakama';
import { logger } from '../config/logger';
import {
  processScheduledNotifications,
  sendDailyRewardNotification,
  sendEventNotification,
  sendPvpChallengeNotification,
} from './notifications';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Process pending scheduled notifications
 * This runs periodically to send notifications that are due
 */
async function processPendingNotifications(nk: Runtime.Nakama): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    const result = await processScheduledNotifications(nk);
    if (result.sent > 0 || result.failed > 0) {
      logger.info('Processed scheduled notifications', { sent: result.sent, failed: result.failed });
    }
  } catch (error) {
    logger.error('Error processing scheduled notifications', { error: String(error) });
  } finally {
    isRunning = false;
  }
}

/**
 * Send daily reward reminders to users
 * This is called at a specific time each day (e.g., 9 AM)
 */
async function sendDailyRewardReminders(nk: Runtime.Nakama): Promise<void> {
  try {
    // Get all users who have daily rewards enabled
    const users = await nk.dbQuery(
      `SELECT u.id, u.username FROM users u
       JOIN notification_preferences np ON u.id = np.user_id
       WHERE np.daily_rewards_enabled = true`
    );

    logger.info('Sending daily reward reminders', { userCount: users.length });

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      const result = await sendDailyRewardNotification(nk, user.id);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    logger.info('Daily reward reminders sent', { success: successCount, failed: failCount });
  } catch (error) {
    logger.error('Error sending daily reward reminders', { error: String(error) });
  }
}

/**
 * Schedule daily rewards for a user
 * Call this when a user claims their daily reward to schedule the next one
 */
export async function scheduleNextDailyReward(
  nk: Runtime.Nakama,
  userId: string,
  nextAvailableTime: Date
): Promise<void> {
  try {
    await nk.dbQuery(
      `INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)
       VALUES ($1, 'daily_reward', '🎁 Daily Rewards Available!', 'Your daily rewards are ready to claim!', '{}', $2, 'pending')
       ON CONFLICT DO NOTHING`,
      [userId, nextAvailableTime.toISOString()]
    );

    logger.info('Next daily reward scheduled', { userId, nextAvailable: nextAvailableTime.toISOString() });
  } catch (error) {
    logger.error('Error scheduling next daily reward', { error: String(error), userId });
  }
}

/**
 * Notify users about a new event
 */
export async function notifyUsersAboutEvent(
  nk: Runtime.Nakama,
  eventId: string,
  eventName: string,
  targetUserIds?: string[]
): Promise<void> {
  try {
    let users: any[] = [];

    if (targetUserIds && targetUserIds.length > 0) {
      // Get specific users
      users = await nk.dbQuery(
        `SELECT id FROM users WHERE id = ANY($1)`,
        [targetUserIds]
      );
    } else {
      // Get all users with events enabled
      users = await nk.dbQuery(
        `SELECT u.id FROM users u
         JOIN notification_preferences np ON u.id = np.user_id
         WHERE np.events_enabled = true`
      );
    }

    logger.info('Sending event notifications', { eventId, userCount: users.length });

    for (const user of users) {
      await sendEventNotification(nk, user.id, eventName, eventId);
    }
  } catch (error) {
    logger.error('Error sending event notifications', { error: String(error), eventId });
  }
}

/**
 * Notify a user about a PvP challenge
 */
export async function notifyUserAboutPvpChallenge(
  nk: Runtime.Nakama,
  userId: string,
  opponentName: string
): Promise<void> {
  try {
    const result = await sendPvpChallengeNotification(nk, userId, opponentName);
    logger.info('PvP challenge notification sent', { userId, success: result.success });
  } catch (error) {
    logger.error('Error sending PvP challenge notification', { error: String(error), userId });
  }
}

/**
 * Start the notification scheduler
 * @param intervalMs - How often to check for pending notifications (default: 1 minute)
 */
export function startNotificationScheduler(nk: Runtime.Nakama, intervalMs: number = 60000): void {
  if (schedulerInterval) {
    logger.warn('Notification scheduler already running');
    return;
  }

  logger.info('Starting notification scheduler', { intervalMs });

  // Process pending notifications every minute
  schedulerInterval = setInterval(() => {
    processPendingNotifications(nk);
  }, intervalMs);

  // Initial processing
  processPendingNotifications(nk);
}

/**
 * Stop the notification scheduler
 */
export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Notification scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): { running: boolean } {
  return { running: schedulerInterval !== null };
}
