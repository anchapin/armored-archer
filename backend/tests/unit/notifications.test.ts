import {
  getNotificationTemplate,
  isFirebaseInitialized,
  initializeFirebase,
  sendPushNotification,
  sendBatchNotifications,
  registerDeviceToken,
  removeDeviceToken,
  getUserDeviceTokens,
  getNotificationPreferences,
  updateNotificationPreferences,
  scheduleNotification,
  cancelScheduledNotification,
  getPendingNotifications,
  markNotificationSent,
  logNotificationHistory,
  shouldSendNotification,
  processScheduledNotifications,
  sendDailyRewardNotification,
  sendEventNotification,
  sendPvpChallengeNotification,
  NotificationType,
} from '../../src/modules/notifications';

// Mock Runtime.Nakama interface
const createMockNk = (overrides: Record<string, unknown> = {}): any => ({
  dbQuery: jest.fn().mockResolvedValue([]),
  storageRead: jest.fn().mockResolvedValue([]),
  storageWrite: jest.fn().mockReturnValue([]),
  ...overrides,
});

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state
    (require('../../src/modules/notifications') as any).firebaseInitialized = false;
    (require('../../src/modules/notifications') as any).firebaseMessaging = null;
  });

  describe('getNotificationTemplate', () => {
    it('should return daily_reward template', () => {
      const template = getNotificationTemplate('daily_reward');
      expect(template.title).toContain('Daily Rewards');
      expect(template.body).toBeDefined();
    });

    it('should return event template', () => {
      const template = getNotificationTemplate('event');
      expect(template.title).toContain('New Event');
    });

    it('should return pvp_challenge template', () => {
      const template = getNotificationTemplate('pvp_challenge');
      expect(template.title).toContain('PvP');
    });

    it('should return promotion template', () => {
      const template = getNotificationTemplate('promotion');
      expect(template.title).toContain('Special');
    });

    it('should return custom template for unknown type', () => {
      const template = getNotificationTemplate('custom' as NotificationType);
      expect(template.title).toBeDefined();
    });

    it('should return custom template for invalid type', () => {
      const template = getNotificationTemplate('unknown' as NotificationType);
      expect(template.title).toContain('Announcement');
    });
  });

  describe('isFirebaseInitialized', () => {
    it('should return false when Firebase is not initialized', () => {
      expect(isFirebaseInitialized()).toBe(false);
    });
  });

  describe('initializeFirebase', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return false when Firebase is disabled in config', () => {
      // Mock config to have firebase disabled
      jest.doMock('../../src/config', () => ({
        config: {
          firebase: {
            enabled: false,
          },
        },
      }));

      const result = initializeFirebase();
      expect(result).toBe(false);
    });

    it('should return false when Firebase config is incomplete', () => {
      jest.doMock('../../src/config', () => ({
        config: {
          firebase: {
            enabled: true,
            projectId: undefined,
            privateKey: undefined,
            clientEmail: undefined,
          },
        },
      }));

      const result = initializeFirebase();
      expect(result).toBe(false);
    });

    it('should return false when Firebase initialization fails', () => {
      jest.doMock('../../src/config', () => ({
        config: {
          firebase: {
            enabled: true,
            projectId: 'test-project',
            privateKey: 'invalid-key',
            clientEmail: 'test@test.com',
            databaseUrl: 'https://test.firebaseio.com',
          },
        },
      }));

      const result = initializeFirebase();
      expect(result).toBe(false);
    });
  });

  describe('sendPushNotification', () => {
    it('should return error when Firebase not initialized', async () => {
      const result = await sendPushNotification('token123', 'Test Title', 'Test Body');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });
  });

  describe('sendBatchNotifications', () => {
    it('should return error when Firebase not initialized', async () => {
      const result = await sendBatchNotifications(['token1', 'token2'], 'Title', 'Body');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toContain('Firebase not initialized');
    });
  });

  describe('registerDeviceToken', () => {
    it('should register device token successfully', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([{ token_id: '123' }]),
      });

      const result = await registerDeviceToken(mockNk, 'user123', 'token123', 'android');

      expect(result.success).toBe(true);
      expect(mockNk.dbQuery).toHaveBeenCalled();
    });

    it('should return error on database failure', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await registerDeviceToken(mockNk, 'user123', 'token123', 'ios');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('removeDeviceToken', () => {
    it('should remove device token successfully', async () => {
      const mockNk = createMockNk();

      const result = await removeDeviceToken(mockNk, 'token123');

      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await removeDeviceToken(mockNk, 'token123');

      expect(result.success).toBe(false);
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return empty array when no tokens exist', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([]),
      });

      const result = await getUserDeviceTokens(mockNk, 'user123');

      expect(result).toEqual([]);
    });

    it('should return device tokens when they exist', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { device_token: 'token1', platform: 'android', fcm_token: 'fcm1' },
          { device_token: 'token2', platform: 'ios', fcm_token: 'fcm2' },
        ]),
      });

      const result = await getUserDeviceTokens(mockNk, 'user123');

      expect(result).toHaveLength(2);
      expect(result[0].deviceToken).toBe('token1');
      expect(result[1].platform).toBe('ios');
    });

    it('should return empty array on error', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await getUserDeviceTokens(mockNk, 'user123');

      expect(result).toEqual([]);
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return null when no preferences exist and insert fails', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await getNotificationPreferences(mockNk, 'user123');

      expect(result).toBeNull();
    });

    it('should return preferences when they exist', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', daily_rewards_enabled: true, events_enabled: true },
        ]),
      });

      const result = await getNotificationPreferences(mockNk, 'user123');

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe('user123');
    });

    it('should create default preferences when none exist', async () => {
      let callCount = 0;
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([]);
          return Promise.resolve([{ user_id: 'user123', daily_rewards_enabled: true }]);
        }),
      });

      const result = await getNotificationPreferences(mockNk, 'user123');

      expect(result).not.toBeNull();
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should return error when no preferences to update', async () => {
      const mockNk = createMockNk();

      const result = await updateNotificationPreferences(mockNk, 'user123', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No preferences');
    });

    it('should update preferences successfully', async () => {
      const mockNk = createMockNk();

      const result = await updateNotificationPreferences(mockNk, 'user123', {
        dailyRewardsEnabled: false,
        eventsEnabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('should update all preference fields', async () => {
      const mockNk = createMockNk();

      const result = await updateNotificationPreferences(mockNk, 'user123', {
        dailyRewardsEnabled: false,
        eventsEnabled: false,
        pvpChallengesEnabled: false,
        promotionsEnabled: false,
        notificationsEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'America/New_York',
      });

      expect(result.success).toBe(true);
    });

    it('should return error on database failure', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await updateNotificationPreferences(mockNk, 'user123', {
        dailyRewardsEnabled: false,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('scheduleNotification', () => {
    it('should schedule notification successfully', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([{ notification_id: 'notif123' }]),
      });

      const result = await scheduleNotification(
        mockNk,
        'user123',
        'daily_reward',
        'Test Title',
        'Test Body',
        new Date()
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif123');
    });

    it('should return error on failure', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await scheduleNotification(
        mockNk,
        'user123',
        'event',
        'Test Title',
        'Test Body',
        new Date()
      );

      expect(result.success).toBe(false);
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel notification successfully', async () => {
      const mockNk = createMockNk();

      const result = await cancelScheduledNotification(mockNk, 'notif123');

      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await cancelScheduledNotification(mockNk, 'notif123');

      expect(result.success).toBe(false);
    });
  });

  describe('getPendingNotifications', () => {
    it('should return pending notifications', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { notification_id: '1', user_id: 'user1', title: 'Test' },
        ]),
      });

      const result = await getPendingNotifications(mockNk, 10);

      expect(result).toHaveLength(1);
    });

    it('should return empty array on error', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const result = await getPendingNotifications(mockNk);

      expect(result).toEqual([]);
    });
  });

  describe('markNotificationSent', () => {
    it('should mark notification as sent', async () => {
      const mockNk = createMockNk();

      await markNotificationSent(mockNk, 'notif123', true);

      expect(mockNk.dbQuery).toHaveBeenCalled();
    });

    it('should mark notification as failed', async () => {
      const mockNk = createMockNk();

      await markNotificationSent(mockNk, 'notif123', false, 'Error message');

      expect(mockNk.dbQuery).toHaveBeenCalled();
    });
  });

  describe('logNotificationHistory', () => {
    it('should log notification history', async () => {
      const mockNk = createMockNk();

      await logNotificationHistory(
        mockNk,
        'notif123',
        'user123',
        'daily_reward',
        'Title',
        'Body',
        'token123',
        'sent'
      );

      expect(mockNk.dbQuery).toHaveBeenCalled();
    });
  });

  describe('shouldSendNotification', () => {
    it('should return true when no preferences exist', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockRejectedValue(new Error('No prefs')),
      });

      const result = await shouldSendNotification(mockNk, 'user123', 'daily_reward');

      expect(result).toBe(true);
    });

    it('should return false when notifications disabled', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', notifications_enabled: false, daily_rewards_enabled: true },
        ]),
      });

      const result = await shouldSendNotification(mockNk, 'user123', 'daily_reward');

      expect(result).toBe(false);
    });

    it('should check type-specific preferences', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          {
            user_id: 'user123',
            notifications_enabled: true,
            daily_rewards_enabled: false,
            events_enabled: true,
            pvp_challenges_enabled: false,
            promotions_enabled: true,
          },
        ]),
      });

      const dailyResult = await shouldSendNotification(mockNk, 'user123', 'daily_reward');
      const eventResult = await shouldSendNotification(mockNk, 'user123', 'event');
      const pvpResult = await shouldSendNotification(mockNk, 'user123', 'pvp_challenge');

      expect(dailyResult).toBe(false);
      expect(eventResult).toBe(true);
      expect(pvpResult).toBe(false);
    });

    it('should return true for unknown type', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', notifications_enabled: true, daily_rewards_enabled: false },
        ]),
      });

      const result = await shouldSendNotification(
        mockNk,
        'user123',
        'custom' as NotificationType
      );

      expect(result).toBe(true);
    });
  });

  describe('processScheduledNotifications', () => {
    it('should process pending notifications', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([]),
        storageRead: jest.fn().mockResolvedValue([]),
        storageWrite: jest.fn().mockReturnValue([]),
      });

      const result = await processScheduledNotifications(mockNk);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('sendDailyRewardNotification', () => {
    it('should return error when user disabled daily reward notifications', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', notifications_enabled: true, daily_rewards_enabled: false },
        ]),
      });

      const result = await sendDailyRewardNotification(mockNk, 'user123');

      expect(result.success).toBe(false);
    });

    it('should return error when no device tokens', async () => {
      let callCount = 0;
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([
              { user_id: 'user123', notifications_enabled: true, daily_rewards_enabled: true },
            ]);
          }
          return Promise.resolve([]);
        }),
      });

      const result = await sendDailyRewardNotification(mockNk, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No device tokens');
    });
  });

  describe('sendEventNotification', () => {
    it('should return error when user disabled event notifications', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', notifications_enabled: true, events_enabled: false },
        ]),
      });

      const result = await sendEventNotification(mockNk, 'user123', 'Summer Event', 'event123');

      expect(result.success).toBe(false);
    });
  });

  describe('sendPvpChallengeNotification', () => {
    it('should return error when user disabled PvP notifications', async () => {
      const mockNk = createMockNk({
        dbQuery: jest.fn().mockResolvedValue([
          { user_id: 'user123', notifications_enabled: true, pvp_challenges_enabled: false },
        ]),
      });

      const result = await sendPvpChallengeNotification(mockNk, 'user123', 'Challenger');

      expect(result.success).toBe(false);
    });
  });
});
