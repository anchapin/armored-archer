import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  processFunnelEvent,
  rpcGetFunnelConversion,
  rpcGetPlayerFunnelState,
  registerFunnelAnalyticsEndpoints,
} from '../funnel_analytics';

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
  setFunnelPlayers: jest.fn(),
  setFunnelConversionRate: jest.fn(),
  setFunnelDropoff: jest.fn(),
}));

jest.mock('../validation', () => ({
  validatePayload: jest.fn((_schema: unknown, payload: string, name: string) => {
    try {
      const data = JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: `Invalid JSON for ${name}` };
    }
  }),
  ZodSchemas: {
    get_funnel_conversion: {},
    get_player_funnel_state: {},
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

function createMockNk(storedPlayerState: any = null, storedGlobalCounts: any = null) {
  const stateStore: Record<string, any> = {};
  if (storedPlayerState) {
    stateStore['player:user_123'] = storedPlayerState;
  }
  if (storedGlobalCounts) {
    stateStore['global'] = storedGlobalCounts;
  }

  return {
    storageRead: jest.fn((keys: any[]) => {
      const results: any[] = [];
      for (const key of keys) {
        if (key.key === 'player_funnel_state') {
          const state = stateStore[`player:${key.userId}`];
          if (state) {
            results.push({ value: JSON.stringify(state) });
          }
        } else if (key.key === 'global_funnel_counts') {
          if (stateStore['global']) {
            results.push({ value: JSON.stringify(stateStore['global']) });
          }
        }
      }
      return results;
    }),
    storageWrite: jest.fn((writes: any[]) => {
      for (const write of writes) {
        const data = JSON.parse(write.value);
        if (write.key === 'player_funnel_state') {
          stateStore[`player:${write.userId}`] = data;
        } else if (write.key === 'global_funnel_counts') {
          stateStore['global'] = data;
        }
      }
    }),
  } as any;
}

describe('Funnel Analytics Module', () => {
  let mockNk: ReturnType<typeof createMockNk>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNk = createMockNk();
  });

  describe('processFunnelEvent', () => {
    it('should ignore events not in the funnel mapping', () => {
      processFunnelEvent(mockNk, mockLogger, 'user_123', 'some_random_event');
      expect(mockNk.storageRead).not.toHaveBeenCalled();
    });

    it('should initialize player state on first_session event', () => {
      processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');

      expect(mockNk.storageWrite).toHaveBeenCalledTimes(2);
      const playerWrite = mockNk.storageWrite.mock.calls[0][0][0];
      expect(playerWrite.collection).toBe('funnel_analytics');
      expect(playerWrite.key).toBe('player_funnel_state');

      const state = JSON.parse(playerWrite.value);
      expect(state.install_timestamp).not.toBeNull();
      expect(state.first_pve_timestamp).toBeNull();
    });

    it('should set first_pve_timestamp on pve_stage_completed', () => {
      mockNk = createMockNk(
        { user_id: 'user_123', install_timestamp: 1000, first_pve_timestamp: null, first_pvp_timestamp: null, first_purchase_timestamp: null, last_updated: 1000 },
        { install: 1, first_pve_completed: 0, first_pvp_completed: 0, first_purchase: 0, updated_at: 1000 }
      );

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'pve_stage_completed');

      const playerWrite = mockNk.storageWrite.mock.calls[0][0][0];
      const state = JSON.parse(playerWrite.value);
      expect(state.first_pve_timestamp).not.toBeNull();
    });

    it('should set first_pvp_timestamp on pvp_match_completed', () => {
      mockNk = createMockNk(
        { user_id: 'user_123', install_timestamp: 1000, first_pve_timestamp: 2000, first_pvp_timestamp: null, first_purchase_timestamp: null, last_updated: 2000 },
        { install: 1, first_pve_completed: 1, first_pvp_completed: 0, first_purchase: 0, updated_at: 2000 }
      );

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'pvp_match_completed');

      const playerWrite = mockNk.storageWrite.mock.calls[0][0][0];
      const state = JSON.parse(playerWrite.value);
      expect(state.first_pvp_timestamp).not.toBeNull();
    });

    it('should set first_purchase_timestamp on purchase_completed', () => {
      mockNk = createMockNk(
        { user_id: 'user_123', install_timestamp: 1000, first_pve_timestamp: 2000, first_pvp_timestamp: 3000, first_purchase_timestamp: null, last_updated: 3000 },
        { install: 1, first_pve_completed: 1, first_pvp_completed: 1, first_purchase: 0, updated_at: 3000 }
      );

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'purchase_completed');

      const playerWrite = mockNk.storageWrite.mock.calls[0][0][0];
      const state = JSON.parse(playerWrite.value);
      expect(state.first_purchase_timestamp).not.toBeNull();
    });

    it('should be idempotent for repeated events', () => {
      mockNk = createMockNk(
        { user_id: 'user_123', install_timestamp: 1000, first_pve_timestamp: null, first_pvp_timestamp: null, first_purchase_timestamp: null, last_updated: 1000 },
        { install: 1, first_pve_completed: 0, first_pvp_completed: 0, first_purchase: 0, updated_at: 1000 }
      );

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');

      // Second call should not write since install_timestamp is already set
      const writeCount = mockNk.storageWrite.mock.calls.length;
      processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');
      expect(mockNk.storageWrite.mock.calls.length).toBe(writeCount);
    });

    it('should increment global funnel counts', () => {
      mockNk = createMockNk(null, null);

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');

      const globalWrite = mockNk.storageWrite.mock.calls[1][0][0];
      const counts = JSON.parse(globalWrite.value);
      expect(counts.install).toBe(1);
    });

    it('should update Prometheus metrics after state change', () => {
      const { setFunnelPlayers, setFunnelConversionRate, setFunnelDropoff } = require('../metrics');

      processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');

      expect(setFunnelPlayers).toHaveBeenCalledWith('install', 1);
      expect(setFunnelDropoff).toHaveBeenCalled();
    });

    it('should handle storage read failure gracefully', () => {
      mockNk.storageRead = jest.fn(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        processFunnelEvent(mockNk, mockLogger, 'user_123', 'first_session');
      }).not.toThrow();
    });
  });

  describe('rpcGetFunnelConversion', () => {
    it('should return zeros when no data exists', () => {
      const result = JSON.parse(
        rpcGetFunnelConversion(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.counts.install).toBe(0);
      expect(result.conversion_rates.overall).toBe(0);
    });

    it('should return correct conversion rates with data', () => {
      mockNk = createMockNk(null, {
        install: 100,
        first_pve_completed: 60,
        first_pvp_completed: 30,
        first_purchase: 10,
        updated_at: Date.now(),
      });

      const result = JSON.parse(
        rpcGetFunnelConversion(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.counts.install).toBe(100);
      expect(result.counts.first_pve_completed).toBe(60);
      expect(result.counts.first_pvp_completed).toBe(30);
      expect(result.counts.first_purchase).toBe(10);
      expect(result.conversion_rates.install_to_first_pve).toBe(60);
      expect(result.conversion_rates.first_pve_to_first_pvp).toBe(50);
      expect(result.conversion_rates.first_pvp_to_first_purchase).toBeCloseTo(33.33, 1);
      expect(result.conversion_rates.overall).toBe(10);
    });

    it('should compute correct drop-off counts', () => {
      mockNk = createMockNk(null, {
        install: 100,
        first_pve_completed: 60,
        first_pvp_completed: 30,
        first_purchase: 10,
        updated_at: Date.now(),
      });

      const result = JSON.parse(
        rpcGetFunnelConversion(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.dropoff.install).toBe(40);
      expect(result.dropoff.first_pve_completed).toBe(30);
      expect(result.dropoff.first_pvp_completed).toBe(20);
    });

    it('should validate payload', () => {
      const result = JSON.parse(
        rpcGetFunnelConversion(mockCtx, mockLogger, mockNk, 'invalid json')
      );

      expect(result.success).toBe(false);
    });
  });

  describe('rpcGetPlayerFunnelState', () => {
    it('should return none state for new players', () => {
      const result = JSON.parse(
        rpcGetPlayerFunnelState(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.funnel_state.current_step).toBe('none');
      expect(result.funnel_state.steps_completed).toEqual([]);
    });

    it('should return correct current_step for partial completion', () => {
      mockNk = createMockNk({
        user_id: 'user_123',
        install_timestamp: 1000,
        first_pve_timestamp: 2000,
        first_pvp_timestamp: null,
        first_purchase_timestamp: null,
        last_updated: 2000,
      });

      const result = JSON.parse(
        rpcGetPlayerFunnelState(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.funnel_state.current_step).toBe('first_pve_completed');
      expect(result.funnel_state.steps_completed).toContain('install');
      expect(result.funnel_state.steps_completed).toContain('first_pve_completed');
    });

    it('should return first_purchase when fully converted', () => {
      mockNk = createMockNk({
        user_id: 'user_123',
        install_timestamp: 1000,
        first_pve_timestamp: 2000,
        first_pvp_timestamp: 3000,
        first_purchase_timestamp: 4000,
        last_updated: 4000,
      });

      const result = JSON.parse(
        rpcGetPlayerFunnelState(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.funnel_state.current_step).toBe('first_purchase');
      expect(result.funnel_state.steps_completed).toHaveLength(4);
    });

    it('should compute days_since_install', () => {
      const threeDaysAgo = Date.now() - 3 * 86400000;
      mockNk = createMockNk({
        user_id: 'user_123',
        install_timestamp: threeDaysAgo,
        first_pve_timestamp: null,
        first_pvp_timestamp: null,
        first_purchase_timestamp: null,
        last_updated: threeDaysAgo,
      });

      const result = JSON.parse(
        rpcGetPlayerFunnelState(mockCtx, mockLogger, mockNk, '{}')
      );

      expect(result.success).toBe(true);
      expect(result.funnel_state.days_since_install).toBe(3);
    });
  });

  describe('registerFunnelAnalyticsEndpoints', () => {
    it('should register both RPC endpoints', () => {
      const { registerRpcWithMetrics } = require('../metrics');
      const mockInitializer = { registerRpc: jest.fn() } as any;

      registerFunnelAnalyticsEndpoints(mockInitializer);

      expect(registerRpcWithMetrics).toHaveBeenCalledTimes(2);
      expect(registerRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/get_funnel_conversion',
        'get_funnel_conversion',
        expect.any(Function)
      );
      expect(registerRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/get_player_funnel_state',
        'get_player_funnel_state',
        expect.any(Function)
      );
    });
  });
});
