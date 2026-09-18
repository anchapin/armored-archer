jest.mock('../notifications', () => ({
  registerDeviceToken: jest.fn().mockResolvedValue({ success: true }),
  removeDeviceToken: jest.fn().mockResolvedValue({ success: true }),
  getNotificationPreferences: jest.fn().mockResolvedValue({
    daily_rewards_enabled: true,
    events_enabled: true,
    pvp_challenges_enabled: false,
    promotions_enabled: true,
    notifications_enabled: true,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: 'UTC',
  }),
  updateNotificationPreferences: jest.fn().mockResolvedValue({ success: true }),
  scheduleNotification: jest.fn().mockResolvedValue({ success: true }),
  cancelScheduledNotification: jest.fn().mockResolvedValue({ success: true }),
  getNotificationTemplate: jest.fn().mockReturnValue({
    title: 'Default Title',
    body: 'Default Body',
  }),
  initializeFirebase: jest.fn(),
  isFirebaseInitialized: jest.fn().mockReturnValue(false),
}));

import { registerNotificationEndpoints, initializeNotifications } from '../notifications_rpc';

import {
  registerDeviceToken as mockRegisterDeviceToken,
  removeDeviceToken as mockRemoveDeviceToken,
  getNotificationPreferences as mockGetNotificationPreferences,
  updateNotificationPreferences as mockUpdateNotificationPreferences,
  scheduleNotification as mockScheduleNotification,
  cancelScheduledNotification as mockCancelScheduledNotification,
  getNotificationTemplate as mockGetNotificationTemplate,
  initializeFirebase as mockInitializeFirebase,
  isFirebaseInitialized as mockIsFirebaseInitialized,
} from '../notifications';

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Pull the mocked logger so we can spy on the catch-block logging that
// issue #1106 requires us to preserve.
import { logger as mockModuleLogger } from '../../config/logger';

describe('notifications_rpc', () => {
  let registeredRpcs: string[] = [];
  let capturedHandlers: Map<string, Function> = new Map();

  beforeEach(() => {
    jest.clearAllMocks();
    registeredRpcs = [];
    capturedHandlers = new Map();
  });

  function createMockInitializer() {
    return {
      registerRpc: jest.fn((name: string, handler: Function) => {
        registeredRpcs.push(name);
        capturedHandlers.set(name, handler);
      }),
    };
  }

  function getHandler(name: string): Function {
    const handler = capturedHandlers.get(name);
    if (!handler) throw new Error(`Handler not found: ${name}`);
    return handler;
  }

  describe('registerNotificationEndpoints', () => {
    test('should register all 7 RPC handlers', () => {
      const mockInitializer = createMockInitializer();

      registerNotificationEndpoints(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledTimes(7);
      expect(registeredRpcs).toContain('armored_archer_register_device_token');
      expect(registeredRpcs).toContain('armored_archer_remove_device_token');
      expect(registeredRpcs).toContain('armored_archer_get_notification_preferences');
      expect(registeredRpcs).toContain('armored_archer_update_notification_preferences');
      expect(registeredRpcs).toContain('armored_archer_schedule_notification');
      expect(registeredRpcs).toContain('armored_archer_cancel_notification');
      expect(registeredRpcs).toContain('armored_archer_get_notification_status');
    });
  });

  describe('initializeNotifications', () => {
    test('should call initializeFirebase', () => {
      initializeNotifications();
      expect(mockInitializeFirebase).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerDeviceToken RPC', () => {
    test('should validate missing deviceToken', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing deviceToken');
    });

    test('should validate missing platform', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'tok-123' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing deviceToken or platform');
    });

    test('should validate invalid platform', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'tok', platform: 'windows' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid platform');
    });

    test('should register device token successfully for ios', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'apns-token-abc', platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        'apns-token-abc',
        'ios',
        undefined,
        undefined
      );
    });

    test('should register device token successfully for android with optional fields', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-456' },
        { error: jest.fn() },
        {},
        JSON.stringify({
          deviceToken: 'fcm-token-xyz',
          platform: 'android',
          appVersion: '1.2.0',
          fcmToken: 'fcm-specific-token',
        })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
        expect.anything(),
        'user-456',
        'fcm-token-xyz',
        'android',
        '1.2.0',
        'fcm-specific-token'
      );
    });

    test('should handle registration failure', async () => {
      mockRegisterDeviceToken.mockResolvedValueOnce({ success: false, error: 'DB error' });
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'tok', platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('DB error');
    });

    test('should handle JSON parse error', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        'not-valid-json{{{'
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('removeDeviceToken RPC', () => {
    test('should validate missing deviceToken', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_remove_device_token');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing deviceToken');
    });

    test('should remove device token successfully', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_remove_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'tok-to-remove' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockRemoveDeviceToken).toHaveBeenCalledWith(expect.anything(), 'tok-to-remove');
    });

    test('should handle removal failure', async () => {
      mockRemoveDeviceToken.mockResolvedValueOnce({ success: false, error: 'Not found' });
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_remove_device_token');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'nonexistent' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Not found');
    });

    test('should handle JSON parse error', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_remove_device_token');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{{invalid');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('getNotificationPreferences RPC', () => {
    test('should return preferences successfully', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_preferences');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.preferences).toBeDefined();
      expect(parsed.preferences.dailyRewardsEnabled).toBe(true);
      expect(parsed.preferences.eventsEnabled).toBe(true);
      expect(parsed.preferences.pvpChallengesEnabled).toBe(false);
      expect(parsed.preferences.promotionsEnabled).toBe(true);
      expect(parsed.preferences.notificationsEnabled).toBe(true);
      expect(parsed.preferences.quietHoursEnabled).toBe(false);
      expect(parsed.preferences.timezone).toBe('UTC');
    });

    test('should return error when preferences not found', async () => {
      mockGetNotificationPreferences.mockResolvedValueOnce(null);
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_preferences');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Failed to get preferences');
    });

    test('should handle exception gracefully', async () => {
      mockGetNotificationPreferences.mockRejectedValueOnce(new Error('DB connection lost'));
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_preferences');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    test('should return quiet hours settings when enabled', async () => {
      mockGetNotificationPreferences.mockResolvedValueOnce({
        daily_rewards_enabled: true,
        events_enabled: false,
        pvp_challenges_enabled: true,
        promotions_enabled: false,
        notifications_enabled: true,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        timezone: 'America/New_York',
      });

      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_preferences');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.preferences.quietHoursEnabled).toBe(true);
      expect(parsed.preferences.quietHoursStart).toBe('22:00');
      expect(parsed.preferences.quietHoursEnd).toBe('08:00');
      expect(parsed.preferences.timezone).toBe('America/New_York');
    });
  });

  describe('updateNotificationPreferences RPC', () => {
    test('should reject invalid fields', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_update_notification_preferences');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ invalidField: true })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid field');
    });

    test('should update valid boolean fields', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_update_notification_preferences');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({
          dailyRewardsEnabled: false,
          eventsEnabled: true,
          pvpChallengesEnabled: true,
          promotionsEnabled: false,
          notificationsEnabled: true,
          quietHoursEnabled: true,
        })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        expect.objectContaining({
          dailyRewardsEnabled: false,
          eventsEnabled: true,
        })
      );
    });

    test('should accept quiet hours fields', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_update_notification_preferences');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({
          quietHoursStart: '23:00',
          quietHoursEnd: '07:00',
          timezone: 'Europe/London',
        })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    test('should handle JSON parse error', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_update_notification_preferences');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{bad json');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('scheduleNotification RPC', () => {
    test('should validate missing type', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ scheduledFor: '2024-01-01T12:00:00Z' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing type');
    });

    test('should validate missing scheduledFor', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ type: 'daily_reward' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing type or scheduledFor');
    });

    test('should validate invalid notification type', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ type: 'invalid_type', scheduledFor: '2024-01-01T12:00:00Z' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid notification type');
    });

    test('should schedule notification with custom title and body', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({
          type: 'daily_reward',
          title: 'Custom Title',
          body: 'Custom Body',
          scheduledFor: '2024-06-15T10:00:00Z',
          data: { reward: 'coins' },
        })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockScheduleNotification).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        'daily_reward',
        'Custom Title',
        'Custom Body',
        expect.any(Date),
        { reward: 'coins' }
      );
    });

    test('should use template when title/body not provided', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({
          type: 'event',
          scheduledFor: '2024-06-15T10:00:00Z',
        })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockGetNotificationTemplate).toHaveBeenCalledWith('event');
      expect(mockScheduleNotification).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        'event',
        'Default Title',
        'Default Body',
        expect.any(Date),
        {}
      );
    });

    test('should accept all valid notification types', async () => {
      const validTypes = ['daily_reward', 'event', 'pvp_challenge', 'promotion', 'custom'];
      for (const type of validTypes) {
        mockScheduleNotification.mockResolvedValueOnce({ success: true });
        const mockInitializer = createMockInitializer();
        registerNotificationEndpoints(mockInitializer);
        const handler = getHandler('armored_archer_schedule_notification');

        const result = await handler(
          { userId: 'user-123' },
          { error: jest.fn() },
          {},
          JSON.stringify({ type, scheduledFor: '2024-06-15T10:00:00Z' })
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      }
    });

    test('should handle JSON parse error', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_schedule_notification');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{{notjson');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('cancelNotification RPC', () => {
    test('should validate missing notificationId', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_cancel_notification');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing notificationId');
    });

    test('should cancel notification successfully', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_cancel_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ notificationId: 'notif-456' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(mockCancelScheduledNotification).toHaveBeenCalledWith(expect.anything(), 'notif-456');
    });

    test('should handle cancellation failure', async () => {
      mockCancelScheduledNotification.mockResolvedValueOnce({
        success: false,
        error: 'Notification not found',
      });
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_cancel_notification');

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ notificationId: 'nonexistent' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Notification not found');
    });

    test('should handle JSON parse error', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_cancel_notification');

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, {}, '{invalid');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('getNotificationStatus RPC', () => {
    test('should return firebase status and device count', async () => {
      mockIsFirebaseInitialized.mockReturnValueOnce(true);
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_status');

      const mockNk = {
        dbQuery: jest.fn().mockResolvedValue([{ count: 3 }]),
      };

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, mockNk, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.firebaseEnabled).toBe(true);
      expect(parsed.registeredDevices).toBe(3);
    });

    test('should return 0 devices when no tokens registered', async () => {
      mockIsFirebaseInitialized.mockReturnValueOnce(false);
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_status');

      const mockNk = {
        dbQuery: jest.fn().mockResolvedValue([]),
      };

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, mockNk, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.firebaseEnabled).toBe(false);
      expect(parsed.registeredDevices).toBe(0);
    });

    test('should handle dbQuery error gracefully', async () => {
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_status');

      const mockNk = {
        dbQuery: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      const result = await handler({ userId: 'user-123' }, { error: jest.fn() }, mockNk, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  // Issue #1106: every catch block must return a stable error_code + generic
  // safe message; the full internal error must be logged via logger.error
  // (never leaked via String(error) into the response body).
  describe('safe error responses (issue #1106)', () => {
    // Synthetic "internal" failures: SQL fragment, TypeError details, and a
    // connection string — none of these may reach the client.
    const SECRET_FRAGMENT = 'SECRET_SQL_FRAGMENT_DO_NOT_LEAK';
    const SECRET_TYPE_ERROR = 'TypeError: cannot read property "dsn" of undefined';
    const SECRET_DSN = 'postgres://user:hunter2@db.example.com:5432/nakama';

    // Each row targets one RPC, the dependency it stubs, the payload that
    // exercises the happy-path validation, and the expected stable error_code.
    const cases: Array<{
      rpc: string;
      dep:
        | 'registerDeviceToken'
        | 'removeDeviceToken'
        | 'getNotificationPreferences'
        | 'updateNotificationPreferences'
        | 'scheduleNotification'
        | 'cancelScheduledNotification';
      payload: string;
      errorCode: string;
    }> = [
      {
        rpc: 'armored_archer_register_device_token',
        dep: 'registerDeviceToken',
        payload: JSON.stringify({ deviceToken: 'tok', platform: 'ios' }),
        errorCode: 'NOTIFICATION_PERSISTENCE_FAILED',
      },
      {
        rpc: 'armored_archer_remove_device_token',
        dep: 'removeDeviceToken',
        payload: JSON.stringify({ deviceToken: 'tok' }),
        errorCode: 'NOTIFICATION_PERSISTENCE_FAILED',
      },
      {
        rpc: 'armored_archer_get_notification_preferences',
        dep: 'getNotificationPreferences',
        payload: '{}',
        errorCode: 'NOTIFICATION_PERSISTENCE_FAILED',
      },
      {
        rpc: 'armored_archer_update_notification_preferences',
        dep: 'updateNotificationPreferences',
        payload: JSON.stringify({ dailyRewardsEnabled: false }),
        errorCode: 'NOTIFICATION_PERSISTENCE_FAILED',
      },
      {
        rpc: 'armored_archer_schedule_notification',
        dep: 'scheduleNotification',
        payload: JSON.stringify({ type: 'daily_reward', scheduledFor: '2024-06-15T10:00:00Z' }),
        errorCode: 'NOTIFICATION_DISPATCH_FAILED',
      },
      {
        rpc: 'armored_archer_cancel_notification',
        dep: 'cancelScheduledNotification',
        payload: JSON.stringify({ notificationId: 'notif-1' }),
        errorCode: 'NOTIFICATION_DISPATCH_FAILED',
      },
    ];

    test.each(cases)(
      '$rpc -> returns stable error_code and does not leak internal error',
      async ({ rpc, dep, payload, errorCode }) => {
        const thrown = new Error(
          `${SECRET_TYPE_ERROR} ... SELECT * FROM users WHERE dsn='${SECRET_DSN}' ... ${SECRET_FRAGMENT}`
        );
        // Resolve the mocked module-fn by its real export name.
        const fn = jest.requireMock('../notifications')[dep] as jest.Mock;
        fn.mockRejectedValueOnce(thrown);

        const mockInitializer = createMockInitializer();
        registerNotificationEndpoints(mockInitializer);
        const handler = getHandler(rpc);

        const rpcLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
        const result = await handler({ userId: 'user-123' }, rpcLogger, {}, payload);

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error_code).toBe(errorCode);
        expect(parsed.rpc_name).toBe(rpc);
        expect(parsed.error).toBe('Internal error; see server logs');

        const serialized = JSON.stringify(parsed);
        expect(serialized).not.toContain(SECRET_FRAGMENT);
        expect(serialized).not.toContain(SECRET_DSN);
        expect(serialized).not.toContain('TypeError');
        expect(serialized).not.toContain('SELECT * FROM users');

        // Server-side log must contain the full error so ops can still trace it.
        expect(rpcLogger.error).toHaveBeenCalledTimes(1);
        const [format, ctxArg] = rpcLogger.error.mock.calls[0];
        expect(format).toContain(rpc);
        expect(format).toContain('failed');
        expect(ctxArg).toBeDefined();
        expect(ctxArg.error).toBe(thrown);
      }
    );

    test('armored_archer_get_notification_status (dbQuery throw) is also safe', async () => {
      const thrown = new Error(
        `connection failed: ${SECRET_DSN} — ${SECRET_FRAGMENT}`
      );
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_status');

      const mockNk = {
        dbQuery: jest.fn().mockRejectedValue(thrown),
      };
      const rpcLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

      const result = await handler({ userId: 'user-123' }, rpcLogger, mockNk, '{}');

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('NOTIFICATION_DISPATCH_FAILED');
      expect(parsed.rpc_name).toBe('armored_archer_get_notification_status');
      expect(parsed.error).toBe('Internal error; see server logs');

      const serialized = JSON.stringify(parsed);
      expect(serialized).not.toContain(SECRET_DSN);
      expect(serialized).not.toContain(SECRET_FRAGMENT);
      expect(serialized).not.toContain('connection failed');

      expect(rpcLogger.error).toHaveBeenCalledTimes(1);
      const [, ctxArg] = rpcLogger.error.mock.calls[0];
      expect(ctxArg.error).toBe(thrown);
    });

    test('JSON.parse error path is also safe (no String(SyntaxError) bleed)', async () => {
      // SyntaxError is a built-in thrown value with a default toString() of
      // "Unexpected token ..." that previously leaked via String(error).
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_register_device_token');

      const rpcLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
      const result = await handler(
        { userId: 'user-123' },
        rpcLogger,
        {},
        '<<not-json-at-all>>' // also includes "<" chars to stress the safe path
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('NOTIFICATION_PERSISTENCE_FAILED');
      expect(parsed.rpc_name).toBe('armored_archer_register_device_token');
      expect(parsed.error).toBe('Internal error; see server logs');

      // The SyntaxError.toString() includes "Unexpected token" — must not appear.
      const serialized = JSON.stringify(parsed);
      expect(serialized).not.toContain('Unexpected token');
      expect(serialized).not.toContain('not-json-at-all');

      // Server-side log still got the actual SyntaxError so ops can see it.
      expect(rpcLogger.error).toHaveBeenCalledTimes(1);
      const [, ctxArg] = rpcLogger.error.mock.calls[0];
      expect(ctxArg.error).toBeInstanceOf(SyntaxError);
    });

    test('module-level logger still receives safeErrorResponse calls (sanity)', () => {
      // Defensive: the file-local helper logs through the handler-scoped
      // logger parameter, but make sure we didn't accidentally route through
      // the module-level logger in a way that would double-log.
      (mockModuleLogger as unknown as { error: jest.Mock }).error.mockClear();
      mockGetNotificationPreferences.mockRejectedValueOnce(new Error('boom'));
      const mockInitializer = createMockInitializer();
      registerNotificationEndpoints(mockInitializer);
      const handler = getHandler('armored_archer_get_notification_preferences');
      return handler(
        { userId: 'user-123' },
        { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        {},
        '{}'
      ).then(() => {
        // safeErrorResponse uses the handler-scoped logger, so the module
        // logger should NOT have been called from inside the catch block.
        expect((mockModuleLogger as unknown as { error: jest.Mock }).error).not.toHaveBeenCalled();
      });
    });
  });
});
