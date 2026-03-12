import { logger } from '../config/logger';
import { InitModule, Runtime } from '../types/nakama';
import {
  initializeFirebase,
  isFirebaseInitialized,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  scheduleNotification,
  cancelScheduledNotification,
  getNotificationTemplate,
} from './notifications';

/**
 * Register RPC: Register device token for push notifications
 * Payload: { "deviceToken": string, "platform": "android" | "ios", "appVersion"?: string }
 */
export function registerRpcRegisterDeviceToken(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_register_device_token',
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const { deviceToken, platform, appVersion, fcmToken } = JSON.parse(payload);

        if (!deviceToken || !platform) {
          return JSON.stringify({ success: false, error: 'Missing deviceToken or platform' });
        }

        if (!['android', 'ios'].includes(platform)) {
          return JSON.stringify({ success: false, error: 'Invalid platform' });
        }

        const result = await registerDeviceToken(
          nk,
          ctx.userId!,
          deviceToken,
          platform,
          appVersion,
          fcmToken
        );

        return JSON.stringify(result);
      } catch (error) {
        logger.error('Failed to register device token', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Remove device token
 * Payload: { "deviceToken": string }
 */
export function registerRpcRemoveDeviceToken(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_remove_device_token',
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const { deviceToken } = JSON.parse(payload);

        if (!deviceToken) {
          return JSON.stringify({ success: false, error: 'Missing deviceToken' });
        }

        const result = await removeDeviceToken(nk, deviceToken);
        return JSON.stringify(result);
      } catch (error) {
        logger.error('Failed to remove device token', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Get notification preferences
 * Payload: {}
 */
export function registerRpcGetNotificationPreferences(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_get_notification_preferences',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const prefs = await getNotificationPreferences(nk, ctx.userId!);

        if (!prefs) {
          return JSON.stringify({
            success: false,
            error: 'Failed to get preferences',
          });
        }

        return JSON.stringify({
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
        });
      } catch (error) {
        logger.error('Failed to get notification preferences', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Update notification preferences
 * Payload: { "dailyRewardsEnabled"?: boolean, "eventsEnabled"?: boolean, ... }
 */
export function registerRpcUpdateNotificationPreferences(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_update_notification_preferences',
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const preferences = JSON.parse(payload);

        // Validate boolean fields
        const validFields = [
          'dailyRewardsEnabled',
          'eventsEnabled',
          'pvpChallengesEnabled',
          'promotionsEnabled',
          'notificationsEnabled',
          'quietHoursEnabled',
        ];

        for (const key of Object.keys(preferences)) {
          if (
            !validFields.includes(key) &&
            !['quietHoursStart', 'quietHoursEnd', 'timezone'].includes(key)
          ) {
            return JSON.stringify({ success: false, error: `Invalid field: ${key}` });
          }
        }

        const result = await updateNotificationPreferences(nk, ctx.userId!, preferences);
        return JSON.stringify(result);
      } catch (error) {
        logger.error('Failed to update notification preferences', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Schedule a notification
 * Payload: { "type": "daily_reward" | "event" | "pvp_challenge" | "promotion" | "custom", "title": string, "body": string, "scheduledFor": ISO date string }
 */
export function registerRpcScheduleNotification(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_schedule_notification',
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const { type, title, body, scheduledFor, data } = JSON.parse(payload);

        if (!type || !scheduledFor) {
          return JSON.stringify({ success: false, error: 'Missing type or scheduledFor' });
        }

        const validTypes = ['daily_reward', 'event', 'pvp_challenge', 'promotion', 'custom'];
        if (!validTypes.includes(type)) {
          return JSON.stringify({ success: false, error: 'Invalid notification type' });
        }

        // Use template if title/body not provided
        const template = getNotificationTemplate(type);
        const notificationTitle = title || template.title;
        const notificationBody = body || template.body;

        const result = await scheduleNotification(
          nk,
          ctx.userId!,
          type,
          notificationTitle,
          notificationBody,
          new Date(scheduledFor),
          data || {}
        );

        return JSON.stringify(result);
      } catch (error) {
        logger.error('Failed to schedule notification', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Cancel a scheduled notification
 * Payload: { "notificationId": string }
 */
export function registerRpcCancelNotification(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_cancel_notification',
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const { notificationId } = JSON.parse(payload);

        if (!notificationId) {
          return JSON.stringify({ success: false, error: 'Missing notificationId' });
        }

        const result = await cancelScheduledNotification(nk, notificationId);
        return JSON.stringify(result);
      } catch (error) {
        logger.error('Failed to cancel notification', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register RPC: Get notification status
 * Payload: {}
 */
export function registerRpcGetNotificationStatus(initializer: InitModule): void {
  initializer.registerRpc(
    'armored_archer_get_notification_status',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        const initialized = isFirebaseInitialized();
        const deviceTokens = (await nk.dbQuery(
          `SELECT COUNT(*) as count FROM device_tokens WHERE user_id = $1`,
          [ctx.userId!]
        )) as { count: number }[];

        return JSON.stringify({
          firebaseEnabled: initialized,
          registeredDevices: deviceTokens[0]?.count || 0,
        });
      } catch (error) {
        logger.error('Failed to get notification status', { error: String(error) });
        return JSON.stringify({ success: false, error: String(error) });
      }
    }
  );
}

/**
 * Register all notification RPCs
 */
export function registerNotificationEndpoints(initializer: InitModule): void {
  registerRpcRegisterDeviceToken(initializer);
  registerRpcRemoveDeviceToken(initializer);
  registerRpcGetNotificationPreferences(initializer);
  registerRpcUpdateNotificationPreferences(initializer);
  registerRpcScheduleNotification(initializer);
  registerRpcCancelNotification(initializer);
  registerRpcGetNotificationStatus(initializer);

  logger.info('Notification RPCs registered');
}

/**
 * Initialize notification system
 */
export function initializeNotifications(): void {
  initializeFirebase();
  logger.info('Notification system initialized');
}
