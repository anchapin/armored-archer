import { Runtime } from '../types/nakama';
/**
 * Schedule daily rewards for a user
 * Call this when a user claims their daily reward to schedule the next one
 */
export declare function scheduleNextDailyReward(nk: Runtime.Nakama, userId: string, nextAvailableTime: Date): Promise<void>;
/**
 * Notify users about a new event
 */
export declare function notifyUsersAboutEvent(nk: Runtime.Nakama, eventId: string, eventName: string, targetUserIds?: string[]): Promise<void>;
/**
 * Notify a user about a PvP challenge
 */
export declare function notifyUserAboutPvpChallenge(nk: Runtime.Nakama, userId: string, opponentName: string): Promise<void>;
/**
 * Start the notification scheduler
 * @param intervalMs - How often to check for pending notifications (default: 1 minute)
 */
export declare function startNotificationScheduler(nk: Runtime.Nakama, intervalMs?: number): void;
/**
 * Stop the notification scheduler
 */
export declare function stopNotificationScheduler(): void;
/**
 * Get scheduler status
 */
export declare function getSchedulerStatus(): {
    running: boolean;
};
