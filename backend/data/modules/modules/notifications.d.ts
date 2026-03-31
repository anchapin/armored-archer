import { Runtime } from '../types/nakama';
interface SendResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}
export type NotificationType = 'daily_reward' | 'event' | 'pvp_challenge' | 'promotion' | 'custom';
/**
 * Initialize Firebase Admin SDK for Cloud Messaging
 */
export declare function initializeFirebase(): boolean;
/**
 * Check if Firebase is initialized
 */
export declare function isFirebaseInitialized(): boolean;
/**
 * Send a push notification to a device token
 */
export declare function sendPushNotification(deviceToken: string, title: string, body: string, data?: Record<string, string>, platform?: 'android' | 'ios'): Promise<SendResponse>;
/**
 * Send notification to multiple device tokens (batch)
 */
export declare function sendBatchNotifications(deviceTokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{
    success: number;
    failed: number;
    errors: string[];
}>;
/**
 * Get notification template for a type
 */
export declare function getNotificationTemplate(type: NotificationType): {
    title: string;
    body: string;
};
/**
 * Register a device token for a user
 */
export declare function registerDeviceToken(nk: Runtime.Nakama, userId: string, deviceToken: string, platform: 'android' | 'ios', appVersion?: string, fcmToken?: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Remove a device token
 */
export declare function removeDeviceToken(nk: Runtime.Nakama, deviceToken: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get device tokens for a user
 */
export declare function getUserDeviceTokens(nk: Runtime.Nakama, userId: string): Promise<{
    deviceToken: string;
    platform: string;
    fcmToken: string;
}[]>;
/**
 * Get user notification preferences
 */
export declare function getNotificationPreferences(nk: Runtime.Nakama, userId: string): Promise<{
    user_id: string;
    [key: string]: unknown;
} | null>;
/**
 * Update user notification preferences
 */
export declare function updateNotificationPreferences(nk: Runtime.Nakama, userId: string, preferences: {
    dailyRewardsEnabled?: boolean;
    eventsEnabled?: boolean;
    pvpChallengesEnabled?: boolean;
    promotionsEnabled?: boolean;
    notificationsEnabled?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
}): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Schedule a notification for a user
 */
export declare function scheduleNotification(nk: Runtime.Nakama, userId: string, type: NotificationType, title: string, body: string, scheduledFor: Date, data?: Record<string, string>): Promise<{
    success: boolean;
    notificationId?: string;
    error?: string;
}>;
/**
 * Cancel a scheduled notification
 */
export declare function cancelScheduledNotification(nk: Runtime.Nakama, notificationId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get pending scheduled notifications to send
 */
export declare function getPendingNotifications(nk: Runtime.Nakama, limit?: number): Promise<any[]>;
/**
 * Mark notification as sent
 */
export declare function markNotificationSent(nk: Runtime.Nakama, notificationId: string, success: boolean, errorMessage?: string): Promise<void>;
/**
 * Log notification to history
 */
export declare function logNotificationHistory(nk: Runtime.Nakama, notificationId: string, userId: string, notificationType: NotificationType, title: string, body: string, deviceToken: string, status: 'sent' | 'delivered' | 'clicked' | 'failed', errorMessage?: string): Promise<void>;
/**
 * Check if user should receive notification based on preferences
 */
export declare function shouldSendNotification(nk: Runtime.Nakama, userId: string, notificationType: NotificationType): Promise<boolean>;
/**
 * Process and send pending scheduled notifications
 */
export declare function processScheduledNotifications(nk: Runtime.Nakama): Promise<{
    sent: number;
    failed: number;
}>;
/**
 * Send daily reward notification to a user
 */
export declare function sendDailyRewardNotification(nk: Runtime.Nakama, userId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send event notification to a user
 */
export declare function sendEventNotification(nk: Runtime.Nakama, userId: string, eventName: string, eventId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send PvP challenge notification to a user
 */
export declare function sendPvpChallengeNotification(nk: Runtime.Nakama, userId: string, opponentName: string): Promise<{
    success: boolean;
    error?: string;
}>;
export {};
