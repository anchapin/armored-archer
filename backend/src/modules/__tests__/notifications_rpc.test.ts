import { registerNotificationEndpoints } from '../notifications_rpc';

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

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('notifications_rpc', () => {
  let registeredRpcs: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    registeredRpcs = [];
  });

  describe('registerNotificationEndpoints', () => {
    test('should register all 7 RPC handlers', () => {
      const mockInitializer = {
        registerRpc: jest.fn((name, handler) => {
          registeredRpcs.push(name);
        }),
      };

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

  describe('RPC handler validation', () => {
    test('registerDeviceToken should validate deviceToken', async () => {
      const mockInitializer = {
        registerRpc: jest.fn((_name, handler) => {
          registeredRpcs.push(_name);
        }),
      };

      registerNotificationEndpoints(mockInitializer);

      const registerHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_register_device_token'
      )[1];

      const result = await registerHandler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ platform: 'ios' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing deviceToken');
    });

    test('registerDeviceToken should validate platform', async () => {
      const mockInitializer = {
        registerRpc: jest.fn((_name, handler) => {
          registeredRpcs.push(_name);
        }),
      };

      registerNotificationEndpoints(mockInitializer);

      const registerHandler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_register_device_token'
      )[1];

      const result = await registerHandler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        JSON.stringify({ deviceToken: 'token', platform: 'invalid' })
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid platform');
    });

    test('removeDeviceToken should validate deviceToken', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerNotificationEndpoints(mockInitializer);

      const handler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_remove_device_token'
      )[1];

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        '{}'
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing deviceToken');
    });

    test('scheduleNotification should validate type', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerNotificationEndpoints(mockInitializer);

      const handler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_schedule_notification'
      )[1];

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

    test('scheduleNotification should validate notification type value', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerNotificationEndpoints(mockInitializer);

      const handler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_schedule_notification'
      )[1];

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

    test('cancelNotification should validate notificationId', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerNotificationEndpoints(mockInitializer);

      const handler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_cancel_notification'
      )[1];

      const result = await handler(
        { userId: 'user-123' },
        { error: jest.fn() },
        {},
        '{}'
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Missing notificationId');
    });

    test('updateNotificationPreferences should reject invalid fields', async () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerNotificationEndpoints(mockInitializer);

      const handler = mockInitializer.registerRpc.mock.calls.find(
        (call: any[]) => call[0] === 'armored_archer_update_notification_preferences'
      )[1];

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
  });
});