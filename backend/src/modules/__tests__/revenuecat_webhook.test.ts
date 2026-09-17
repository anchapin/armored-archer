/**
 * RevenueCat Webhook Handler Unit Tests
 * Tests for IAP purchase validation with RevenueCat webhooks (Issues #460, #1067)
 *
 * Issue #1067 coverage:
 * - Fail-closed HMAC: forged/unsigned/unconfigured-secret webhooks grant nothing
 * - Event idempotency: replayed events credit exactly once
 * - Refund dedup: durable storage markers keep refunds at-most-once with
 *   Redis unavailable
 * - Max-balance queueing: paid awards cap and queue instead of failing
 */
import { createHmac } from 'crypto';
import { rpcRevenueCatWebhook, processRefund, RefundReason, clearWebhookEventLedgersForTests } from '../store';
import { getMetricsRegistry } from '../metrics';
import { createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';
import { getRedisClient } from '../../utils/redis';

const WEBHOOK_SECRET = 'test_webhook_secret';

// Mock cache manager to prevent real cache calls in tests
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../utils/cache', () => ({
  getCacheManager: jest.fn(() => mockCache),
  resetCacheManager: jest.fn(),
}));

// Mock Redis so tests can simulate outages (issue #1067). Defaults to
// "no Redis configured"; individual tests swap in a failing client.
const mockGetRedisClient = getRedisClient as jest.Mock;
jest.mock('../../utils/redis', () => ({
  getRedisClient: jest.fn(),
}));

// Mock context representing an authenticated CLIENT session — the webhook
// RPC is client-invocable, so this is the attacker's vantage point.
const mockCtx = {
  userId: 'attacker-client-session',
  username: 'attacker',
  ipAddress: '127.0.0.1',
  env: {},
  variables: {} as Record<string, string>,
};

const createTestNakama = (overrides?: Partial<Runtime.Nakama>): Runtime.Nakama => {
  const base = createMockNakama();
  return {
    ...base,
    ...overrides,
  };
};

/**
 * Stateful in-memory storage so durable ledger records (event ledger,
 * refund markers, pending award queue) survive across webhook calls —
 * required to prove idempotency.
 */
const createStatefulStorage = () => {
  const records = new Map<string, { value: string; version: string }>();
  const storageRead = jest.fn(
    (objects: { collection: string; key: string; userId?: string }[]) =>
      objects
        .map((obj) => {
          const record = records.get(`${obj.collection}:${obj.key}`);
          if (!record) return null;
          return {
            collection: obj.collection,
            key: obj.key,
            userId: obj.userId ?? '',
            value: record.value,
            version: record.version,
            permissionRead: 0,
            permissionWrite: 0,
            createTime: 0,
            updateTime: 0,
          };
        })
        .filter(Boolean)
  );
  const storageWrite = jest.fn(
    (objects: { collection: string; key: string; userId?: string; value: string }[]) => {
      objects.forEach((obj) => {
        records.set(`${obj.collection}:${obj.key}`, { value: obj.value, version: '1' });
      });
      return [];
    }
  );
  const seedCurrency = (userId: string, gems: number, coins = 0): void => {
    records.set(`player_currency:${userId}`, {
      value: JSON.stringify({ user_id: userId, gems, coins }),
      version: '1',
    });
  };
  const setCurrency = (userId: string, gems: number, coins = 0): void => {
    seedCurrency(userId, gems, coins);
  };
  const readCurrency = (userId: string): { gems: number; coins: number } | undefined => {
    const record = records.get(`player_currency:${userId}`);
    return record ? ((typeof record.value === 'string' ? (typeof record.value === 'string' ? (typeof record.value === 'string' ? JSON.parse(record.value) : record.value) : record.value) : record.value) as { gems: number; coins: number }) : undefined;
  };
  return { records, storageRead, storageWrite, seedCurrency, setCurrency, readCurrency };
};

/** Compute a valid RevenueCat HMAC-SHA256 signature for a payload. */
const sign = (payload: string, secret: string = WEBHOOK_SECRET): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

/** Build a flat webhook payload (test shape) with sensible defaults. */
const buildPayload = (overrides: Record<string, unknown>): string =>
  JSON.stringify({
    price: 0.99,
    currency: 'USD',
    environment: 'SANDBOX',
    ...overrides,
  });

describe('rpcRevenueCatWebhook', () => {
  const configModule = require('../../config');

  beforeAll(() => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockReturnValue(undefined);
    mockGetRedisClient.mockReturnValue(null);
    configModule.config.revenuecat.webhookSecret = WEBHOOK_SECRET;
    clearWebhookEventLedgersForTests();
  });

  afterEach(() => {
    configModule.config.revenuecat.webhookSecret = '';
  });

  describe('Fail-closed HMAC verification (issue #1067)', () => {
    it('rejects a forged initial_purchase from a client session and grants zero gems', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('forged-user', 50);

      const payload = buildPayload({
        event_id: 'evt-forged',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'forged-user',
        product_id: 'com.armoredarcher.gems.medium', // 550 gems
        transaction_id: 'tx-forged',
      });

      // Signed with the WRONG secret — a forged signature
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload, 'wrong-secret') } };

      const result = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Invalid signature');
      // Zero gems granted: balance untouched and no currency write happened
      expect(readCurrency('forged-user')?.gems).toBe(50);
      const currencyWrites = storageWrite.mock.calls.filter((call: any[]) =>
        call[0].some((w: any) => w.collection === 'player_currency')
      );
      expect(currencyWrites).toHaveLength(0);
    });

    it('rejects an unsigned webhook and grants zero gems when the secret is configured', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('unsigned-user', 50);

      const payload = buildPayload({
        event_id: 'evt-unsigned',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'unsigned-user',
        product_id: 'com.armoredarcher.gems.medium',
        transaction_id: 'tx-unsigned',
      });

      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': '' } };

      const result = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Invalid signature');
      expect(readCurrency('unsigned-user')?.gems).toBe(50);
    });

    it('fails closed when REVENUECAT_WEBHOOK_SECRET is unset: returns an error and grants nothing', async () => {
      configModule.config.revenuecat.webhookSecret = '';
      delete process.env.REVENUECAT_WEBHOOK_SECRET;

      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('no-secret-user', 50);

      const payload = buildPayload({
        event_id: 'evt-no-secret',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'no-secret-user',
        product_id: 'com.armoredarcher.gems.medium',
        transaction_id: 'tx-no-secret',
      });

      // Even a correctly signed payload must be rejected: with no secret
      // configured the server cannot verify anything, so it grants nothing.
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } };

      const result = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Webhook not configured');
      expect(readCurrency('no-secret-user')?.gems).toBe(50);
      const currencyWrites = storageWrite.mock.calls.filter((call: any[]) =>
        call[0].some((w: any) => w.collection === 'player_currency')
      );
      expect(currencyWrites).toHaveLength(0);
    });
  });

  describe('Webhook Validation', () => {
    it('should reject empty payload', async () => {
      const nk = createTestNakama();

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign('') } } as any,
        createMockLogger(),
        nk,
        ''
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Invalid payload');
    });

    it('should reject invalid JSON payload', async () => {
      const nk = createTestNakama();

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign('not-valid-json') } } as any,
        createMockLogger(),
        nk,
        'not-valid-json'
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Invalid payload');
    });

    it('should reject payload missing required fields', async () => {
      const nk = createTestNakama();
      const payload = JSON.stringify({ some_field: 'value' });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Missing app_user_id');
    });

    it('should reject gem-awarding events without an event/transaction identifier', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('no-event-id-user', 0);

      const payload = buildPayload({
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'no-event-id-user',
        product_id: 'com.armoredarcher.gems.small',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Missing event identifier');
      expect(readCurrency('no-event-id-user')?.gems).toBe(0);
    });
  });

  describe('INITIAL_PURCHASE Event', () => {
    it('should process initial purchase and award gems via the atomic ledger', async () => {
      const { storageRead, storageWrite, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-123',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'rc-user-123',
        product_id: 'com.armoredarcher.gems.medium', // 550 gems
        transaction_id: 'tx-123',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.gems_awarded).toBe(550);
      expect(parsed.new_balance).toBe(550);
      expect(readCurrency('rc-user-123')?.gems).toBe(550);
    });

    it('should add gems to existing balance', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('existing-user', 100);

      const payload = buildPayload({
        event_id: 'evt-456',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'existing-user',
        product_id: 'com.armoredarcher.gems.small', // 100 gems
        transaction_id: 'tx-456',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.new_balance).toBe(200); // 100 + 100
      expect(readCurrency('existing-user')?.gems).toBe(200);
    });

    it('should award gems through a versioned applyCurrencyDelta write, never a plain storageWrite', async () => {
      const { storageRead, storageWrite, seedCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      // Seed the ledger so the award must be a conditional OVERWRITE:
      // creates are inherently unversioned; overwrites must carry the
      // observed version (OCC) or be rejected.
      seedCurrency('versioned-user', 10);

      const payload = buildPayload({
        event_id: 'evt-versioned',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'versioned-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-versioned',
      });

      await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      // Every player_currency write from the webhook path must carry a
      // version (OCC-guarded applyCurrencyDelta writes do).
      const currencyWrites = storageWrite.mock.calls.filter((call: any[]) =>
        call[0].some((w: any) => w.collection === 'player_currency')
      );
      expect(currencyWrites.length).toBeGreaterThan(0);
      currencyWrites.forEach((call: any[]) => {
        call[0]
          .filter((w: any) => w.collection === 'player_currency')
          .forEach((w: any) => {
            expect(w.version).toBeDefined();
          });
      });
    });
  });

  describe('Event idempotency (issue #1067)', () => {
    it('credits gems exactly once for a replayed webhook event', async () => {
      const { storageRead, storageWrite, readCurrency, records } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-replay-once',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'replay-user',
        product_id: 'com.armoredarcher.gems.small', // 100 gems
        transaction_id: 'tx-replay',
      });
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } };

      const first = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);
      const firstParsed = JSON.parse(first);
      expect(firstParsed.success).toBe(true);
      expect(firstParsed.gems_awarded).toBe(100);
      expect(firstParsed.new_balance).toBe(100);

      // RevenueCat retry: identical payload replays the same event id
      const second = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);

      // The replay returns the recorded outcome verbatim...
      expect(JSON.parse(second)).toEqual(firstParsed);
      // ...and the ledger was credited exactly once.
      expect(readCurrency('replay-user')?.gems).toBe(100);
      // The durable event ledger record exists
      expect(records.get('revenuecat_webhook_events:event_evt-replay-once')).toBeDefined();
    });

    it('treats the transaction id as the dedup key when no event id is present', async () => {
      const { storageRead, storageWrite, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'tx-dedup-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-dedup-key',
      });
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } };

      await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);
      await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);

      expect(readCurrency('tx-dedup-user')?.gems).toBe(100);
    });
  });

  describe('Max-balance queueing (issue #1067)', () => {
    it('queues the paid remainder instead of failing when MAX_GEM_BALANCE would be exceeded', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency, records } =
        createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      // 9,999,950 + 100 would exceed the 10M cap
      seedCurrency('whale-user', 9_999_950);

      const payload = buildPayload({
        event_id: 'evt-whale-cap',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'whale-user',
        product_id: 'com.armoredarcher.gems.small', // 100 gems
        transaction_id: 'tx-whale-cap',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.gems_awarded).toBe(50);
      expect(parsed.gems_queued).toBe(50);
      expect(parsed.new_balance).toBe(10_000_000);
      expect(readCurrency('whale-user')?.gems).toBe(10_000_000);

      // The un-appliable remainder is durably queued
      const pendingRecord = records.get('revenuecat_pending_awards:whale-user');
      expect(pendingRecord).toBeDefined();
      const pending = JSON.parse((pendingRecord as { value: string }).value);
      expect(pending.awards).toHaveLength(1);
      expect(pending.awards[0].gems_remaining).toBe(50);
      expect(pending.awards[0].event_id).toBe('evt-whale-cap');
    });

    it('drains queued awards on a later webhook once balance allows', async () => {
      const { storageRead, storageWrite, seedCurrency, setCurrency, readCurrency, records } =
        createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('whale-drain-user', 9_999_950);

      const firstPayload = buildPayload({
        event_id: 'evt-whale-drain-1',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'whale-drain-user',
        product_id: 'com.armoredarcher.gems.small', // 100 gems
        transaction_id: 'tx-whale-drain-1',
      });
      await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(firstPayload) } } as any,
        createMockLogger(),
        nk,
        firstPayload
      );
      // 50 applied, 50 queued; balance is now at the cap.

      // Balance drops below the cap (player spends gems)
      setCurrency('whale-drain-user', 9_999_000);

      // The next webhook-driven event first drains the queued 50 gems,
      // then applies its own award within the remaining headroom.
      const secondPayload = buildPayload({
        event_id: 'evt-whale-drain-2',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'whale-drain-user',
        product_id: 'com.armoredarcher.gems.small', // 100 gems
        transaction_id: 'tx-whale-drain-2',
      });
      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(secondPayload) } } as any,
        createMockLogger(),
        nk,
        secondPayload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // 9,999,000 + 50 (drained) + 100 (new award) = 9,999,150
      expect(parsed.new_balance).toBe(9_999_150);
      expect(readCurrency('whale-drain-user')?.gems).toBe(9_999_150);
      // The queue is empty now
      const pendingRecord = records.get('revenuecat_pending_awards:whale-drain-user');
      const pending = JSON.parse((pendingRecord as { value: string } | undefined)?.value ?? '{"awards":[]}');
      expect(pending.awards).toHaveLength(0);
    });
  });

  describe('RENEWAL Event', () => {
    it('should process subscription renewal', async () => {
      const { storageRead, storageWrite, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-renewal',
        event_type: 'RENEWAL',
        app_user_id: 'renewal-user',
        product_id: 'com.armoredarcher.gems.large', // 1200 gems
        transaction_id: 'renewal-tx-123',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Gems awarded'); // Renewal also awards gems
      expect(readCurrency('renewal-user')?.gems).toBe(1200);
    });
  });

  describe('CANCELLATION Event', () => {
    it('should process subscription cancellation', async () => {
      const { storageRead, storageWrite, records } = createStatefulStorage();
      records.set('player_subscription:cancel-user', {
        value: JSON.stringify({
          product_id: 'com.armoredarcher.premium.monthly',
          active: true,
          start_date: '2024-01-01T00:00:00Z',
        }),
        version: '1',
      });
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-cancel',
        event_type: 'CANCELLATION',
        app_user_id: 'cancel-user',
        product_id: 'com.armoredarcher.premium.monthly',
        transaction_id: 'cancel-tx-123',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      // Verify subscription was updated
      const subscription = JSON.parse(
        (records.get('player_subscription:cancel-user') as { value: string }).value
      );
      expect(subscription.active).toBe(false);
      expect(subscription.cancelled).toBe(true);
    });
  });

  describe('BILLING_ISSUE Event', () => {
    it('should handle billing issues', async () => {
      const { storageRead, storageWrite, records } = createStatefulStorage();
      records.set('player_subscription:billing-user', {
        value: JSON.stringify({
          product_id: 'com.armoredarcher.premium.monthly',
          active: true,
        }),
        version: '1',
      });
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-billing',
        event_type: 'BILLING_ISSUE',
        app_user_id: 'billing-user',
        product_id: 'com.armoredarcher.premium.monthly',
        grace_period_expiration_date: '2024-02-01T00:00:00Z',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Billing issue recorded');
      const subscription = JSON.parse(
        (records.get('player_subscription:billing-user') as { value: string }).value
      );
      expect(subscription.billing_issue).toBe(true);
    });
  });

  describe('EXPIRATION Event', () => {
    it('should handle subscription expiration', async () => {
      const { storageRead, storageWrite } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-expiration',
        event_type: 'EXPIRATION',
        app_user_id: 'expiration-user',
        product_id: 'com.armoredarcher.premium.monthly',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Expiration noted');
    });
  });

  describe('PRODUCT_CHANGE Event', () => {
    it('should handle product/plan changes', async () => {
      const { storageRead, storageWrite } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });

      const payload = buildPayload({
        event_id: 'evt-prodchange',
        event_type: 'PRODUCT_CHANGE',
        app_user_id: 'prodchange-user',
        product_id: 'com.armoredarcher.premium.yearly',
        transferred_from: 'com.armoredarcher.premium.monthly',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Product change noted');
    });
  });

  describe('REFUND Event', () => {
    it('should process refunds and deduct gems', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('refund-user', 550);

      const payload = buildPayload({
        event_id: 'evt-refund1',
        event_type: 'REFUND',
        app_user_id: 'refund-user',
        product_id: 'com.armoredarcher.gems.medium', // 550 gems
        transaction_id: 'refund-tx-123',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.new_balance).toBe(0);
      expect(parsed.message).toBe('Refund processed successfully');
      expect(readCurrency('refund-user')?.gems).toBe(0);
    });

    it('should handle partial refund when insufficient balance', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('partial-refund-user', 100);

      const payload = buildPayload({
        event_id: 'evt-refund2',
        event_type: 'REFUND',
        app_user_id: 'partial-refund-user',
        product_id: 'com.armoredarcher.gems.large', // 1200 gems
        transaction_id: 'refund-tx-456',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.new_balance).toBe(0);
      expect(parsed.message).toBe('Partial refund applied');
      expect(readCurrency('partial-refund-user')?.gems).toBe(0);
    });
  });

  describe('Refund dedup with Redis unavailable (issue #1067)', () => {
    const failingRedis = {
      exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      setex: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };

    beforeEach(() => {
      mockGetRedisClient.mockReturnValue(failingRedis);
    });

    it('deducts exactly once for a replayed refund webhook event', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('redis-down-user', 550);

      const payload = buildPayload({
        event_id: 'evt-refund-redis',
        event_type: 'REFUND',
        app_user_id: 'redis-down-user',
        product_id: 'com.armoredarcher.gems.medium', // 550 gems
        transaction_id: 'refund-tx-redis',
      });
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } };

      const first = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);
      const firstParsed = JSON.parse(first);
      expect(firstParsed.success).toBe(true);
      expect(firstParsed.new_balance).toBe(0);

      // Replay (RevenueCat retry) during the Redis outage: the recorded
      // outcome is returned and nothing is deducted again.
      const second = await rpcRevenueCatWebhook(ctx as any, createMockLogger(), nk, payload);
      expect(JSON.parse(second)).toEqual(firstParsed);
      expect(readCurrency('redis-down-user')?.gems).toBe(0);
    });

    it('processes a direct processRefund call at most once via durable markers', async () => {
      const { storageRead, storageWrite, seedCurrency, readCurrency, records } =
        createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('direct-refund-user', 550);
      const logger = createMockLogger();

      const first = await processRefund(
        nk,
        'direct-refund-user',
        550,
        'refund-tx-direct',
        RefundReason.CHARGEBACK,
        logger
      );
      expect(first.success).toBe(true);
      expect(first.new_balance).toBe(0);

      // Same transaction id again, Redis still down: the durable storage
      // marker (not Redis) blocks the double deduction.
      const second = await processRefund(
        nk,
        'direct-refund-user',
        550,
        'refund-tx-direct',
        RefundReason.CHARGEBACK,
        logger
      );
      expect(second.success).toBe(false);
      expect(second.message).toBe('Refund already processed');
      expect(readCurrency('direct-refund-user')?.gems).toBe(0);

      // The durable marker backs the dedup
      expect(records.get('refund_markers:refund_refund-tx-direct')).toBeDefined();
    });
  });

  describe('Unknown Event Types', () => {
    it('should handle unknown event types gracefully', async () => {
      const nk = createTestNakama();

      const payload = buildPayload({
        event_id: 'evt-unknown',
        event_type: 'UNKNOWN_EVENT',
        app_user_id: 'unknown-user',
        product_id: 'some-product',
        transaction_id: 'tx-unknown',
      });

      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Event UNKNOWN_EVENT noted but not processed');
    });
  });

  // =================== Webhook ledger observability (issue #1140) ===================
  //
  // Unlike metrics.test.ts (prom-client mocked), this file exercises the
  // ledger code paths against the REAL shared registry that store.ts now
  // imports, so counter/gauge/histogram emissions are asserted directly.
  // Registry state persists across tests, so every assertion is a
  // before/after delta — the same approach as admin_auth.test.ts (issue #1141).
  describe('Webhook ledger observability (issue #1140)', () => {
    type Sample = { labels: Record<string, string>; value: number };

    /** Samples a metric from the shared prom-client registry (v15: async). */
    async function metricSamples(name: string): Promise<Sample[]> {
      const metrics = (await getMetricsRegistry().getMetricsAsJSON()) as Array<{
        name: string;
        values?: Sample[];
      }>;
      const metric = metrics.find((m) => m.name === name);
      return metric?.values ?? [];
    }

    /** Summed event counter for one event_type/outcome pair. */
    async function eventTotal(eventType: string, outcome: string): Promise<number> {
      const samples = await metricSamples('armored_archer_webhook_events_total');
      return samples
        .filter(
          (s) => s.labels.event_type === eventType && s.labels.outcome === outcome
        )
        .reduce((sum, s) => sum + s.value, 0);
    }

    /** Summed Redis-error counter for one operation. */
    async function redisErrors(operation: string): Promise<number> {
      const samples = await metricSamples('armored_archer_webhook_redis_errors_total');
      return samples
        .filter((s) => s.labels.operation === operation)
        .reduce((sum, s) => sum + s.value, 0);
    }

    /** Total observations of the processing-time histogram for one event_type (+Inf bucket). */
    async function processingObservations(eventType: string): Promise<number> {
      const samples = await metricSamples('armored_archer_webhook_processing_seconds');
      return samples
        .filter((s) => s.labels.event_type === eventType && s.labels.le === '+Inf')
        .reduce((sum, s) => sum + s.value, 0);
    }

    /** Current value of the pending-awards gauge for one user (NaN if never set). */
    async function pendingAwards(userId: string): Promise<number> {
      const samples = await metricSamples('armored_archer_webhook_pending_awards');
      const match = samples.find((s) => s.labels.user_id === userId);
      return match ? match.value : Number.NaN;
    }

    /** Current value of the configured liveness gauge. */
    async function configuredGauge(): Promise<number> {
      const samples = await metricSamples('armored_archer_webhook_configured');
      return samples.length > 0 ? samples[0].value : Number.NaN;
    }

    it('counts a forged-signature rejection as event_type=unknown outcome=rejected_invalid_signature', async () => {
      const { storageRead, storageWrite } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      const before = await eventTotal('unknown', 'rejected_invalid_signature');

      const payload = buildPayload({
        event_id: 'evt-metric-forged',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-forged-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-metric-forged',
      });
      await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload, 'wrong') } } as any,
        createMockLogger(),
        nk,
        payload
      );

      expect(await eventTotal('unknown', 'rejected_invalid_signature')).toBe(before + 1);
    });

    it('flips armored_archer_webhook_configured to 0 and counts rejected_not_configured when the secret is unset', async () => {
      const { storageRead, storageWrite } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      const before = await eventTotal('unknown', 'rejected_not_configured');

      configModule.config.revenuecat.webhookSecret = '';
      try {
        const payload = buildPayload({
          event_id: 'evt-metric-unconfigured',
          event_type: 'INITIAL_PURCHASE',
          app_user_id: 'metric-unconfigured-user',
          product_id: 'com.armoredarcher.gems.small',
        });
        const result = await rpcRevenueCatWebhook(
          { ...mockCtx, variables: {} } as any,
          createMockLogger(),
          nk,
          payload
        );

        expect(JSON.parse(result).error).toBe('Webhook not configured');
        expect(await eventTotal('unknown', 'rejected_not_configured')).toBe(before + 1);
        expect(await configuredGauge()).toBe(0);
      } finally {
        configModule.config.revenuecat.webhookSecret = WEBHOOK_SECRET;
      }
      // A later configured call restores the liveness gauge to 1.
      const payload2 = buildPayload({
        event_id: 'evt-metric-configured-again',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-unconfigured-user',
        product_id: 'com.armoredarcher.gems.small',
      });
      await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload2) } } as any,
        createMockLogger(),
        nk,
        payload2
      );
      expect(await configuredGauge()).toBe(1);
    });

    it('counts a fully-applied initial_purchase as processed and observes processing time', async () => {
      const { storageRead, storageWrite, seedCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('metric-purchase-user', 0);
      const beforeEvents = await eventTotal('initial_purchase', 'processed');
      const beforeObs = await processingObservations('initial_purchase');

      const payload = buildPayload({
        event_id: 'evt-metric-processed',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-purchase-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-metric-processed',
      });
      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      expect(JSON.parse(result).success).toBe(true);
      expect(await eventTotal('initial_purchase', 'processed')).toBe(beforeEvents + 1);
      expect(await processingObservations('initial_purchase')).toBeGreaterThan(beforeObs);
    });

    it('counts a ledger replay as outcome=duplicate', async () => {
      const { storageRead, storageWrite, seedCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('metric-dup-user', 0);

      const payload = buildPayload({
        event_id: 'evt-metric-duplicate',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-dup-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-metric-duplicate',
      });
      const ctx = { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any;
      await rpcRevenueCatWebhook(ctx, createMockLogger(), nk, payload);

      const before = await eventTotal('initial_purchase', 'duplicate');
      await rpcRevenueCatWebhook(ctx, createMockLogger(), nk, payload);
      expect(await eventTotal('initial_purchase', 'duplicate')).toBe(before + 1);
    });

    it('counts an unhandled event type as outcome=unhandled', async () => {
      const { storageRead, storageWrite } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      const before = await eventTotal('unknown_event', 'unhandled');

      const payload = buildPayload({
        event_id: 'evt-metric-unhandled',
        event_type: 'UNKNOWN_EVENT',
        app_user_id: 'metric-unhandled-user',
        product_id: 'some-product',
        transaction_id: 'tx-metric-unhandled',
      });
      await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      expect(await eventTotal('unknown_event', 'unhandled')).toBe(before + 1);
    });

    it('increments armored_archer_webhook_redis_errors_total when the Redis dedup fast path fails', async () => {
      const { storageRead, storageWrite, seedCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      seedCurrency('metric-redis-user', 0);
      const failingRedis = {
        exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        setex: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };
      mockGetRedisClient.mockReturnValue(failingRedis);

      const beforeLookup = await redisErrors('dedup_lookup');
      const beforeRecord = await redisErrors('outcome_record');

      const payload = buildPayload({
        event_id: 'evt-metric-redis',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-redis-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-metric-redis',
      });
      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      expect(JSON.parse(result).success).toBe(true);
      expect(await redisErrors('dedup_lookup')).toBeGreaterThan(beforeLookup);
      expect(await redisErrors('outcome_record')).toBeGreaterThan(beforeRecord);
    });

    it('sets armored_archer_webhook_pending_awards when a purchase queues at the cap', async () => {
      const { storageRead, storageWrite, seedCurrency } = createStatefulStorage();
      const nk = createTestNakama({ storageRead, storageWrite });
      // 9,999,950 + 100 exceeds the 10M cap: 50 applied, 50 queued.
      seedCurrency('metric-whale-user', 9_999_950);

      const payload = buildPayload({
        event_id: 'evt-metric-whale',
        event_type: 'INITIAL_PURCHASE',
        app_user_id: 'metric-whale-user',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx-metric-whale',
      });
      const result = await rpcRevenueCatWebhook(
        { ...mockCtx, variables: { 'x-revenuecat-signature': sign(payload) } } as any,
        createMockLogger(),
        nk,
        payload
      );

      expect(JSON.parse(result).gems_queued).toBe(50);
      expect(await pendingAwards('metric-whale-user')).toBe(1);
    });
  });
});
