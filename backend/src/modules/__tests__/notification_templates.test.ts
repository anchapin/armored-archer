/**
 * Unit tests for getNotificationTemplate (notification_templates.ts).
 *
 * The template map is the single source of push-notification copy; every
 * NotificationType variant must resolve to a non-empty title/body pair, and
 * unknown types must fall back to the generic `custom` template.
 */

import { getNotificationTemplate } from '../notification_templates';
import type { NotificationType } from '../notification_templates';

const ALL_TYPES: NotificationType[] = [
  'daily_reward',
  'event',
  'pvp_challenge',
  'promotion',
  'custom',
];

describe('getNotificationTemplate', () => {
  it.each(ALL_TYPES)('returns a template for the %s notification type', (type) => {
    const template = getNotificationTemplate(type);
    expect(typeof template.title).toBe('string');
    expect(typeof template.body).toBe('string');
    expect(template.title.length).toBeGreaterThan(0);
    expect(template.body.length).toBeGreaterThan(0);
  });

  it('returns the daily reward template', () => {
    const template = getNotificationTemplate('daily_reward');
    expect(template.title).toContain('Daily Rewards');
    expect(template.body).toContain('daily rewards');
  });

  it('returns the event template', () => {
    const template = getNotificationTemplate('event');
    expect(template.title).toContain('Event');
    expect(template.body).toContain('event');
  });

  it('returns the pvp challenge template', () => {
    const template = getNotificationTemplate('pvp_challenge');
    expect(template.title).toContain('PvP');
    expect(template.body.toLowerCase()).toContain('opponents');
  });

  it('returns the promotion template', () => {
    const template = getNotificationTemplate('promotion');
    expect(template.title).toContain('Offer');
    expect(template.body).toContain('offer');
  });

  it('returns the announcement template for custom notifications', () => {
    const template = getNotificationTemplate('custom');
    expect(template.title).toContain('Announcement');
    expect(template.body).toContain('Armored Archer');
  });

  it('falls back to the custom template for an unknown type', () => {
    const unknown = 'not_a_real_type' as NotificationType;
    expect(getNotificationTemplate(unknown)).toEqual(getNotificationTemplate('custom'));
  });

  it('returns a distinct template per notification type', () => {
    const titles = ALL_TYPES.map((type) => getNotificationTemplate(type).title);
    expect(new Set(titles).size).toBe(ALL_TYPES.length);
  });

  it('returns the same object reference on repeated calls', () => {
    expect(getNotificationTemplate('event')).toBe(getNotificationTemplate('event'));
  });
});
