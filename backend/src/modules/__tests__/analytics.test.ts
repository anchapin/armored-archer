import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  AnalyticsEventType,
  rpcTrackEvent,
  rpcGetAnalyticsSummary,
  rpcTrackRevenue,
  rpcGetCircuitBreakerStates,
  getRecentEvents,
  getAllEvents,
  getDailyMetrics,
  registerAnalyticsEndpoints,
} from '../analytics';

jest.mock('../../config', () => ({
  config: {
    analytics: {
      enabled: false,
      mixpanel: { enabled: false },
      amplitude: { enabled: false },
      segment: { enabled: false },
      customEndpoint: { url: '' },
    },
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

jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
  recordAnalyticsEvent: jest.fn(),
  recordRevenue: jest.fn(),
  recordPurchase: jest.fn(),
}));

jest.mock('../privacy_compliance', () => ({
  isPII: jest.fn().mockReturnValue(false),
}));

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((_name: string, fn: Function) => fn()),
  getAllCircuitInfo: jest.fn().mockReturnValue([]),
}));

jest.mock('../validation', () => ({
  validatePayload: jest.fn((schema: unknown, payload: string, name: string) => {
    try {
      const data = JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: `Invalid JSON for ${name}` };
    }
  }),
  ZodSchemas: {
    track_event: {},
    get_analytics_summary: {},
    track_revenue: {},
  },
  createValidationErrorResponse: jest.fn((name: string, error: string) =>
    JSON.stringify({ success: false, error: `${name}: ${error}` })
  ),
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockCtx = {
  userId: 'user_123',
  ipAddress: '127.0.0.1',
} as any;

const mockNk = {} as any;

describe('Analytics Module', () => {
  describe('AnalyticsEventType enum', () => {
    it('should have all expected session event types', () => {
      expect(AnalyticsEventType.SESSION_START).toBe('session_start');
      expect(AnalyticsEventType.SESSION_END).toBe('session_end');
    });

    it('should have all expected tutorial event types', () => {
      expect(AnalyticsEventType.TUTORIAL_STARTED).toBe('tutorial_started');
      expect(AnalyticsEventType.TUTORIAL_COMPLETED).toBe('tutorial_completed');
      expect(AnalyticsEventType.TUTORIAL_FAILED).toBe('tutorial_failed');
    });

    it('should have all expected PVE event types', () => {
      expect(AnalyticsEventType.PVE_STAGE_STARTED).toBe('pve_stage_started');
      expect(AnalyticsEventType.PVE_STAGE_COMPLETED).toBe('pve_stage_completed');
      expect(AnalyticsEventType.PVE_BOSS_DEFEATED).toBe('pve_boss_defeated');
    });

    it('should have all expected PVP event types', () => {
      expect(AnalyticsEventType.PVP_MATCH_STARTED).toBe('pvp_match_started');
      expect(AnalyticsEventType.PVP_MATCH_COMPLETED).toBe('pvp_match_completed');
    });

    it('should have all expected store event types', () => {
      expect(AnalyticsEventType.STORE_OPENED).toBe('store_opened');
      expect(AnalyticsEventType.PURCHASE_COMPLETED).toBe('purchase_completed');
      expect(AnalyticsEventType.GEM_PURCHASED).toBe('gem_purchased');
    });

    it('should have custom event type', () => {
      expect(AnalyticsEventType.CUSTOM).toBe('custom');
    });

    it('should have no duplicate values', () => {
      const values = Object.values(AnalyticsEventType);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('rpcTrackEvent', () => {
    it('should track a valid event successfully', () => {
      const payload = JSON.stringify({
        event_name: 'pve_stage_completed',
        properties: { stage_id: 'forest_1', stars: 3 },
        platform: 'android',
        session_id: 'sess_123',
      });

      const result = rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.event_id).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });

    it('should handle invalid JSON payload', () => {
      const result = rpcTrackEvent(mockCtx, mockLogger as any, mockNk, 'not json');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const payload = JSON.stringify({
        event_name: 'session_start',
      });

      const result = rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });
  });

  describe('rpcGetAnalyticsSummary', () => {
    it('should return analytics summary for date range', () => {
      const payload = JSON.stringify({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

      const result = rpcGetAnalyticsSummary(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.total_events).toBeDefined();
      expect(parsed.summary.unique_users).toBeDefined();
    });

    it('should filter by event names when specified', () => {
      const payload = JSON.stringify({
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        event_names: ['pve_stage_completed'],
      });

      const result = rpcGetAnalyticsSummary(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should handle invalid payload', () => {
      const result = rpcGetAnalyticsSummary(mockCtx, mockLogger as any, mockNk, 'bad json');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });
  });

  describe('rpcTrackRevenue', () => {
    it('should track revenue event successfully', () => {
      const payload = JSON.stringify({
        amount: 99,
        currency: 'USD',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx_123',
        platform: 'ios',
      });

      const result = rpcTrackRevenue(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.revenue_id).toBeDefined();
    });

    it('should handle invalid payload', () => {
      const result = rpcTrackRevenue(mockCtx, mockLogger as any, mockNk, 'not json');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });
  });

  describe('rpcGetCircuitBreakerStates', () => {
    it('should return circuit breaker states', () => {
      const result = rpcGetCircuitBreakerStates(mockCtx, mockLogger as any, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.circuits).toBeDefined();
      expect(Array.isArray(parsed.circuits)).toBe(true);
    });
  });

  describe('getRecentEvents', () => {
    it('should return recent events with default limit', () => {
      const events = getRecentEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    it('should return recent events with custom limit', () => {
      const events = getRecentEvents(10);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getAllEvents', () => {
    it('should return a copy of all events', () => {
      const events = getAllEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('getDailyMetrics', () => {
    it('should return daily metrics for date range', () => {
      const metrics = getDailyMetrics('2024-01-01', '2024-12-31');
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('registerAnalyticsEndpoints', () => {
    it('should register all analytics RPC endpoints', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerAnalyticsEndpoints(mockInitializer as any);

      const { registerRpcWithMetrics } = require('../metrics');
      expect(registerRpcWithMetrics).toHaveBeenCalledTimes(4);
    });
  });

  describe('event tracking flow', () => {
    it('should track event and make it available in getRecentEvents', () => {
      const payload = JSON.stringify({
        event_name: 'test_event',
        properties: { key: 'value' },
        platform: 'test',
        session_id: 'sess_test',
      });

      rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      const events = getRecentEvents(1000);
      const testEvent = events.find((e) => e.eventName === 'test_event');
      expect(testEvent).toBeDefined();
      expect(testEvent!.userId).toBe('user_123');
      expect(testEvent!.platform).toBe('test');
    });
  });
});

describe('Analytics Module - Analytics Enabled', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    (global as any).fetch = mockFetch;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  function loadAnalyticsWithConfig(analyticsConfig: Record<string, unknown>) {
    jest.doMock('../../config', () => ({
      config: {
        analytics: analyticsConfig,
      },
    }));

    jest.doMock('../../config/logger', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    }));

    jest.doMock('../metrics', () => ({
      registerRpcWithMetrics: jest.fn(),
      recordAnalyticsEvent: jest.fn(),
      recordRevenue: jest.fn(),
      recordPurchase: jest.fn(),
    }));

    jest.doMock('../privacy_compliance', () => ({
      isPII: jest.fn().mockReturnValue(false),
    }));

    jest.doMock('../../utils/circuitBreaker', () => ({
      withCircuitBreaker: jest.fn((_name: string, fn: Function) => fn()),
      getAllCircuitInfo: jest.fn().mockReturnValue([]),
    }));

    jest.doMock('../validation', () => ({
      validatePayload: jest.fn((_schema: unknown, payload: string, name: string) => {
        try {
          const data = JSON.parse(payload);
          return { success: true, data };
        } catch {
          return { success: false, error: `Invalid JSON for ${name}` };
        }
      }),
      ZodSchemas: {
        track_event: {},
        get_analytics_summary: {},
        track_revenue: {},
      },
      createValidationErrorResponse: jest.fn((name: string, error: string) =>
        JSON.stringify({ success: false, error: `${name}: ${error}` })
      ),
    }));

    return require('../analytics');
  }

  describe('processEvent with analytics enabled', () => {
    it('should forward to Mixpanel when mixpanel is enabled with apiKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: true, apiKey: 'mp_test_key_123' },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'pve_stage_completed',
        properties: { stage_id: 'forest_1', stars: 3 },
        platform: 'android',
        session_id: 'sess_456',
      });

      const result = analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      // Allow microtask for async forwardToExternalAnalytics
      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mixpanel.com/track',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.api_key).toBe('mp_test_key_123');
      expect(body.data).toBeDefined();
    });

    it('should forward to Amplitude when amplitude is enabled with apiKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: true, apiKey: 'amp_test_key_456' },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'session_start',
        properties: {},
        platform: 'ios',
        session_id: 'sess_789',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.amplitude.com/2/httpapi',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.api_key).toBe('amp_test_key_456');
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event_type).toBe('session_start');
      expect(body.events[0].user_id).toBe('user_123');
    });

    it('should forward to Segment when segment is enabled with writeKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: true, writeKey: 'seg_write_key_789' },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'purchase_completed',
        properties: { product_id: 'gem_pack_1' },
        platform: 'web',
        session_id: 'sess_abc',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.segment.io/v1/track',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('purchase_completed');
      expect(body.userId).toBe('user_123');
      expect(body.context.platform).toBe('web');
    });

    it('should forward to custom endpoint when url is configured', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: 'https://analytics.example.com/events', apiKey: 'custom_key' },
      });

      const payload = JSON.stringify({
        event_name: 'level_up',
        properties: { new_level: 5 },
        platform: 'android',
        session_id: 'sess_def',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://analytics.example.com/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer custom_key',
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('level_up');
      expect(body.userId).toBe('user_123');
    });

    it('should forward to custom endpoint without Authorization when no apiKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: 'https://analytics.example.com/events' },
      });

      const payload = JSON.stringify({
        event_name: 'daily_login',
        properties: {},
        platform: 'ios',
        session_id: 'sess_nokey',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalled();
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should forward to all providers when all are enabled', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: true, apiKey: 'mp_key' },
        amplitude: { enabled: true, apiKey: 'amp_key' },
        segment: { enabled: true, writeKey: 'seg_key' },
        customEndpoint: { url: 'https://custom.example.com/ingest' },
      });

      const payload = JSON.stringify({
        event_name: 'session_end',
        properties: { duration: 300 },
        platform: 'android',
        session_id: 'sess_all',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      // Should have been called 4 times (mixpanel, amplitude, segment, custom)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should not forward when analytics enabled but no providers configured', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'gear_equipped',
        properties: { item: 'sword' },
        platform: 'android',
        session_id: 'sess_none',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not forward to mixpanel when enabled but missing apiKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: true },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'gear_obtained',
        properties: {},
        platform: 'ios',
        session_id: 'sess_noapikey',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not forward to amplitude when enabled but missing apiKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: true },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'ability_unlocked',
        properties: {},
        platform: 'ios',
        session_id: 'sess_noapikey',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not forward to segment when enabled but missing writeKey', async () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: true },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'transmog_applied',
        properties: {},
        platform: 'ios',
        session_id: 'sess_nokey',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should store event in memory when processEvent runs', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'pve_boss_defeated',
        properties: { boss_id: 'dragon_1' },
        platform: 'android',
        session_id: 'sess_store',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      const events = analytics.getRecentEvents(100);
      const bossEvent = events.find((e: any) => e.eventName === 'pve_boss_defeated');
      expect(bossEvent).toBeDefined();
      expect(bossEvent.properties).toEqual({ boss_id: 'dragon_1' });
      expect(bossEvent.platform).toBe('android');
      expect(bossEvent.sessionId).toBe('sess_store');
    });
  });

  describe('updateDailyMetrics with analytics enabled', () => {
    it('should populate daily metrics when events are tracked', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'pve_stage_completed',
        properties: { stage_id: 'forest_1' },
        platform: 'android',
        session_id: 'sess_metrics',
      });

      // Track two events from same user
      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      const today = new Date().toISOString().split('T')[0];
      const metrics = analytics.getDailyMetrics(today, today);

      expect(metrics.length).toBeGreaterThanOrEqual(1);
      const metric = metrics.find((m: any) => m.eventName === 'pve_stage_completed');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(2);
      expect(metric!.uniqueUsers.has('user_123')).toBe(true);
    });

    it('should track unique users across events', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const payload = JSON.stringify({
        event_name: 'daily_login',
        properties: {},
        platform: 'ios',
        session_id: 'sess_unique',
      });

      const ctx1 = { userId: 'user_a', ipAddress: '1.1.1.1' } as any;
      const ctx2 = { userId: 'user_b', ipAddress: '2.2.2.2' } as any;

      analytics.rpcTrackEvent(ctx1, mockLogger as any, mockNk, payload);
      analytics.rpcTrackEvent(ctx2, mockLogger as any, mockNk, payload);

      const today = new Date().toISOString().split('T')[0];
      const metrics = analytics.getDailyMetrics(today, today);
      const metric = metrics.find((m: any) => m.eventName === 'daily_login');

      expect(metric).toBeDefined();
      expect(metric!.count).toBe(2);
      expect(metric!.uniqueUsers.size).toBe(2);
    });

    it('should return empty array for date range with no events', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const metrics = analytics.getDailyMetrics('1990-01-01', '1990-01-31');
      // May have events from other tests in same process, but none from 1990
      const filtered = metrics.filter((m: any) => m.date.startsWith('1990'));
      expect(filtered).toHaveLength(0);
    });
  });

  describe('rpcGetAnalyticsSummary with actual data', () => {
    it('should return accurate summary after tracking events', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      // Track events from two users
      const ctx1 = { userId: 'user_summary_1', ipAddress: '1.1.1.1' } as any;
      const ctx2 = { userId: 'user_summary_2', ipAddress: '2.2.2.2' } as any;

      analytics.rpcTrackEvent(
        ctx1,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'pve_stage_completed',
          properties: {},
          platform: 'android',
          session_id: '',
        })
      );
      analytics.rpcTrackEvent(
        ctx1,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'pve_stage_completed',
          properties: {},
          platform: 'android',
          session_id: '',
        })
      );
      analytics.rpcTrackEvent(
        ctx2,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'pve_stage_completed',
          properties: {},
          platform: 'ios',
          session_id: '',
        })
      );
      analytics.rpcTrackEvent(
        ctx1,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'purchase_completed',
          properties: {},
          platform: 'android',
          session_id: '',
        })
      );

      const today = new Date().toISOString().split('T')[0];
      const payload = JSON.stringify({
        start_date: today,
        end_date: today,
      });

      const result = analytics.rpcGetAnalyticsSummary(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.summary.total_events).toBe(4);
      expect(parsed.summary.unique_users).toBe(2);
      expect(parsed.summary.events['pve_stage_completed']).toEqual({
        count: 3,
        unique_users: 2,
      });
      expect(parsed.summary.events['purchase_completed']).toEqual({
        count: 1,
        unique_users: 1,
      });
    });

    it('should filter summary by event_names', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const ctx1 = { userId: 'user_filter', ipAddress: '1.1.1.1' } as any;

      analytics.rpcTrackEvent(
        ctx1,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'session_start',
          properties: {},
          platform: 'web',
          session_id: '',
        })
      );
      analytics.rpcTrackEvent(
        ctx1,
        mockLogger as any,
        mockNk,
        JSON.stringify({
          event_name: 'session_end',
          properties: {},
          platform: 'web',
          session_id: '',
        })
      );

      const today = new Date().toISOString().split('T')[0];
      const payload = JSON.stringify({
        start_date: today,
        end_date: today,
        event_names: ['session_start'],
      });

      const result = analytics.rpcGetAnalyticsSummary(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // Only session_start should appear in events breakdown
      expect(parsed.summary.events['session_start']).toBeDefined();
      expect(parsed.summary.events['session_end']).toBeUndefined();
    });
  });

  describe('rpcTrackEvent error handling', () => {
    it('should return error response when processEvent throws', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      // Mock validatePayload to return valid data but cause processEvent to throw
      const { validatePayload } = require('../validation');
      (validatePayload as jest.Mock).mockImplementationOnce(() => ({
        success: true,
        data: {
          event_name: 'crash_event',
          properties: {},
          platform: 'test',
          session_id: 'sess_crash',
        },
      }));

      // Mock Array.prototype.push to throw
      const originalPush = Array.prototype.push;
      Array.prototype.push = function (...args: any[]) {
        if (this === (analytics as any).__proto__ || this.constructor === Array) {
          // Only throw for analyticsEvents array by checking if items have eventName
          if (args[0] && typeof args[0] === 'object' && 'eventName' in args[0]) {
            throw new Error('Storage full');
          }
        }
        return originalPush.apply(this, args);
      };

      const result = analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Failed to track event');

      Array.prototype.push = originalPush;
    });

    it('should log warning when PII is detected in event properties', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const { isPII } = require('../privacy_compliance');
      (isPII as jest.Mock).mockReturnValueOnce(true);

      const payload = JSON.stringify({
        event_name: 'custom',
        properties: { email: 'user@example.com' },
        platform: 'web',
        session_id: 'sess_pii',
      });

      analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Potential PII detected')
      );

      // Reset isPII mock
      (isPII as jest.Mock).mockReturnValue(false);
    });
  });

  describe('rpcGetCircuitBreakerStates error handling', () => {
    it('should handle error when getAllCircuitInfo throws', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const { getAllCircuitInfo } = require('../../utils/circuitBreaker');
      (getAllCircuitInfo as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Circuit breaker unavailable');
      });

      const result = analytics.rpcGetCircuitBreakerStates(mockCtx, mockLogger as any, mockNk, '{}');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('INTERNAL_ERROR');
      expect(parsed.message).toBe('Failed to get circuit breaker states');
    });
  });

  describe('registerAnalyticsEndpoints with analytics enabled', () => {
    it('should register all 4 RPC endpoints', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const mockInitializer = { registerRpc: jest.fn() };
      analytics.registerAnalyticsEndpoints(mockInitializer as any);

      const { registerRpcWithMetrics } = require('../metrics');
      expect(registerRpcWithMetrics).toHaveBeenCalledTimes(4);
    });
  });

  describe('getAllEvents returns independent copy', () => {
    it('should return a copy that does not mutate internal storage', () => {
      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      analytics.rpcTrackEvent(
        mockCtx,
        mockLogger as any,
        mockNk,
        JSON.stringify({ event_name: 'test_copy', properties: {}, platform: 'web', session_id: '' })
      );

      const copy = analytics.getAllEvents();
      const originalLength = copy.length;
      copy.push({} as any); // mutate the copy

      const fresh = analytics.getAllEvents();
      expect(fresh.length).toBe(originalLength);
    });
  });

  describe('forwardToExternalAnalytics fetch error handling', () => {
    it('should handle mixpanel fetch failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: true, apiKey: 'mp_fail_key' },
        amplitude: { enabled: false },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const { withCircuitBreaker } = require('../../utils/circuitBreaker');
      // Make circuit breaker re-throw so we can see the error is caught
      (withCircuitBreaker as jest.Mock).mockImplementationOnce(
        (_name: string, fn: Function, fallback: Function) => {
          return fn().catch(() => fallback());
        }
      );

      const payload = JSON.stringify({
        event_name: 'network_error',
        properties: {},
        platform: 'android',
        session_id: 'sess_netfail',
      });

      // Should not throw
      const result = analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should handle non-ok response from amplitude', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const analytics = loadAnalyticsWithConfig({
        enabled: true,
        mixpanel: { enabled: false },
        amplitude: { enabled: true, apiKey: 'amp_fail_key' },
        segment: { enabled: false },
        customEndpoint: { url: '' },
      });

      const { withCircuitBreaker } = require('../../utils/circuitBreaker');
      (withCircuitBreaker as jest.Mock).mockImplementationOnce(
        (_name: string, fn: Function, fallback: Function) => {
          return fn().catch(() => fallback());
        }
      );

      const payload = JSON.stringify({
        event_name: 'rpc_error',
        properties: {},
        platform: 'android',
        session_id: 'sess_ampfail',
      });

      const result = analytics.rpcTrackEvent(mockCtx, mockLogger as any, mockNk, payload);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
