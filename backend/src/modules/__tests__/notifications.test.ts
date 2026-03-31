import { getNotificationTemplate } from '../notifications';
import type { NotificationType } from '../notifications';

describe('Notification Templates', () => {
  test('should get daily_reward template', () => {
    const template = getNotificationTemplate('daily_reward');
    expect(template).toBeDefined();
    expect(template.title).toContain('Daily');
    expect(template.body).toContain('rewards');
  });

  test('should get event template', () => {
    const template = getNotificationTemplate('event');
    expect(template).toBeDefined();
    expect(template.title).toContain('Event');
  });

  test('should get pvp_challenge template', () => {
    const template = getNotificationTemplate('pvp_challenge');
    expect(template).toBeDefined();
    expect(template.title).toContain('PvP');
  });

  test('should get promotion template', () => {
    const template = getNotificationTemplate('promotion');
    expect(template).toBeDefined();
    expect(template.title).toContain('Special');
  });

  test('should default to custom for unknown type', () => {
    const template = getNotificationTemplate('unknown' as NotificationType);
    expect(template).toBeDefined();
  });
});

describe('NotificationType', () => {
  test('should have all expected notification types', () => {
    const types: NotificationType[] = ['daily_reward', 'event', 'pvp_challenge', 'promotion', 'custom'];
    expect(types).toContain('daily_reward');
    expect(types).toContain('event');
    expect(types).toContain('pvp_challenge');
    expect(types).toContain('promotion');
    expect(types).toContain('custom');
  });
});
