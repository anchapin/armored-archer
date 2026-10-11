import { testHelper, TestAccount } from './helpers';

/** Real Nakama3.21 JS-runtime contract and PostgreSQL owner-boundary checks. No FCM calls. */
describe('Notification synchronous control plane', () => {
  let owner: TestAccount;
  let other: TestAccount;
  let notificationId: string;
  let deviceToken: string;
  beforeAll(async () => {
    await testHelper.initialize();
    owner = await testHelper.createTestAccount('notification_owner');
    other = await testHelper.createTestAccount('notification_other');
    deviceToken = 'notification_test_' + owner.userId;
  }, 120000);
  afterAll(async () => {
    if (owner) {
      await testHelper.sql('DELETE FROM scheduled_notifications WHERE user_id = $1', [
        owner.userId,
      ]);
      await testHelper.sql('DELETE FROM device_tokens WHERE user_id = $1', [owner.userId]);
      await testHelper.sql('DELETE FROM notification_preferences WHERE user_id = $1', [
        owner.userId,
      ]);
    }
    if (other)
      await testHelper.sql('DELETE FROM notification_preferences WHERE user_id = $1', [
        other.userId,
      ]);
    await testHelper.cleanup();
  });
  async function rpc(account: TestAccount, name: string, payload: object): Promise<any> {
    const response = await account.client.rpc(account.session, 'armored_archer_' + name, payload);
    // SDK decodes JSON payloads. Do not JSON.parse an already-decoded object.
    return typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
  }
  test('all seven RPCs work synchronously and enforce owner mutations', async () => {
    expect(
      (await rpc(owner, 'register_device_token', { deviceToken, platform: 'ios' })).success
    ).toBe(true);
    expect(await rpc(owner, 'get_notification_status', {})).toEqual({
      firebaseEnabled: false,
      registeredDevices: 1,
    });
    const prefs = await rpc(owner, 'get_notification_preferences', {});
    expect(prefs.success).toBe(true);
    expect(prefs.preferences.timezone).toBe('UTC');
    expect(
      (
        await rpc(owner, 'update_notification_preferences', {
          notificationsEnabled: false,
          timezone: 'America/New_York',
        })
      ).success
    ).toBe(true);
    const saved = await rpc(owner, 'get_notification_preferences', {});
    expect(saved.preferences.notificationsEnabled).toBe(false);
    expect(saved.preferences.timezone).toBe('America/New_York');
    const scheduled = await rpc(owner, 'schedule_notification', {
      type: 'daily_reward',
      scheduledFor: '2030-01-01T10:00:00Z',
    });
    expect(scheduled.success).toBe(true);
    notificationId = scheduled.notificationId;
    expect(notificationId).toBeTruthy();
    expect((await rpc(other, 'cancel_notification', { notificationId })).success).toBe(false);
    expect(
      (
        await testHelper.sql(
          'SELECT status FROM scheduled_notifications WHERE notification_id = $1',
          [notificationId]
        )
      )[0].status
    ).toBe('pending');
    expect((await rpc(other, 'remove_device_token', { deviceToken })).success).toBe(false);
    expect((await rpc(owner, 'get_notification_status', {})).registeredDevices).toBe(1);
    expect((await rpc(owner, 'cancel_notification', { notificationId })).success).toBe(true);
    expect((await rpc(owner, 'remove_device_token', { deviceToken })).success).toBe(true);
    expect((await rpc(owner, 'get_notification_status', {})).registeredDevices).toBe(0);
  });
  test('fresh update creates preferences without a prior read; malformed payload fails safely', async () => {
    expect(
      (await rpc(other, 'update_notification_preferences', { quietHoursEnabled: true })).success
    ).toBe(true);
    expect(
      (await rpc(other, 'get_notification_preferences', {})).preferences.quietHoursEnabled
    ).toBe(true);
    const invalid = await rpc(owner, 'schedule_notification', {
      type: 'custom',
      scheduledFor: 'not-a-date',
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error_code).toBe('INVALID_ARGUMENT');
  });
});
