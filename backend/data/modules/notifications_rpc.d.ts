import { InitModule } from '../types/nakama';
/**
 * Register RPC: Register device token for push notifications
 * Payload: { "deviceToken": string, "platform": "android" | "ios", "appVersion"?: string }
 */
export declare function registerRpcRegisterDeviceToken(initializer: InitModule): void;
/**
 * Register RPC: Remove device token
 * Payload: { "deviceToken": string }
 */
export declare function registerRpcRemoveDeviceToken(initializer: InitModule): void;
/**
 * Register RPC: Get notification preferences
 * Payload: {}
 */
export declare function registerRpcGetNotificationPreferences(initializer: InitModule): void;
/**
 * Register RPC: Update notification preferences
 * Payload: { "dailyRewardsEnabled"?: boolean, "eventsEnabled"?: boolean, ... }
 */
export declare function registerRpcUpdateNotificationPreferences(initializer: InitModule): void;
/**
 * Register RPC: Schedule a notification
 * Payload: { "type": "daily_reward" | "event" | "pvp_challenge" | "promotion" | "custom", "title": string, "body": string, "scheduledFor": ISO date string }
 */
export declare function registerRpcScheduleNotification(initializer: InitModule): void;
/**
 * Register RPC: Cancel a scheduled notification
 * Payload: { "notificationId": string }
 */
export declare function registerRpcCancelNotification(initializer: InitModule): void;
/**
 * Register RPC: Get notification status
 * Payload: {}
 */
export declare function registerRpcGetNotificationStatus(initializer: InitModule): void;
/**
 * Register all notification RPCs
 */
export declare function registerNotificationEndpoints(initializer: InitModule): void;
/**
 * Initialize notification system
 */
export declare function initializeNotifications(): void;
