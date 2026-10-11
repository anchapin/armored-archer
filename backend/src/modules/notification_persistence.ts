import { Runtime } from '../types/nakama';
import { observedSqlQuery } from '../utils/sql-observability';
import { NotificationType } from './notification_templates';
import { NotificationInputError } from './notification_validation';

/** Nakama control plane only. No Firebase, Promise or timer dependencies (ADR-0008). */
export type SqlContext = { rpc: string; logger: Runtime.Logger };
export interface NotificationPreferences {
  user_id: string;
  daily_rewards_enabled: boolean;
  events_enabled: boolean;
  pvp_challenges_enabled: boolean;
  promotions_enabled: boolean;
  notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}
export type PreferenceUpdates = Partial<{
  timezone: string;
  quietHoursEnd: string;
  quietHoursStart: string;
  quietHoursEnabled: boolean;
  notificationsEnabled: boolean;
  promotionsEnabled: boolean;
  pvpChallengesEnabled: boolean;
  eventsEnabled: boolean;
  dailyRewardsEnabled: boolean;
}>;
const preferenceColumns: Record<keyof PreferenceUpdates, string> = {
  dailyRewardsEnabled: 'daily_rewards_enabled',
  eventsEnabled: 'events_enabled',
  pvpChallengesEnabled: 'pvp_challenges_enabled',
  promotionsEnabled: 'promotions_enabled',
  notificationsEnabled: 'notifications_enabled',
  quietHoursEnabled: 'quiet_hours_enabled',
  quietHoursStart: 'quiet_hours_start',
  quietHoursEnd: 'quiet_hours_end',
  timezone: 'timezone',
};
export function registerDeviceToken(
  nk: Runtime.Nakama,
  input: {
    userId: string;
    deviceToken: string;
    platform: 'android' | 'ios';
    appVersion?: string;
    fcmToken?: string;
  },
  context?: SqlContext
): { success: boolean } {
  const { userId, deviceToken, platform, appVersion, fcmToken } = input;
  const rows = observedSqlQuery(
    nk,
    'notification_register_device',
    `INSERT INTO device_tokens (user_id, device_token, platform, app_version, fcm_token, updated_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (device_token) DO UPDATE SET
       platform = EXCLUDED.platform, app_version = EXCLUDED.app_version,
       fcm_token = EXCLUDED.fcm_token, updated_at = NOW(), last_used_at = NOW()
     WHERE device_tokens.user_id = EXCLUDED.user_id
     RETURNING token_id`,
    [userId, deviceToken, platform, appVersion || null, fcmToken || null],
    context
  );
  // Conflict with another owner is a safe unsuccessful result. Never transfer here.
  return { success: rows.length > 0 };
}
export function removeDeviceToken(
  nk: Runtime.Nakama,
  userId: string,
  deviceToken: string,
  context?: SqlContext
): { success: boolean } {
  const rows = observedSqlQuery(
    nk,
    'notification_remove_device',
    'DELETE FROM device_tokens WHERE device_token = $1 AND user_id = $2 RETURNING token_id',
    [deviceToken, userId],
    context
  );
  return { success: rows.length > 0 };
}
export function getNotificationPreferences(
  nk: Runtime.Nakama,
  userId: string,
  context?: SqlContext
): NotificationPreferences {
  const rows = observedSqlQuery(
    nk,
    'notification_get_preferences',
    `INSERT INTO notification_preferences (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *`,
    [userId],
    context
  );
  if (!rows.length) throw new Error('Notification preferences persistence returned no row');
  return rows[0] as NotificationPreferences;
}
export function updateNotificationPreferences(
  nk: Runtime.Nakama,
  userId: string,
  preferences: PreferenceUpdates,
  context?: SqlContext
): { success: boolean; error?: string } {
  const keys = Object.keys(preferences) as (keyof PreferenceUpdates)[];
  if (!keys.length) return { success: false, error: 'No preferences to update' };
  // One statement creates defaults for missing rows and only changes supplied fields.
  const columns = keys.map((key) => {
    if (!Object.prototype.hasOwnProperty.call(preferenceColumns, key)) {
      throw new Error('Unsupported preference field');
    }
    return preferenceColumns[key];
  });
  if (preferences.timezone !== undefined) {
    const zones = observedSqlQuery(
      nk,
      'notification_validate_timezone',
      'SELECT name FROM pg_timezone_names WHERE name = $1',
      [preferences.timezone],
      context
    );
    if (!zones.length) throw new NotificationInputError('Invalid timezone');
  }
  const values = keys.map((key) => preferences[key]);
  const rows = observedSqlQuery(
    nk,
    'notification_update_preferences',
    `INSERT INTO notification_preferences (user_id, ${columns.join(', ')})
     VALUES ($1, ${columns.map((_, i) => '$' + (i + 2)).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${columns.map((c) => c + ' = EXCLUDED.' + c).join(', ')},
       updated_at = NOW() RETURNING preference_id`,
    [userId, ...values],
    context
  );
  if (!rows.length) throw new Error('Notification preference update returned no row');
  return { success: true };
}
export function scheduleNotification(
  nk: Runtime.Nakama,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    scheduledFor: Date;
    data?: Record<string, string>;
  },
  context?: SqlContext
): { success: boolean; notificationId: string } {
  const { userId, type, title, body, scheduledFor, data = {} } = input;
  const rows = observedSqlQuery(
    nk,
    'notification_schedule',
    `INSERT INTO scheduled_notifications (user_id, notification_type, title, body, data, scheduled_for, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING notification_id`,
    [userId, type, title, body, JSON.stringify(data), scheduledFor.toISOString()],
    context
  );
  const id = (rows[0] as { notification_id?: string } | undefined)?.notification_id;
  if (!id) throw new Error('Notification schedule returned no identifier');
  return { success: true, notificationId: id };
}
export function cancelScheduledNotification(
  nk: Runtime.Nakama,
  userId: string,
  notificationId: string,
  context?: SqlContext
): { success: boolean } {
  const rows = observedSqlQuery(
    nk,
    'notification_cancel',
    `UPDATE scheduled_notifications SET status = 'cancelled', updated_at = NOW()
     WHERE notification_id = $1 AND user_id = $2 AND status = 'pending' RETURNING notification_id`,
    [notificationId, userId],
    context
  );
  return { success: rows.length > 0 };
}
export function getRegisteredDeviceCount(
  nk: Runtime.Nakama,
  userId: string,
  context?: SqlContext
): number {
  const rows = observedSqlQuery(
    nk,
    'notification_device_count',
    'SELECT COUNT(*) as count FROM device_tokens WHERE user_id = $1',
    [userId],
    context
  );
  const count = Number((rows[0] as { count?: unknown } | undefined)?.count);
  if (!Number.isFinite(count) || count < 0) throw new Error('Invalid notification device count');
  return count;
}
