import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import {
  registerDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  scheduleNotification,
  cancelScheduledNotification,
  getRegisteredDeviceCount,
} from './notification_persistence';
import { getNotificationTemplate } from './notification_templates';
import { NotificationInputError, parseNotificationInput } from './notification_validation';

/**
 * Keep persistence errors generic at the synchronous RPC boundary.
 *
 * Logs a fixed RPC/code label without driver text or private parameters; returns a
 * stable `error_code` + generic `error` to the caller. NEVER include
 * `String(error)` or any internal detail in the response body — that's how
 * SQL fragments, TypeError messages, and connection strings escape the
 * server boundary.
 */
function safeErrorResponse(
  rpcName: string,
  error: unknown,
  logger: Runtime.Logger,
  errorCode: string
): string {
  if (error instanceof NotificationInputError) {
    return JSON.stringify({
      success: false,
      error: error.message,
      error_code: 'INVALID_ARGUMENT',
      rpc_name: rpcName,
    });
  }
  // Deliberately omit driver errors, tokens and payloads from logs.
  logger.error('RPC %s failed: code=%s', rpcName, errorCode);
  return JSON.stringify({
    success: false,
    error: 'Internal error; see server logs',
    error_code: errorCode,
    rpc_name: rpcName,
  });
}

/**
 * Register RPC: Register device token for push notifications
 * Payload: { "deviceToken": string, "platform": "android" | "ios", "appVersion"?: string }
 */
type SyncRpc = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string;
type SyncNotificationInitializer = { registerRpc(name: string, handler: SyncRpc): void };

function authError(): string {
  return JSON.stringify({
    success: false,
    error: 'Authentication required',
    error_code: 'AUTH_REQUIRED',
  });
}

export function registerRpcRegisterDeviceToken(initializer: SyncNotificationInitializer): void {
  initializer.registerRpc(
    'armored_archer_register_device_token',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        const { deviceToken, platform, appVersion, fcmToken } = parseNotificationInput(
          payload,
          'register'
        );

        if (!deviceToken || !platform) {
          return JSON.stringify({ success: false, error: 'Missing deviceToken or platform' });
        }

        if (!['android', 'ios'].includes(platform)) {
          return JSON.stringify({ success: false, error: 'Invalid platform' });
        }

        const result = registerDeviceToken(
          nk,
          { userId: ctx.userId, deviceToken, platform, appVersion, fcmToken },
          { rpc: 'armored_archer_register_device_token', logger }
        );

        return JSON.stringify(result);
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_register_device_token',
          error,
          logger,
          'NOTIFICATION_PERSISTENCE_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Remove device token
 * Payload: { "deviceToken": string }
 */
export function registerRpcRemoveDeviceToken(initializer: SyncNotificationInitializer): void {
  initializer.registerRpc(
    'armored_archer_remove_device_token',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        const { deviceToken } = parseNotificationInput(payload, 'remove');

        if (!deviceToken) {
          return JSON.stringify({ success: false, error: 'Missing deviceToken' });
        }

        const result = removeDeviceToken(nk, ctx.userId, deviceToken, {
          rpc: 'armored_archer_remove_device_token',
          logger,
        });
        return JSON.stringify(result);
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_remove_device_token',
          error,
          logger,
          'NOTIFICATION_PERSISTENCE_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Get notification preferences
 * Payload: {}
 */
export function registerRpcGetNotificationPreferences(
  initializer: SyncNotificationInitializer
): void {
  initializer.registerRpc(
    'armored_archer_get_notification_preferences',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        parseNotificationInput(payload, 'empty');
        const prefs = getNotificationPreferences(nk, ctx.userId, {
          rpc: 'armored_archer_get_notification_preferences',
          logger,
        });

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
        return safeErrorResponse(
          'armored_archer_get_notification_preferences',
          error,
          logger,
          'NOTIFICATION_PERSISTENCE_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Update notification preferences
 * Payload: { "dailyRewardsEnabled"?: boolean, "eventsEnabled"?: boolean, ... }
 */
export function registerRpcUpdateNotificationPreferences(
  initializer: SyncNotificationInitializer
): void {
  initializer.registerRpc(
    'armored_archer_update_notification_preferences',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        const preferences = parseNotificationInput(payload, 'preferences');

        // Schema validation has already checked boolean values.
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

        const result = updateNotificationPreferences(nk, ctx.userId, preferences, {
          rpc: 'armored_archer_update_notification_preferences',
          logger,
        });
        return JSON.stringify(result);
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_update_notification_preferences',
          error,
          logger,
          'NOTIFICATION_PERSISTENCE_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Schedule a notification
 * Payload: { "type": "daily_reward" | "event" | "pvp_challenge" | "promotion" | "custom", "title": string, "body": string, "scheduledFor": ISO date string }
 */
export function registerRpcScheduleNotification(initializer: SyncNotificationInitializer): void {
  initializer.registerRpc(
    'armored_archer_schedule_notification',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        const { type, title, body, scheduledFor, data } = parseNotificationInput(
          payload,
          'schedule'
        );

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

        const result = scheduleNotification(
          nk,
          {
            userId: ctx.userId,
            type,
            title: notificationTitle,
            body: notificationBody,
            scheduledFor: new Date(scheduledFor),
            data: data || {},
          },
          { rpc: 'armored_archer_schedule_notification', logger }
        );

        return JSON.stringify(result);
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_schedule_notification',
          error,
          logger,
          'NOTIFICATION_DISPATCH_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Cancel a scheduled notification
 * Payload: { "notificationId": string }
 */
export function registerRpcCancelNotification(initializer: SyncNotificationInitializer): void {
  initializer.registerRpc(
    'armored_archer_cancel_notification',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        const { notificationId } = parseNotificationInput(payload, 'cancel');

        if (!notificationId) {
          return JSON.stringify({ success: false, error: 'Missing notificationId' });
        }

        const result = cancelScheduledNotification(nk, ctx.userId, notificationId, {
          rpc: 'armored_archer_cancel_notification',
          logger,
        });
        return JSON.stringify(result);
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_cancel_notification',
          error,
          logger,
          'NOTIFICATION_DISPATCH_FAILED'
        );
      }
    }
  );
}

/**
 * Register RPC: Get notification status
 * Payload: {}
 */
export function registerRpcGetNotificationStatus(initializer: SyncNotificationInitializer): void {
  initializer.registerRpc(
    'armored_archer_get_notification_status',
    (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => {
      try {
        if (!ctx.userId) return authError();
        parseNotificationInput(payload, 'empty');
        const count = getRegisteredDeviceCount(nk, ctx.userId, {
          rpc: 'armored_archer_get_notification_status',
          logger,
        });
        return JSON.stringify({
          // No worker is configured by Stage 1. This is not delivery readiness.
          firebaseEnabled: false,
          registeredDevices: count,
        });
      } catch (error) {
        return safeErrorResponse(
          'armored_archer_get_notification_status',
          error,
          logger,
          'NOTIFICATION_DISPATCH_FAILED'
        );
      }
    }
  );
}

/**
 * Register all notification RPCs
 */
export function registerNotificationEndpoints(initializer: SyncNotificationInitializer): void {
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
  // Delivery initialization is intentionally outside the synchronous Nakama bundle.
  logger.info('Notification persistence initialized; push delivery not initialized');
}
