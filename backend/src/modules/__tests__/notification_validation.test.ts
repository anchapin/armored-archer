/**
 * Unit tests for parseNotificationInput / NOTIFICATION_INPUT_LIMITS
 * (notification_validation.ts).
 *
 * The module is the single gate between untrusted RPC payloads and the
 * notification persistence layer, so every rejection path (payload shape,
 * per-field length/NUL checks, quiet-hours format, schedule format and
 * schedule calendar validity) is asserted here.
 */

import {
  NOTIFICATION_INPUT_LIMITS,
  NotificationInputError,
  parseNotificationInput,
} from '../notification_validation';

function expectRejection(payload: string, kind: Parameters<typeof parseNotificationInput>[1]): void {
  expect(() => parseNotificationInput(payload, kind)).toThrow(NotificationInputError);
}

describe('parseNotificationInput', () => {
  describe('register', () => {
    it('accepts a minimal register payload', () => {
      const result = parseNotificationInput(
        JSON.stringify({ deviceToken: 'device-1', platform: 'android' }),
        'register'
      );
      expect(result).toEqual({ deviceToken: 'device-1', platform: 'android' });
    });

    it('accepts the optional appVersion and fcmToken fields', () => {
      const result = parseNotificationInput(
        JSON.stringify({
          deviceToken: 'device-1',
          platform: 'ios',
          appVersion: '1.2.3',
          fcmToken: 'fcm-1',
        }),
        'register'
      );
      expect(result.appVersion).toBe('1.2.3');
      expect(result.fcmToken).toBe('fcm-1');
    });

    it('rejects a payload without deviceToken', () => {
      expectRejection(JSON.stringify({ platform: 'android' }), 'register');
    });

    it('rejects a payload without platform', () => {
      expectRejection(JSON.stringify({ deviceToken: 'device-1' }), 'register');
    });

    it('rejects a non-string deviceToken', () => {
      expectRejection(JSON.stringify({ deviceToken: 42, platform: 'ios' }), 'register');
    });

    it('rejects a non-string appVersion', () => {
      expectRejection(
        JSON.stringify({ deviceToken: 'device-1', platform: 'ios', appVersion: 7 }),
        'register'
      );
    });

    it('rejects an empty deviceToken', () => {
      expectRejection(JSON.stringify({ deviceToken: '', platform: 'ios' }), 'register');
    });

    it('rejects a deviceToken longer than the text limit', () => {
      const token = 'a'.repeat(NOTIFICATION_INPUT_LIMITS.text + 1);
      expectRejection(JSON.stringify({ deviceToken: token, platform: 'ios' }), 'register');
    });

    it('accepts a deviceToken exactly at the text limit', () => {
      const token = 'a'.repeat(NOTIFICATION_INPUT_LIMITS.text);
      const result = parseNotificationInput(
        JSON.stringify({ deviceToken: token, platform: 'ios' }),
        'register'
      );
      expect(result.deviceToken).toHaveLength(NOTIFICATION_INPUT_LIMITS.text);
    });

    it('rejects a deviceToken containing a NUL byte', () => {
      expectRejection(
        JSON.stringify({ deviceToken: 'device\u00001', platform: 'ios' }),
        'register'
      );
    });

    it('rejects an appVersion longer than the appVersion limit', () => {
      expectRejection(
        JSON.stringify({
          deviceToken: 'device-1',
          platform: 'ios',
          appVersion: 'a'.repeat(NOTIFICATION_INPUT_LIMITS.appVersion + 1),
        }),
        'register'
      );
    });
  });

  describe('remove', () => {
    it('accepts a remove payload', () => {
      expect(parseNotificationInput(JSON.stringify({ deviceToken: 'device-1' }), 'remove')).toEqual({
        deviceToken: 'device-1',
      });
    });

    it('rejects a remove payload without deviceToken', () => {
      expectRejection(JSON.stringify({}), 'remove');
    });
  });

  describe('cancel', () => {
    it('accepts a cancel payload', () => {
      expect(
        parseNotificationInput(JSON.stringify({ notificationId: 'notif-1' }), 'cancel')
      ).toEqual({ notificationId: 'notif-1' });
    });

    it('rejects a cancel payload without notificationId', () => {
      expectRejection(JSON.stringify({}), 'cancel');
    });

    it('rejects an empty notificationId', () => {
      expectRejection(JSON.stringify({ notificationId: '' }), 'cancel');
    });
  });

  describe('preferences', () => {
    it('accepts an empty preferences payload', () => {
      expect(parseNotificationInput(JSON.stringify({}), 'preferences')).toEqual({});
    });

    it('accepts the documented boolean preference flags', () => {
      const result = parseNotificationInput(
        JSON.stringify({
          dailyRewardsEnabled: true,
          eventsEnabled: false,
          pvpChallengesEnabled: true,
          promotionsEnabled: false,
          notificationsEnabled: true,
          quietHoursEnabled: true,
        }),
        'preferences'
      );
      expect(result.dailyRewardsEnabled).toBe(true);
      expect(result.quietHoursEnabled).toBe(true);
    });

    it('accepts quiet hours and timezone', () => {
      const result = parseNotificationInput(
        JSON.stringify({
          quietHoursStart: '22:00',
          quietHoursEnd: '07:30',
          timezone: 'Europe/Berlin',
        }),
        'preferences'
      );
      expect(result.quietHoursStart).toBe('22:00');
      expect(result.timezone).toBe('Europe/Berlin');
    });

    it('accepts quiet hours with seconds', () => {
      expect(
        parseNotificationInput(JSON.stringify({ quietHoursStart: '22:00:30' }), 'preferences')
      ).toEqual({ quietHoursStart: '22:00:30' });
    });

    it('rejects an unknown preference field', () => {
      expect(() =>
        parseNotificationInput(JSON.stringify({ unknownFlag: true }), 'preferences')
      ).toThrow('Invalid preference field');
    });

    it('rejects a non-boolean preference flag', () => {
      expectRejection(JSON.stringify({ eventsEnabled: 'yes' }), 'preferences');
    });

    it('rejects a malformed quiet hours value', () => {
      expectRejection(JSON.stringify({ quietHoursStart: '24:00' }), 'preferences');
      expectRejection(JSON.stringify({ quietHoursEnd: '7:30' }), 'preferences');
      expectRejection(JSON.stringify({ quietHoursStart: '22:60' }), 'preferences');
    });

    it('rejects a timezone longer than the timezone limit', () => {
      expectRejection(
        JSON.stringify({ timezone: 'a'.repeat(NOTIFICATION_INPUT_LIMITS.timezone + 1) }),
        'preferences'
      );
    });
  });

  describe('schedule', () => {
    it('accepts a fully populated schedule payload', () => {
      const result = parseNotificationInput(
        JSON.stringify({
          type: 'custom',
          title: 'Ping',
          body: 'Body',
          scheduledFor: '2030-01-02T03:04:05Z',
          data: { key: 'value' },
        }),
        'schedule'
      );
      expect(result.type).toBe('custom');
      expect(result.data).toEqual({ key: 'value' });
    });

    it('accepts a schedule with milliseconds and a numeric offset', () => {
      expect(
        parseNotificationInput(
          JSON.stringify({ type: 'custom', scheduledFor: '2030-01-02T03:04:05.123+02:00' }),
          'schedule'
        )
      ).toEqual({ type: 'custom', scheduledFor: '2030-01-02T03:04:05.123+02:00' });
    });

    it('rejects a schedule without scheduledFor', () => {
      expectRejection(JSON.stringify({ type: 'custom' }), 'schedule');
    });

    it('rejects a schedule without type', () => {
      expectRejection(JSON.stringify({ scheduledFor: '2030-01-02T03:04:05Z' }), 'schedule');
    });

    it('rejects a non-string data value', () => {
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-02T03:04:05Z', data: { a: 1 } }),
        'schedule'
      );
    });

    it('rejects a malformed scheduledFor', () => {
      expectRejection(JSON.stringify({ type: 'custom', scheduledFor: 'tomorrow' }), 'schedule');
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-02 03:04:05' }),
        'schedule'
      );
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-02T03:04:05' }),
        'schedule'
      );
    });

    it('rejects an impossible calendar date', () => {
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-02-30T00:00:00Z' }),
        'schedule'
      );
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-13-01T00:00:00Z' }),
        'schedule'
      );
    });

    it('accepts February 29th in a leap year', () => {
      expect(
        parseNotificationInput(
          JSON.stringify({ type: 'custom', scheduledFor: '2024-02-29T00:00:00Z' }),
          'schedule'
        )
      ).toEqual({ type: 'custom', scheduledFor: '2024-02-29T00:00:00Z' });
    });

    it('accepts February 29th in a year divisible by 400', () => {
      expect(
        parseNotificationInput(
          JSON.stringify({ type: 'custom', scheduledFor: '2000-02-29T00:00:00Z' }),
          'schedule'
        )
      ).toEqual({ type: 'custom', scheduledFor: '2000-02-29T00:00:00Z' });
    });

    it('rejects February 29th in a non-leap year', () => {
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2023-02-29T00:00:00Z' }),
        'schedule'
      );
    });

    it('rejects an out-of-range time component', () => {
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-01T24:00:00Z' }),
        'schedule'
      );
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-01T00:60:00Z' }),
        'schedule'
      );
      expectRejection(
        JSON.stringify({ type: 'custom', scheduledFor: '2030-01-01T00:00:60Z' }),
        'schedule'
      );
    });

    it('rejects data keys or values containing a NUL byte', () => {
      expectRejection(
        JSON.stringify({
          type: 'custom',
          scheduledFor: '2030-01-02T03:04:05Z',
          data: { 'k\u0000ey': 'v' },
        }),
        'schedule'
      );
      expectRejection(
        JSON.stringify({
          type: 'custom',
          scheduledFor: '2030-01-02T03:04:05Z',
          data: { key: 'v\u0000al' },
        }),
        'schedule'
      );
    });

    it('rejects an empty data key', () => {
      expectRejection(
        JSON.stringify({
          type: 'custom',
          scheduledFor: '2030-01-02T03:04:05Z',
          data: { '': 'v' },
        }),
        'schedule'
      );
    });
  });

  describe('empty', () => {
    it('accepts an empty payload', () => {
      expect(parseNotificationInput(JSON.stringify({}), 'empty')).toEqual({});
    });

    it('strips unknown fields from an otherwise empty payload', () => {
      // valibot's object() ignores unknown entries, so extra keys are dropped
      // rather than rejected (only the `preferences` kind rejects unknowns
      // explicitly). Asserted here so the behaviour is pinned.
      expect(parseNotificationInput(JSON.stringify({ a: 1 }), 'empty')).toEqual({});
    });
  });

  describe('transport level guards', () => {
    it('rejects a payload that is not a string', () => {
      expect(() => parseNotificationInput(undefined as unknown as string, 'register')).toThrow(
        NotificationInputError
      );
    });

    it('rejects invalid JSON', () => {
      expect(() => parseNotificationInput('{not json', 'register')).toThrow(
        'Invalid JSON payload'
      );
    });

    it('rejects a payload larger than the payload limit', () => {
      const oversized = JSON.stringify({
        deviceToken: 'device-1',
        platform: 'ios',
        appVersion: 'a'.repeat(NOTIFICATION_INPUT_LIMITS.payload),
      });
      expect(oversized.length).toBeGreaterThan(NOTIFICATION_INPUT_LIMITS.payload);
      expectRejection(oversized, 'register');
    });

    it('rejects a JSON scalar payload', () => {
      expectRejection('"just-a-string"', 'register');
      expectRejection('null', 'register');
      expectRejection('42', 'register');
    });
  });

  describe('NOTIFICATION_INPUT_LIMITS', () => {
    it('exposes the documented conservative limits', () => {
      expect(NOTIFICATION_INPUT_LIMITS).toEqual({
        payload: 65536,
        token: 4096,
        text: 4096,
        appVersion: 128,
        timezone: 128,
      });
    });
  });
});
