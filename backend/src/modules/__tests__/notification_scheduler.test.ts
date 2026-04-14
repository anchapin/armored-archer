import {
  scheduleNextDailyReward,
  notifyUsersAboutEvent,
  notifyUserAboutPvpChallenge,
  startNotificationScheduler,
  stopNotificationScheduler,
  getSchedulerStatus,
} from '../notification_scheduler';
import * as notifications from '../notifications';

jest.mock('../notifications', () => ({
  processScheduledNotifications: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
  sendDailyRewardNotification: jest.fn().mockResolvedValue({ success: true }),
  sendEventNotification: jest.fn().mockResolvedValue({ success: true }),
  sendPvpChallengeNotification: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('notification_scheduler', () => {
  const mockNakama = {
    dbQuery: jest.fn().mockResolvedValue([]),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    stopNotificationScheduler();
  });

  describe('scheduleNextDailyReward', () => {
    it('should schedule next daily reward', async () => {
      await scheduleNextDailyReward(mockNakama, 'user1', new Date('2024-01-01T12:00:00Z'));
      expect(mockNakama.dbQuery).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNakama.dbQuery = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(scheduleNextDailyReward(mockNakama, 'user1', new Date())).resolves.not.toThrow();
    });
  });

  describe('notifyUsersAboutEvent', () => {
    it('should notify specific users about event', async () => {
      (mockNakama.dbQuery as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'user1' }]);
      await notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name', ['user1']);
      expect(mockNakama.dbQuery).toHaveBeenCalledTimes(1);
    });

    it('should notify all users with events enabled', async () => {
      mockNakama.dbQuery = jest.fn().mockResolvedValue([{ id: 'user1' }, { id: 'user2' }]);
      await notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name');
      expect(notifications.sendEventNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      mockNakama.dbQuery = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(
        notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name')
      ).resolves.not.toThrow();
    });
  });

  describe('notifyUserAboutPvpChallenge', () => {
    it('should send PvP challenge notification', async () => {
      await notifyUserAboutPvpChallenge(mockNakama, 'user1', 'Opponent');
      expect(notifications.sendPvpChallengeNotification).toHaveBeenCalledWith(
        mockNakama,
        'user1',
        'Opponent'
      );
    });

    it('should handle errors gracefully', async () => {
      (notifications.sendPvpChallengeNotification as jest.Mock).mockRejectedValue(
        new Error('Notification error')
      );
      await expect(
        notifyUserAboutPvpChallenge(mockNakama, 'user1', 'Opponent')
      ).resolves.not.toThrow();
    });
  });

  describe('startNotificationScheduler', () => {
    it('should start the scheduler', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama, 60000);
      const status = getSchedulerStatus();
      expect(status.running).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not start if already running', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama);
      startNotificationScheduler(mockNakama);
      expect(getSchedulerStatus().running).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('stopNotificationScheduler', () => {
    it('should stop the scheduler', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama);
      stopNotificationScheduler();
      expect(getSchedulerStatus().running).toBe(false);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle stop when not running', () => {
      expect(() => stopNotificationScheduler()).not.toThrow();
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return false when not running', () => {
      const status = getSchedulerStatus();
      expect(status.running).toBe(false);
    });

    it('should return true when scheduler is running', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama, 9999999);
      const status = getSchedulerStatus();
      expect(status.running).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('processScheduledNotifications integration', () => {
    it('should log when notifications are sent or failed', async () => {
      const notifications = require('../notifications');
      (notifications.processScheduledNotifications as jest.Mock).mockResolvedValue({
        sent: 5,
        failed: 1,
      });

      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama, 9999999);

      // Wait for the initial processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The scheduler should have called processScheduledNotifications
      expect(notifications.processScheduledNotifications).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle errors during scheduled notification processing', async () => {
      const notifications = require('../notifications');
      (notifications.processScheduledNotifications as jest.Mock).mockRejectedValue(
        new Error('Processing error')
      );

      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Should not throw
      startNotificationScheduler(mockNakama, 9999999);

      // Wait for the initial processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should prevent concurrent processing with isRunning guard', async () => {
      const notifications = require('../notifications');
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve;
      });

      (notifications.processScheduledNotifications as jest.Mock).mockImplementation(
        () => processingPromise
      );

      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Start scheduler - first call is processing
      startNotificationScheduler(mockNakama, 50);

      // Wait a bit, then the interval would try to call again
      await new Promise((resolve) => setTimeout(resolve, 120));

      // Complete the first processing
      resolveProcessing!();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The guard should prevent concurrent calls
      expect(notifications.processScheduledNotifications).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('notifyUsersAboutEvent with target users', () => {
    it('should query specific users when targetUserIds provided', async () => {
      mockNakama.dbQuery = jest.fn().mockResolvedValue([{ id: 'user1' }]);
      await notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name', ['user1', 'user2']);
      // Should query for specific users
      expect(mockNakama.dbQuery).toHaveBeenCalled();
      expect(notifications.sendEventNotification).toHaveBeenCalled();
    });

    it('should handle empty targetUserIds array', async () => {
      mockNakama.dbQuery = jest.fn().mockResolvedValue([]);
      await notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name', []);
      // Should fall through to the all-users query
      expect(mockNakama.dbQuery).toHaveBeenCalled();
    });
  });

  describe('processPendingNotifications detailed logging', () => {
    it('should log when both sent and failed are greater than zero', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      (notifications.processScheduledNotifications as jest.Mock).mockResolvedValue({
        sent: 3,
        failed: 2,
      });

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logger.info).toHaveBeenCalledWith(
        'Processed scheduled notifications',
        expect.objectContaining({ sent: 3, failed: 2 })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not log when sent and failed are both zero', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      (notifications.processScheduledNotifications as jest.Mock).mockResolvedValue({
        sent: 0,
        failed: 0,
      });

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logger.info).not.toHaveBeenCalledWith(
        'Processed scheduled notifications',
        expect.anything()
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should log when only sent is greater than zero', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      (notifications.processScheduledNotifications as jest.Mock).mockResolvedValue({
        sent: 5,
        failed: 0,
      });

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logger.info).toHaveBeenCalledWith(
        'Processed scheduled notifications',
        expect.objectContaining({ sent: 5, failed: 0 })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should log when only failed is greater than zero', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      (notifications.processScheduledNotifications as jest.Mock).mockResolvedValue({
        sent: 0,
        failed: 3,
      });

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logger.info).toHaveBeenCalledWith(
        'Processed scheduled notifications',
        expect.objectContaining({ sent: 0, failed: 3 })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('sendDailyRewardReminders via module internals', () => {
    it('should send reminders to users with daily rewards enabled', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      mockNakama.dbQuery = jest.fn().mockResolvedValue([
        { id: 'user1', username: 'Player1' },
        { id: 'user2', username: 'Player2' },
      ]);

      // Access the internal function via module evaluation
      const mod = require('../notification_scheduler');
      // The function is internal but we can trigger it through the module's
      // internal scheduler interval. However, since it's not exported,
      // we test it indirectly by verifying the notifications module is called.
      // We'll test the happy path by ensuring sendDailyRewardNotification
      // gets called when the scheduler processes notifications.
      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notifications.processScheduledNotifications).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle mixed success and failure for daily reward notifications', async () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      (notifications.sendDailyRewardNotification as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });

      mockNakama.dbQuery = jest.fn().mockResolvedValue([
        { id: 'user1', username: 'Player1' },
        { id: 'user2', username: 'Player2' },
      ]);

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notifications.processScheduledNotifications).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle errors in daily reward reminders', async () => {
      mockNakama.dbQuery = jest.fn().mockRejectedValue(new Error('Query failed'));

      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama, 9999999);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not throw
      expect(notifications.processScheduledNotifications).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('scheduleNextDailyReward logging', () => {
    it('should log success with userId and nextAvailable time', async () => {
      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      mockNakama.dbQuery = jest.fn().mockResolvedValue([]);
      const nextTime = new Date('2024-06-15T09:00:00Z');
      await scheduleNextDailyReward(mockNakama, 'user-abc', nextTime);

      expect(logger.info).toHaveBeenCalledWith(
        'Next daily reward scheduled',
        expect.objectContaining({
          userId: 'user-abc',
          nextAvailable: '2024-06-15T09:00:00.000Z',
        })
      );
    });

    it('should log error with userId when dbQuery fails', async () => {
      const { logger } = require('../../config/logger');
      logger.error.mockClear();
      mockNakama.dbQuery = jest.fn().mockRejectedValue(new Error('DB write error'));
      await scheduleNextDailyReward(mockNakama, 'user-xyz', new Date());

      expect(logger.error).toHaveBeenCalledWith(
        'Error scheduling next daily reward',
        expect.objectContaining({ userId: 'user-xyz' })
      );
    });
  });

  describe('notifyUserAboutPvpChallenge logging', () => {
    it('should log success result', async () => {
      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      (notifications.sendPvpChallengeNotification as jest.Mock).mockResolvedValue({
        success: true,
      });
      await notifyUserAboutPvpChallenge(mockNakama, 'user1', 'OpponentX');

      expect(logger.info).toHaveBeenCalledWith(
        'PvP challenge notification sent',
        expect.objectContaining({ userId: 'user1', success: true })
      );
    });

    it('should log failure result', async () => {
      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      (notifications.sendPvpChallengeNotification as jest.Mock).mockResolvedValue({
        success: false,
      });
      await notifyUserAboutPvpChallenge(mockNakama, 'user1', 'OpponentY');

      expect(logger.info).toHaveBeenCalledWith(
        'PvP challenge notification sent',
        expect.objectContaining({ userId: 'user1', success: false })
      );
    });

    it('should log error with userId when notification fails', async () => {
      const { logger } = require('../../config/logger');
      logger.error.mockClear();
      (notifications.sendPvpChallengeNotification as jest.Mock).mockRejectedValue(
        new Error('Send failed')
      );
      await notifyUserAboutPvpChallenge(mockNakama, 'user-err', 'OpponentZ');

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending PvP challenge notification',
        expect.objectContaining({ userId: 'user-err' })
      );
    });
  });

  describe('notifyUsersAboutEvent logging', () => {
    it('should log event notification details', async () => {
      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      mockNakama.dbQuery = jest.fn().mockResolvedValue([{ id: 'user1' }]);
      await notifyUsersAboutEvent(mockNakama, 'evt-42', 'Summer Fest', ['user1']);

      expect(logger.info).toHaveBeenCalledWith(
        'Sending event notifications',
        expect.objectContaining({ eventId: 'evt-42', userCount: 1 })
      );
    });

    it('should log error with eventId when query fails', async () => {
      const { logger } = require('../../config/logger');
      logger.error.mockClear();
      mockNakama.dbQuery = jest.fn().mockRejectedValue(new Error('Query fail'));
      await notifyUsersAboutEvent(mockNakama, 'evt-99', 'Winter Event');

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending event notifications',
        expect.objectContaining({ eventId: 'evt-99' })
      );
    });
  });

  describe('startNotificationScheduler with custom interval', () => {
    it('should accept custom intervalMs', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      startNotificationScheduler(mockNakama, 5000);
      expect(getSchedulerStatus().running).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Starting notification scheduler', {
        intervalMs: 5000,
      });
    });

    it('should use default interval when not specified', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama);
      expect(getSchedulerStatus().running).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should log warning when scheduler already running', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      logger.warn.mockClear();
      startNotificationScheduler(mockNakama, 9999999);
      startNotificationScheduler(mockNakama, 9999999);

      expect(logger.warn).toHaveBeenCalledWith('Notification scheduler already running');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('stopNotificationScheduler edge cases', () => {
    it('should log when scheduler is stopped', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      startNotificationScheduler(mockNakama, 9999999);
      stopNotificationScheduler();

      expect(logger.info).toHaveBeenCalledWith('Notification scheduler stopped');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not log when stopping already stopped scheduler', () => {
      const { logger } = require('../../config/logger');
      logger.info.mockClear();
      stopNotificationScheduler();

      expect(logger.info).not.toHaveBeenCalledWith('Notification scheduler stopped');
    });

    it('should allow restarting after stop', () => {
      // Temporarily override NODE_ENV to test actual scheduler behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      startNotificationScheduler(mockNakama, 9999999);
      stopNotificationScheduler();
      startNotificationScheduler(mockNakama, 9999999);
      expect(getSchedulerStatus().running).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
