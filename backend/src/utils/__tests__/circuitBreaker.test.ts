/**
 * Tests for circuitBreaker utility
 */

import {
  createCircuitBreaker,
  getCircuitBreaker,
  withCircuitBreaker,
  getCircuitState,
  getCircuitStats,
  getAllCircuitStates,
  openCircuit,
  closeCircuit,
  getAllCircuitInfo,
} from '../circuitBreaker';

jest.mock('../../config/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('circuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCircuitBreaker', () => {
    it('should create a circuit breaker for a service', () => {
      const breaker = createCircuitBreaker('postgres');
      expect(breaker).toBeDefined();
    });

    it('should return existing instance if circuit already exists', () => {
      const breaker1 = createCircuitBreaker('existing_service_cb');
      const breaker2 = createCircuitBreaker('existing_service_cb');
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create new circuit if not exists', () => {
      const breaker = getCircuitBreaker('new_service_cb');
      expect(breaker).toBeDefined();
    });

    it('should return existing circuit if exists', () => {
      const breaker1 = getCircuitBreaker('existing_get_cb');
      const breaker2 = getCircuitBreaker('existing_get_cb');
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute function through circuit breaker', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const result = await withCircuitBreaker('test_service_cb', fn);
      expect(result).toBe('result');
    });

    it('should use fallback when circuit is open', async () => {
      getCircuitBreaker('fallback_service_cb');
      openCircuit('fallback_service_cb');

      const fn = jest.fn().mockRejectedValue(new Error('Should not call'));
      const fallback = jest.fn().mockResolvedValue('fallback_result');

      const result = await withCircuitBreaker('fallback_service_cb', fn, fallback);
      expect(result).toBe('fallback_result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw error when circuit is open and no fallback', async () => {
      getCircuitBreaker('no_fallback_service_cb');
      openCircuit('no_fallback_service_cb');

      const fn = jest.fn().mockRejectedValue(new Error('test error'));

      await expect(withCircuitBreaker('no_fallback_service_cb', fn)).rejects.toThrow();
    });
  });

  describe('getCircuitState', () => {
    it('should return null for unknown service', () => {
      expect(getCircuitState('unknown_service_cb')).toBeNull();
    });

    it('should return CLOSED for new circuit', () => {
      getCircuitBreaker('new_circuit_cb');
      expect(getCircuitState('new_circuit_cb')).toBe('CLOSED');
    });

    it('should return OPEN when circuit is opened', () => {
      getCircuitBreaker('openable_circuit_cb');
      openCircuit('openable_circuit_cb');
      expect(getCircuitState('openable_circuit_cb')).toBe('OPEN');
    });
  });

  describe('getCircuitStats', () => {
    it('should return null for unknown service', () => {
      expect(getCircuitStats('unknown_stats_cb')).toBeNull();
    });

    it('should return stats for existing service', () => {
      getCircuitBreaker('stats_service_cb');
      const stats = getCircuitStats('stats_service_cb');
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('rejects');
    });
  });

  describe('getAllCircuitStates', () => {
    it('should return states for all circuits', () => {
      getCircuitBreaker('state_a_cb');
      getCircuitBreaker('state_b_cb');
      const states = getAllCircuitStates();
      expect(states.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('openCircuit/closeCircuit', () => {
    it('should return false for unknown circuit', () => {
      expect(openCircuit('nonexistent_cb')).toBe(false);
      expect(closeCircuit('nonexistent_cb')).toBe(false);
    });

    it('should open and close circuit', () => {
      getCircuitBreaker('toggle_circuit_cb');
      expect(openCircuit('toggle_circuit_cb')).toBe(true);
      expect(getCircuitState('toggle_circuit_cb')).toBe('OPEN');
      expect(closeCircuit('toggle_circuit_cb')).toBe(true);
      expect(getCircuitState('toggle_circuit_cb')).toBe('CLOSED');
    });
  });

  describe('getAllCircuitInfo', () => {
    it('should return info for all circuits', () => {
      getCircuitBreaker('info_circuit_cb');
      const info = getAllCircuitInfo();
      expect(Array.isArray(info)).toBe(true);
      if (info.length > 0) {
        expect(info[0]).toHaveProperty('serviceName');
        expect(info[0]).toHaveProperty('state');
        expect(info[0]).toHaveProperty('stats');
        expect(info[0]).toHaveProperty('options');
      }
    });
  });
});
