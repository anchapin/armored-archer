import { boolean, object, optional, record, safeParse, string } from 'valibot';

export class NotificationInputError extends Error {}
const optionalString = optional(string());
const schemas = {
  register: object({
    deviceToken: string(),
    platform: string(),
    appVersion: optionalString,
    fcmToken: optionalString,
  }),
  remove: object({ deviceToken: string() }),
  preferences: object({
    dailyRewardsEnabled: optional(boolean()),
    eventsEnabled: optional(boolean()),
    pvpChallengesEnabled: optional(boolean()),
    promotionsEnabled: optional(boolean()),
    notificationsEnabled: optional(boolean()),
    quietHoursEnabled: optional(boolean()),
    quietHoursStart: optionalString,
    quietHoursEnd: optionalString,
    timezone: optionalString,
  }),
  schedule: object({
    type: string(),
    title: optionalString,
    body: optionalString,
    scheduledFor: string(),
    data: optional(record(string(), string())),
  }),
  cancel: object({ notificationId: string() }),
  empty: object({}),
};
// Conservative persistence limits, not a promise of FCM payload acceptance.
export const NOTIFICATION_INPUT_LIMITS = {
  payload: 65536,
  token: 4096,
  text: 4096,
  appVersion: 128,
  timezone: 128,
};
export function parseNotificationInput(
  payload: string,
  kind: keyof typeof schemas
): Record<string, any> {
  if (typeof payload !== 'string' || payload.length > NOTIFICATION_INPUT_LIMITS.payload) {
    throw new NotificationInputError('Invalid notification payload');
  }
  let input: unknown;
  try {
    input = JSON.parse(payload);
  } catch {
    throw new NotificationInputError('Invalid JSON payload');
  }
  const parsed = safeParse(schemas[kind], input);
  if (!parsed.success) throw new NotificationInputError('Invalid notification payload');
  const value = parsed.output as Record<string, any>;
  if (kind === 'preferences') {
    const allowed = [
      'dailyRewardsEnabled',
      'eventsEnabled',
      'pvpChallengesEnabled',
      'promotionsEnabled',
      'notificationsEnabled',
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'timezone',
    ];
    if (Object.keys(input as object).some((k) => !allowed.includes(k))) {
      throw new NotificationInputError('Invalid preference field');
    }
  }
  validateFields(value);
  if (kind === 'schedule') validateSchedule(value);
  return value;
}

function validateFields(value: Record<string, any>): void {
  for (const key of [
    'deviceToken',
    'fcmToken',
    'notificationId',
    'title',
    'body',
    'appVersion',
    'timezone',
  ]) {
    const text = value[key];
    const limit =
      key === 'appVersion'
        ? NOTIFICATION_INPUT_LIMITS.appVersion
        : key === 'timezone'
          ? NOTIFICATION_INPUT_LIMITS.timezone
          : NOTIFICATION_INPUT_LIMITS.text;
    if (
      text !== undefined &&
      (!text.length || text.length > limit || text.indexOf('\u0000') >= 0)
    ) {
      throw new NotificationInputError('Invalid notification field');
    }
  }
  for (const key of ['quietHoursStart', 'quietHoursEnd']) {
    if (value[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value[key])) {
      throw new NotificationInputError('Invalid quiet hours');
    }
  }
}
function validateSchedule(value: Record<string, any>): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(
      value.scheduledFor
    ) ||
    !Number.isFinite(new Date(value.scheduledFor).getTime())
  ) {
    throw new NotificationInputError('Invalid scheduled time');
  }
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value.scheduledFor)!;
  const year = Number(parts[1]),
    month = Number(parts[2]),
    day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    Number(parts[4]) > 23 ||
    Number(parts[5]) > 59 ||
    Number(parts[6]) > 59
  ) {
    throw new NotificationInputError('Invalid scheduled time');
  }
  if (
    value.data &&
    Object.keys(value.data).some(
      (k) => !k.length || k.indexOf('\u0000') >= 0 || value.data[k].indexOf('\u0000') >= 0
    )
  )
    throw new NotificationInputError('Invalid notification data');
}
