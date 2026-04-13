import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockFirebaseConfig = {
  enabled: false,
  projectId: '',
  privateKey: '',
  clientEmail: '',
  databaseUrl: '',
};

jest.mock('../../config', () => ({
  config: {
    firebase: mockFirebaseConfig,
  },
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockSend = jest.fn();
const mockSendEachForMulticast = jest.fn();
const mockInitializeApp = jest.fn();
const mockCert = jest.fn((svc: unknown) => svc);

jest.mock(
  'firebase-admin',
  () => ({
    apps: [],
    initializeApp: mockInitializeApp,
    credential: { cert: mockCert },
    messaging: jest.fn(() => ({
      send: mockSend,
      sendEachForMulticast: mockSendEachForMulticast,
    })),
  }),
  { virtual: true }
);

import {
  getNotificationTemplate,
  initializeFirebase,
  isFirebaseInitialized,
  sendPushNotification,
  sendBatchNotifications,
  registerDeviceToken,
  removeDeviceToken,
  getUserDeviceTokens,
  getNotificationPreferences,
  updateNotificationPreferences,
  scheduleNotification,
  cancelScheduledNotification,
  shouldSendNotification,
  processScheduledNotifications,
  sendDailyRewardNotification,
  sendEventNotification,
  sendPvpChallengeNotification,
} from '../notifications';
import type { NotificationType } from '../notifications';

const createMockNk = () => ({
  dbQuery: jest.fn().mockResolvedValue([]),
  storageRead: jest.fn().mockReturnValue([]),
  storageWrite: jest.fn(),
});

describe('Notifications Module', () => {
  describe('getNotificationTemplate', () => {
    it('should return daily_reward template', () => {
      const template = getNotificationTemplate('daily_reward');
      expect(template.title).toContain('Daily Rewards');
      expect(template.body).toContain('rewards');
    });

    it('should return event template', () => {
      const template = getNotificationTemplate('event');
      expect(template.title).toContain('Event');
      expect(template.body).toContain('event');
    });

    it('should return pvp_challenge template', () => {
      const template = getNotificationTemplate('pvp_challenge');
      expect(template.title).toContain('PvP');
      expect(template.body).toContain('arena');
    });

    it('should return promotion template', () => {
      const template = getNotificationTemplate('promotion');
      expect(template.title).toContain('Special Offer');
      expect(template.body).toContain('gems');
    });

    it('should return custom template for custom type', () => {
      const template = getNotificationTemplate('custom');
      expect(template.title).toContain('Announcement');
      expect(template.body).toContain('message');
    });

    it('should return custom template as fallback for unknown types', () => {
      const template = getNotificationTemplate('nonexistent' as NotificationType);
      const customTemplate = getNotificationTemplate('custom');
      expect(template).toEqual(customTemplate);
    });

    it('all templates should have non-empty title and body', () => {
      const types: NotificationType[] = [
        'daily_reward',
        'event',
        'pvp_challenge',
        'promotion',
        'custom',
      ];
      for (const type of types) {
        const template = getNotificationTemplate(type);
        expect(template.title.length).toBeGreaterThan(0);
        expect(template.body.length).toBeGreaterThan(0);
      }
    });
  });

  describe('initializeFirebase', () => {
    it('should return false when Firebase is disabled', () => {
      const result = initializeFirebase();
      expect(result).toBe(false);
    });

    it('should track initialization state', () => {
      expect(isFirebaseInitialized()).toBe(false);
    });
  });

  describe('sendPushNotification', () => {
    it('should fail when Firebase is not initialized', async () => {
      const result = await sendPushNotification('device_token', 'Test Title', 'Test Body');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase not initialized');
    });

    it('should accept platform parameter', async () => {
      const result = await sendPushNotification('device_token', 'Title', 'Body', {}, 'ios');
      expect(result.success).toBe(false);
    });
  });

  describe('sendBatchNotifications', () => {
    it('should fail all when Firebase is not initialized', async () => {
      const result = await sendBatchNotifications(['token1', 'token2'], 'Title', 'Body');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toContain('Firebase not initialized');
    });

    it('should handle empty token list', async () => {
      const result = await sendBatchNotifications([], 'Title', 'Body');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('registerDeviceToken', () => {
    it('should register device token successfully', async () => {
      const nk = createMockNk();
      const result = await registerDeviceToken(nk as any, 'user_123', 'device_token', 'android');
      expect(result.success).toBe(true);
      expect(nk.dbQuery).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));
      const result = await registerDeviceToken(nk as any, 'user_123', 'device_token', 'ios');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });

    it('should include optional parameters', async () => {
      const nk = createMockNk();
      await registerDeviceToken(
        nk as any,
        'user_123',
        'device_token',
        'android',
        '1.0.0',
        'fcm_token'
      );
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO device_tokens'),
        expect.arrayContaining(['user_123', 'device_token', 'android', '1.0.0', 'fcm_token'])
      );
    });
  });

  describe('removeDeviceToken', () => {
    it('should remove device token successfully', async () => {
      const nk = createMockNk();
      const result = await removeDeviceToken(nk as any, 'device_token');
      expect(result.success).toBe(true);
    });

    it('should handle database errors', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('Delete failed'));
      const result = await removeDeviceToken(nk as any, 'device_token');
      expect(result.success).toBe(false);
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return device tokens for user', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        { device_token: 'tok1', platform: 'android', fcm_token: 'fcm1' },
        { device_token: 'tok2', platform: 'ios', fcm_token: 'fcm2' },
      ]);

      const tokens = await getUserDeviceTokens(nk as any, 'user_123');
      expect(tokens.length).toBe(2);
      expect(tokens[0].deviceToken).toBe('tok1');
      expect(tokens[1].platform).toBe('ios');
    });

    it('should return empty array on error', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));
      const tokens = await getUserDeviceTokens(nk as any, 'user_123');
      expect(tokens).toEqual([]);
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return existing preferences', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([{ user_id: 'user_123', notifications_enabled: true }]);

      const prefs = await getNotificationPreferences(nk as any, 'user_123');
      expect(prefs).toBeDefined();
      expect(prefs!.user_id).toBe('user_123');
    });

    it('should create default preferences when none exist', async () => {
      const nk = createMockNk();
      nk.dbQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ user_id: 'user_123', notifications_enabled: true }]);

      const prefs = await getNotificationPreferences(nk as any, 'user_123');
      expect(prefs).toBeDefined();
    });

    it('should return null on error', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValue(new Error('DB error'));
      const prefs = await getNotificationPreferences(nk as any, 'user_123');
      expect(prefs).toBeNull();
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences successfully', async () => {
      const nk = createMockNk();
      const result = await updateNotificationPreferences(nk as any, 'user_123', {
        dailyRewardsEnabled: true,
        eventsEnabled: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty preferences', async () => {
      const nk = createMockNk();
      const result = await updateNotificationPreferences(nk as any, 'user_123', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('No preferences to update');
    });

    it('should handle database errors', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('Update failed'));
      const result = await updateNotificationPreferences(nk as any, 'user_123', {
        notificationsEnabled: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should handle non-Error database exceptions', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce('string exception');
      const result = await updateNotificationPreferences(nk as any, 'user_123', {
        dailyRewardsEnabled: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('string exception');
    });

    it('should update all preference fields', async () => {
      const nk = createMockNk();
      const result = await updateNotificationPreferences(nk as any, 'user_123', {
        dailyRewardsEnabled: true,
        eventsEnabled: true,
        pvpChallengesEnabled: true,
        promotionsEnabled: false,
        notificationsEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'America/New_York',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('scheduleNotification', () => {
    it('should schedule notification successfully', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([{ notification_id: 'notif_123' }]);

      const result = await scheduleNotification(
        nk as any,
        'user_123',
        'daily_reward',
        'Title',
        'Body',
        new Date('2024-12-31')
      );
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif_123');
    });

    it('should handle scheduling errors', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('Insert failed'));
      const result = await scheduleNotification(
        nk as any,
        'user_123',
        'event',
        'Title',
        'Body',
        new Date()
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });

    it('should handle non-Error scheduling exceptions', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce('string error');
      const result = await scheduleNotification(
        nk as any,
        'user_123',
        'daily_reward',
        'Title',
        'Body',
        new Date()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('string error');
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel notification successfully', async () => {
      const nk = createMockNk();
      const result = await cancelScheduledNotification(nk as any, 'notif_123');
      expect(result.success).toBe(true);
    });

    it('should handle cancel errors', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('Cancel failed'));
      const result = await cancelScheduledNotification(nk as any, 'notif_123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancel failed');
    });

    it('should handle non-Error cancel exceptions', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce('cancel error string');
      const result = await cancelScheduledNotification(nk as any, 'notif_456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancel error string');
    });
  });

  describe('shouldSendNotification', () => {
    it('should return false when notifications are disabled', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([{ user_id: 'user_123', notifications_enabled: false }]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'daily_reward');
      expect(result).toBe(false);
    });

    it('should check type-specific preferences', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          daily_rewards_enabled: false,
        },
      ]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'daily_reward');
      expect(result).toBe(false);
    });

    it('should check event type preferences', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          events_enabled: true,
        },
      ]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'event');
      expect(result).toBe(true);
    });

    it('should check pvp_challenge type preferences', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          pvp_challenges_enabled: true,
        },
      ]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'pvp_challenge');
      expect(result).toBe(true);
    });

    it('should check promotion type preferences', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          promotions_enabled: false,
        },
      ]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'promotion');
      expect(result).toBe(false);
    });

    it('should return true for custom type (default)', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
        },
      ]);

      const result = await shouldSendNotification(nk as any, 'user_123', 'custom');
      expect(result).toBe(true);
    });

    it('should return true on error (fail open)', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));
      const result = await shouldSendNotification(nk as any, 'user_123', 'event');
      expect(result).toBe(true);
    });
  });

  describe('processScheduledNotifications', () => {
    it('should return sent/failed counts with no pending', async () => {
      const nk = createMockNk();
      const result = await processScheduledNotifications(nk as any);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should skip sending when user disabled notifications', async () => {
      const nk = createMockNk();
      nk.dbQuery
        .mockResolvedValueOnce([
          {
            notification_id: 'n1',
            user_id: 'u1',
            notification_type: 'daily_reward',
            title: 'T',
            body: 'B',
            data: {},
          },
        ])
        .mockResolvedValueOnce([{ user_id: 'u1', notifications_enabled: false }])
        .mockResolvedValueOnce({});

      const result = await processScheduledNotifications(nk as any);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should fail when no device tokens found', async () => {
      const nk = createMockNk();
      nk.dbQuery
        .mockResolvedValueOnce([
          {
            notification_id: 'n1',
            user_id: 'u1',
            notification_type: 'daily_reward',
            title: 'T',
            body: 'B',
            data: {},
          },
        ])
        .mockResolvedValueOnce([
          { user_id: 'u1', notifications_enabled: true, daily_rewards_enabled: true },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({});

      const result = await processScheduledNotifications(nk as any);
      expect(result.failed).toBe(1);
    });
  });

  describe('sendDailyRewardNotification', () => {
    it('should fail when user disabled notifications', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([{ user_id: 'user_123', notifications_enabled: false }]);

      const result = await sendDailyRewardNotification(nk as any, 'user_123');
      expect(result.success).toBe(false);
    });

    it('should fail when no device tokens', async () => {
      const nk = createMockNk();
      nk.dbQuery
        .mockResolvedValueOnce([
          { user_id: 'user_123', notifications_enabled: true, daily_rewards_enabled: true },
        ])
        .mockResolvedValueOnce([]);

      const result = await sendDailyRewardNotification(nk as any, 'user_123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No device tokens');
    });
  });

  describe('sendEventNotification', () => {
    it('should fail when user disabled event notifications', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          events_enabled: false,
        },
      ]);

      const result = await sendEventNotification(nk as any, 'user_123', 'Test Event', 'evt_1');
      expect(result.success).toBe(false);
    });
  });

  describe('sendPvpChallengeNotification', () => {
    it('should fail when user disabled pvp notifications', async () => {
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          user_id: 'user_123',
          notifications_enabled: true,
          pvp_challenges_enabled: false,
        },
      ]);

      const result = await sendPvpChallengeNotification(nk as any, 'user_123', 'Opponent');
      expect(result.success).toBe(false);
    });

    it('should fail when no device tokens', async () => {
      const nk = createMockNk();
      nk.dbQuery
        .mockResolvedValueOnce([
          {
            user_id: 'user_123',
            notifications_enabled: true,
            pvp_challenges_enabled: true,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await sendPvpChallengeNotification(nk as any, 'user_123', 'Opponent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No device tokens');
    });
  });

  describe('getPendingNotifications', () => {
    it('should return pending notifications from database', async () => {
      const { getPendingNotifications: getPending } = require('../notifications');
      const nk = createMockNk();
      nk.dbQuery.mockResolvedValue([
        {
          notification_id: 'n1',
          user_id: 'u1',
          notification_type: 'daily_reward',
          title: 'T',
          body: 'B',
          status: 'pending',
          scheduled_for: new Date(),
        },
        {
          notification_id: 'n2',
          user_id: 'u2',
          notification_type: 'event',
          title: 'T2',
          body: 'B2',
          status: 'pending',
          scheduled_for: new Date(),
        },
      ]);

      const result = await getPending(nk as any, 50);
      expect(result.length).toBe(2);
      expect(result[0].notification_id).toBe('n1');
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM scheduled_notifications'),
        [50]
      );
    });

    it('should use default limit of 100', async () => {
      const { getPendingNotifications: getPending } = require('../notifications');
      const nk = createMockNk();

      await getPending(nk as any);
      expect(nk.dbQuery).toHaveBeenCalledWith(expect.any(String), [100]);
    });

    it('should return empty array on database error', async () => {
      const { getPendingNotifications: getPending } = require('../notifications');
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));

      const result = await getPending(nk as any);
      expect(result).toEqual([]);
    });
  });

  describe('markNotificationSent', () => {
    it('should mark notification as sent successfully', async () => {
      const { markNotificationSent: markSent } = require('../notifications');
      const nk = createMockNk();

      await markSent(nk as any, 'notif_123', true);
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_notifications'),
        ['sent', null, 'notif_123']
      );
    });

    it('should mark notification as failed with error message', async () => {
      const { markNotificationSent: markSent } = require('../notifications');
      const nk = createMockNk();

      await markSent(nk as any, 'notif_123', false, 'Token expired');
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_notifications'),
        ['failed', 'Token expired', 'notif_123']
      );
    });

    it('should handle database errors gracefully', async () => {
      const { markNotificationSent: markSent } = require('../notifications');
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(markSent(nk as any, 'notif_123', true)).resolves.toBeUndefined();
    });
  });

  describe('logNotificationHistory', () => {
    it('should log notification history successfully', async () => {
      const { logNotificationHistory: logHistory } = require('../notifications');
      const nk = createMockNk();

      await logHistory(
        nk as any,
        'notif_123',
        'user_123',
        'daily_reward',
        'Title',
        'Body',
        'device_tok',
        'sent'
      );
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notification_history'),
        ['notif_123', 'user_123', 'daily_reward', 'Title', 'Body', 'device_tok', 'sent', null]
      );
    });

    it('should log failed notification with error message', async () => {
      const { logNotificationHistory: logHistory } = require('../notifications');
      const nk = createMockNk();

      await logHistory(
        nk as any,
        'notif_456',
        'user_456',
        'event',
        'Title',
        'Body',
        'device_tok',
        'failed',
        'Send failed'
      );
      expect(nk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notification_history'),
        ['notif_456', 'user_456', 'event', 'Title', 'Body', 'device_tok', 'failed', 'Send failed']
      );
    });

    it('should handle database errors gracefully', async () => {
      const { logNotificationHistory: logHistory } = require('../notifications');
      const nk = createMockNk();
      nk.dbQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        logHistory(nk as any, 'n1', 'u1', 'custom', 'T', 'B', 'tok', 'sent')
      ).resolves.toBeUndefined();
    });
  });
});

describe('Notifications Module - Firebase Enabled', () => {
  let notifs: typeof import('../notifications');

  beforeEach(() => {
    mockFirebaseConfig.enabled = true;
    mockFirebaseConfig.projectId = 'test-project';
    mockFirebaseConfig.privateKey =
      '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----';
    mockFirebaseConfig.clientEmail = 'test@test-project.iam.gserviceaccount.com';
    mockFirebaseConfig.databaseUrl = 'https://test.firebaseio.com';

    mockSend.mockResolvedValue('msg-id-123');
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });

    jest.resetModules();
    notifs = require('../notifications');
  });

  afterEach(() => {
    mockFirebaseConfig.enabled = false;
    mockFirebaseConfig.projectId = '';
    mockFirebaseConfig.privateKey = '';
    mockFirebaseConfig.clientEmail = '';
    mockFirebaseConfig.databaseUrl = '';
  });

  describe('initializeFirebase with enabled config', () => {
    it('should initialize successfully when firebase enabled with valid config', () => {
      const result = notifs.initializeFirebase();
      expect(result).toBe(true);
      expect(notifs.isFirebaseInitialized()).toBe(true);
    });

    it('should return true on subsequent calls when already initialized', () => {
      notifs.initializeFirebase();
      const result = notifs.initializeFirebase();
      expect(result).toBe(true);
    });

    it('should return false when config incomplete (missing projectId)', () => {
      mockFirebaseConfig.projectId = '';
      jest.resetModules();
      const freshNotifs: typeof import('../notifications') = require('../notifications');
      expect(freshNotifs.initializeFirebase()).toBe(false);
    });

    it('should return false when config incomplete (missing privateKey)', () => {
      mockFirebaseConfig.privateKey = '';
      jest.resetModules();
      const freshNotifs: typeof import('../notifications') = require('../notifications');
      expect(freshNotifs.initializeFirebase()).toBe(false);
    });

    it('should return false when config incomplete (missing clientEmail)', () => {
      mockFirebaseConfig.clientEmail = '';
      jest.resetModules();
      const freshNotifs: typeof import('../notifications') = require('../notifications');
      expect(freshNotifs.initializeFirebase()).toBe(false);
    });
  });

  describe('sendPushNotification with Firebase enabled', () => {
    beforeEach(() => {
      notifs.initializeFirebase();
    });

    it('should send notification on android platform', async () => {
      const result = await notifs.sendPushNotification(
        'device_token_123',
        'Test Title',
        'Test Body',
        { key: 'value' },
        'android'
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-id-123');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'device_token_123',
          notification: { title: 'Test Title', body: 'Test Body' },
          data: { key: 'value' },
          android: expect.objectContaining({
            priority: 'high',
            notification: expect.objectContaining({
              channel_id: 'armored_archer_notifications',
            }),
          }),
        })
      );
    });

    it('should send notification on ios platform', async () => {
      const result = await notifs.sendPushNotification('ios_token', 'Title', 'Body', {}, 'ios');
      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'ios_token',
          apns: expect.objectContaining({
            payload: expect.objectContaining({
              aps: expect.objectContaining({ sound: 'default', badge: 1 }),
            }),
          }),
        })
      );
    });

    it('should handle firebase send error', async () => {
      mockSend.mockRejectedValueOnce(new Error('FCM error'));
      const result = await notifs.sendPushNotification('bad_token', 'Title', 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toBe('FCM error');
    });

    it('should handle non-Error thrown from firebase send', async () => {
      mockSend.mockRejectedValueOnce('string error');
      const result = await notifs.sendPushNotification('bad_token', 'Title', 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toContain('string error');
    });

    it('should default to android platform when not specified', async () => {
      await notifs.sendPushNotification('tok', 'T', 'B');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({ priority: 'high' }),
        })
      );
    });
  });

  describe('sendBatchNotifications with Firebase enabled', () => {
    beforeEach(() => {
      notifs.initializeFirebase();
    });

    it('should send batch notifications successfully', async () => {
      const result = await notifs.sendBatchNotifications(['tok1', 'tok2'], 'Title', 'Body', {
        type: 'test',
      });
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['tok1', 'tok2'],
          notification: { title: 'Title', body: 'Body' },
          data: { type: 'test' },
        })
      );
    });

    it('should collect errors from failed individual responses', async () => {
      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 1,
        responses: [{ success: true }, { success: false, error: { message: 'Invalid token' } }],
      });

      const result = await notifs.sendBatchNotifications(['tok1', 'tok2'], 'Title', 'Body');
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Token tok2: Invalid token');
    });

    it('should collect errors when individual response has no error message', async () => {
      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 1,
        responses: [{ success: false }],
      });

      const result = await notifs.sendBatchNotifications(['tok1'], 'Title', 'Body');
      expect(result.errors).toContain('Token tok1: Unknown error');
    });

    it('should split tokens into batches of 500', async () => {
      const tokens = Array.from({ length: 1200 }, (_, i) => `tok${i}`);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 500,
        failureCount: 0,
        responses: [],
      });

      await notifs.sendBatchNotifications(tokens, 'Title', 'Body');
      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(3);
    });

    it('should handle batch-level exception', async () => {
      mockSendEachForMulticast.mockRejectedValueOnce(new Error('Batch failed'));
      const result = await notifs.sendBatchNotifications(['tok1'], 'Title', 'Body');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Batch error: Batch failed');
    });

    it('should handle non-Error batch exception', async () => {
      mockSendEachForMulticast.mockRejectedValueOnce('string batch error');
      const result = await notifs.sendBatchNotifications(['tok1'], 'Title', 'Body');
      expect(result.errors).toContain('Batch error: string batch error');
    });

    it('should handle empty token array with firebase initialized', async () => {
      const result = await notifs.sendBatchNotifications([], 'Title', 'Body');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });
  });
});
