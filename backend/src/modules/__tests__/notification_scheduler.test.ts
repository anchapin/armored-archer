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
      await expect(notifyUsersAboutEvent(mockNakama, 'event1', 'Event Name')).resolves.not.toThrow();
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
      startNotificationScheduler(mockNakama, 60000);
      const status = getSchedulerStatus();
      expect(status.running).toBe(true);
    });

    it('should not start if already running', () => {
      startNotificationScheduler(mockNakama);
      startNotificationScheduler(mockNakama);
      expect(getSchedulerStatus().running).toBe(true);
    });
  });

  describe('stopNotificationScheduler', () => {
    it('should stop the scheduler', () => {
      startNotificationScheduler(mockNakama);
      stopNotificationScheduler();
      expect(getSchedulerStatus().running).toBe(false);
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
  });
});
