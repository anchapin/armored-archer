import { registerNotificationEndpoints, initializeNotifications } from '../notifications_rpc';
import { NOTIFICATION_INPUT_LIMITS } from '../notification_validation';
import { logger as moduleLogger } from '../../config/logger';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
const prefs = {
  preference_id: 'p',
  user_id: 'owner',
  daily_rewards_enabled: true,
  events_enabled: true,
  pvp_challenges_enabled: true,
  promotions_enabled: false,
  notifications_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '08:00:00',
  timezone: 'UTC',
};
const payloads: Record<string, object> = {
  register_device_token: {
    deviceToken: 'device',
    platform: 'ios',
    appVersion: '1.0',
    fcmToken: 'fcm',
  },
  remove_device_token: { deviceToken: 'device' },
  get_notification_preferences: {},
  update_notification_preferences: { notificationsEnabled: false },
  schedule_notification: { type: 'daily_reward', scheduledFor: '2026-10-12T10:00:00Z' },
  cancel_notification: { notificationId: 'notification' },
  get_notification_status: {},
};
const names = Object.keys(payloads);
const secret = 'SECRET postgres://private SELECT FROM device_tokens';
describe('Synchronous notification RPC control plane', () => {
  let handlers: Record<string, Function>;
  let log: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let nk: { sqlQuery: jest.Mock; metricsCounterAdd: jest.Mock };
  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    nk = {
      sqlQuery: jest.fn(() => [
        { ...prefs, token_id: 't', notification_id: 'notification', count: 2 },
      ]),
      metricsCounterAdd: jest.fn(),
    };
    registerNotificationEndpoints({
      registerRpc: (name: string, fn: Function) => {
        handlers[name] = fn;
      },
    } as any);
  });
  function call(
    name: string,
    payload: unknown = payloads[name],
    userId: string | undefined = 'owner'
  ): any {
    const result = handlers['armored_archer_' + name](
      { userId },
      log,
      nk,
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );
    expect(typeof result).toBe('string');
    expect(result).not.toBeInstanceOf(Promise);
    return JSON.parse(result);
  }
  test('registers the same seven RPC names', () => {
    expect(Object.keys(handlers).sort()).toEqual(names.map((n) => 'armored_archer_' + n).sort());
  });
  test.each(names)('%s returns a synchronous string on success', (name) => {
    const result = call(name);
    expect(result.success ?? true).toBe(true);
    expect(nk.sqlQuery).toHaveBeenCalled();
  });
  test.each(names)('%s rejects missing authenticated user before SQL', (name) => {
    expect(call(name, payloads[name], '').error_code).toBe('AUTH_REQUIRED');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test.each(names)('%s redacts SQL failure and records fixed operation', (name) => {
    nk.sqlQuery.mockImplementation(() => {
      throw new Error(secret);
    });
    const result = call(name);
    expect(result.success).toBe(false);
    expect(result.error_code).toBe(
      name === 'schedule_notification' ||
        name === 'cancel_notification' ||
        name === 'get_notification_status'
        ? 'NOTIFICATION_DISPATCH_FAILED'
        : 'NOTIFICATION_PERSISTENCE_FAILED'
    );
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain(secret);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      expect.objectContaining({ rpc: 'armored_archer_' + name, op: expect.any(String) }),
      1
    );
  });
  test.each(names)('%s rejects malformed JSON without SQL', (name) => {
    expect(call(name, '{').error_code).toBe('INVALID_ARGUMENT');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test.each(names)('%s rejects non-object payloads', (name) => {
    expect(call(name, null).error_code).toBe('INVALID_ARGUMENT');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test.each(names)('%s rejects excessive payloads', (name) => {
    expect(call(name, 'x'.repeat(NOTIFICATION_INPUT_LIMITS.payload + 1)).error_code).toBe(
      'INVALID_ARGUMENT'
    );
  });
  test('bootstrap does not import or initialize Firebase transport', () => {
    initializeNotifications();
    expect(moduleLogger.info).toHaveBeenCalledWith(
      'Notification persistence initialized; push delivery not initialized'
    );
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../notifications_rpc.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/from ['"]\.\/notifications['"]/);
    expect(source).not.toContain('initializeFirebase');
  });
  test('device removal scopes the same token to authenticated owner', () => {
    call('remove_device_token');
    expect(nk.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('device_token = $1 AND user_id = $2'),
      ['device', 'owner']
    );
  });
  test('cancellation requires ownership and pending state', () => {
    call('cancel_notification');
    expect(nk.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining("user_id = $2 AND status = 'pending'"),
      ['notification', 'owner']
    );
  });
  test.each(['remove_device_token', 'cancel_notification'])(
    '%s foreign and absent rows have identical failures',
    (name) => {
      nk.sqlQuery.mockReturnValue([]);
      expect(call(name)).toEqual({ success: false });
    }
  );
  test('preference creation uses a single race-safe upsert and preserves response fields', () => {
    const result = call('get_notification_preferences');
    expect(nk.sqlQuery).toHaveBeenCalledTimes(1);
    expect(nk.sqlQuery.mock.calls[0][0]).toContain('ON CONFLICT (user_id)');
    expect(result.preferences).toEqual({
      dailyRewardsEnabled: true,
      eventsEnabled: true,
      pvpChallengesEnabled: true,
      promotionsEnabled: false,
      notificationsEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00:00',
      quietHoursEnd: '08:00:00',
      timezone: 'UTC',
    });
  });
  test('update before read creates defaults and only updates supplied fields', () => {
    call('update_notification_preferences');
    const [sql, args] = nk.sqlQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO notification_preferences');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).not.toContain('events_enabled');
    expect(args).toEqual(['owner', false]);
  });
  test('empty preference update is a safe unsuccessful result', () => {
    expect(call('update_notification_preferences', {})).toEqual({
      success: false,
      error: 'No preferences to update',
    });
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test.each([
    'register_device_token',
    'get_notification_preferences',
    'update_notification_preferences',
    'schedule_notification',
  ])('%s cannot claim successful persistence without returned row', (name) => {
    nk.sqlQuery.mockReturnValue([]);
    expect(call(name).success).toBe(false);
  });
  test('scheduling stores pending work without provider sends and returns ID', () => {
    expect(call('schedule_notification')).toEqual({
      success: true,
      notificationId: 'notification',
    });
    expect(nk.sqlQuery.mock.calls[0][0]).toContain("'pending'");
  });
  test('status reports count, not worker readiness', () => {
    expect(call('get_notification_status')).toEqual({
      firebaseEnabled: false,
      registeredDevices: 2,
    });
    nk.sqlQuery.mockReturnValue([{ count: '0' }]);
    expect(call('get_notification_status').registeredDevices).toBe(0);
  });
  test.each([{ rows: [] }, { rows: [{ count: 'bad' }] }, { rows: [{ count: -1 }] }])(
    'malformed status count fails instead of claiming zero',
    ({ rows }) => {
      nk.sqlQuery.mockReturnValue(rows);
      expect(call('get_notification_status').success).toBe(false);
    }
  );
  const invalidInputs: [string, object][] = [
    ['register_device_token', { deviceToken: 123, platform: 'ios' }],
    ['register_device_token', { deviceToken: 't', platform: 'windows' }],
    ['register_device_token', { deviceToken: 't', platform: 'ios', fcmToken: null }],
    ['remove_device_token', { deviceToken: '' }],
    ['remove_device_token', { deviceToken: 'x'.repeat(4097) }],
    ['cancel_notification', { notificationId: [] }],
    ['update_notification_preferences', { notificationsEnabled: 'false' }],
    ['update_notification_preferences', { unexpected: true }],
    ['update_notification_preferences', { quietHoursStart: '24:01' }],
    ['update_notification_preferences', { quietHoursEnd: '12:75:00' }],
    ['update_notification_preferences', { timezone: '' }],
    ['schedule_notification', { type: 'custom', scheduledFor: 'tomorrow' }],
    [
      'schedule_notification',
      { type: 'custom', scheduledFor: '2026-10-12T10:00:00Z', data: { n: 2 } },
    ],
    [
      'schedule_notification',
      { type: 'custom', scheduledFor: '2026-10-12T10:00:00Z', title: ['bad'] },
    ],
    [
      'schedule_notification',
      { type: 'custom', scheduledFor: '2026-10-12T10:00:00Z', body: '\u0000' },
    ],
  ];
  test.each(invalidInputs)('%s validates input before persistence', (name, payload) => {
    expect(call(name, payload).success).toBe(false);
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test('timezone is validated using PostgreSQL timezone catalog, not unsupported Intl', () => {
    nk.sqlQuery.mockReturnValueOnce([{ name: 'America/New_York' }]);
    expect(call('update_notification_preferences', { timezone: 'America/New_York' }).success).toBe(
      true
    );
    expect(nk.sqlQuery.mock.calls[0]).toEqual([
      'SELECT name FROM pg_timezone_names WHERE name = $1',
      ['America/New_York'],
    ]);
    nk.sqlQuery.mockReturnValueOnce([]);
    expect(call('update_notification_preferences', { timezone: 'Bad/Zone' }).error_code).toBe(
      'INVALID_ARGUMENT'
    );
  });
  test('template fallback stays available without transport import', () => {
    const { getNotificationTemplate } = require('../notification_templates');
    expect(getNotificationTemplate('unknown')).toEqual(getNotificationTemplate('custom'));
  });
  test('scheduling preserves supplied text and string data', () => {
    call('schedule_notification', {
      type: 'custom',
      title: 'Title',
      body: 'Body',
      scheduledFor: '2026-10-12T10:00:00Z',
      data: { action: 'view' },
    });
    expect(nk.sqlQuery.mock.calls[0][1]).toEqual([
      'owner',
      'custom',
      'Title',
      'Body',
      '{"action":"view"}',
      '2026-10-12T10:00:00.000Z',
    ]);
  });
  test('calendar rollover is invalid, not silently normalized', () => {
    expect(
      call('schedule_notification', { type: 'custom', scheduledFor: '2026-02-30T10:00:00Z' })
        .error_code
    ).toBe('INVALID_ARGUMENT');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
  test('registered no-op mutations do not reveal existence', () => {
    nk.sqlQuery.mockReturnValue([]);
    expect(call('remove_device_token')).toEqual(call('cancel_notification'));
  });
  test('metric failure cannot replace SQL failure', () => {
    nk.sqlQuery.mockImplementation(() => {
      throw new Error(secret);
    });
    nk.metricsCounterAdd.mockImplementation(() => {
      throw new Error('metric');
    });
    expect(call('remove_device_token').error_code).toBe('NOTIFICATION_PERSISTENCE_FAILED');
  });
});
