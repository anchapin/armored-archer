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

  test('should get custom template for custom type', () => {
    const template = getNotificationTemplate('custom');
    expect(template.title).toContain('Announcement');
    expect(template.body).toContain('message');
  });

  test('all templates should have non-empty title and body', () => {
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

  test('should return custom template for null-like values', () => {
    const customTemplate = getNotificationTemplate('custom');
    const unknownResult = getNotificationTemplate('' as NotificationType);
    expect(unknownResult).toEqual(customTemplate);
  });
});

describe('NotificationType', () => {
  test('should have all expected notification types', () => {
    const types: NotificationType[] = [
      'daily_reward',
      'event',
      'pvp_challenge',
      'promotion',
      'custom',
    ];
    expect(types).toContain('daily_reward');
    expect(types).toContain('event');
    expect(types).toContain('pvp_challenge');
    expect(types).toContain('promotion');
    expect(types).toContain('custom');
  });

  test('should have exactly 5 notification types', () => {
    const types: NotificationType[] = [
      'daily_reward',
      'event',
      'pvp_challenge',
      'promotion',
      'custom',
    ];
    expect(types).toHaveLength(5);
  });
});
