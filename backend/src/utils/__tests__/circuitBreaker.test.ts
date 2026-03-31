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

// Mock opossum
jest.mock('opossum', () => {
  return jest.fn().mockImplementation(() => ({
    fire: jest.fn().mockResolvedValue('success'),
    on: jest.fn(),
    opened: false,
    halfOpen: false,
    open: jest.fn().mockImplementation(function () {
      this.opened = true;
    }),
    close: jest.fn().mockImplementation(function () {
      this.opened = false;
      this.halfOpen = false;
    }),
  }));
});

// Mock logger
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
      const breaker1 = createCircuitBreaker('existing_service');
      const breaker2 = createCircuitBreaker('existing_service');
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create new circuit if not exists', () => {
      const breaker = getCircuitBreaker('new_service');
      expect(breaker).toBeDefined();
    });

    it('should return existing circuit if exists', () => {
      const breaker1 = getCircuitBreaker('existing_get');
      const breaker2 = getCircuitBreaker('existing_get');
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute function through circuit breaker', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const result = await withCircuitBreaker('test_service', fn);
      expect(result).toBe('result');
    });

    it('should use fallback when circuit is open', async () => {
      // Open the circuit first
      openCircuit('fallback_service');

      const fn = jest.fn().mockRejectedValue(new Error('Should not call'));
      const fallback = jest.fn().mockResolvedValue('fallback_result');

      const result = await withCircuitBreaker('fallback_service', fn, fallback);
      expect(result).toBe('fallback_result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw error when circuit is open and no fallback', async () => {
      openCircuit('no_fallback_service');

      const fn = jest.fn().mockRejectedValue(new Error('test error'));

      await expect(withCircuitBreaker('no_fallback_service', fn)).rejects.toThrow('test error');
    });
  });

  describe('getCircuitState', () => {
    it('should return null for unknown service', () => {
      expect(getCircuitState('unknown_service')).toBeNull();
    });

    it('should return CLOSED for new circuit', () => {
      getCircuitBreaker('new_circuit');
      expect(getCircuitState('new_circuit')).toBe('CLOSED');
    });

    it('should return OPEN when circuit is opened', () => {
      getCircuitBreaker('openable_circuit');
      openCircuit('openable_circuit');
      expect(getCircuitState('openable_circuit')).toBe('OPEN');
    });
  });

  describe('getCircuitStats', () => {
    it('should return null for unknown service', () => {
      expect(getCircuitStats('unknown_stats')).toBeNull();
    });

    it('should return stats for existing service', () => {
      getCircuitBreaker('stats_service');
      const stats = getCircuitStats('stats_service');
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('rejects');
    });
  });

  describe('getAllCircuitStates', () => {
    it('should return states for all circuits', () => {
      getCircuitBreaker('state_a');
      getCircuitBreaker('state_b');
      const states = getAllCircuitStates();
      expect(states.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('openCircuit/closeCircuit', () => {
    it('should return false for unknown circuit', () => {
      expect(openCircuit('nonexistent')).toBe(false);
      expect(closeCircuit('nonexistent')).toBe(false);
    });

    it('should open and close circuit', () => {
      getCircuitBreaker('toggle_circuit');
      expect(openCircuit('toggle_circuit')).toBe(true);
      expect(getCircuitState('toggle_circuit')).toBe('OPEN');
      expect(closeCircuit('toggle_circuit')).toBe(true);
      expect(getCircuitState('toggle_circuit')).toBe('CLOSED');
    });
  });

  describe('getAllCircuitInfo', () => {
    it('should return info for all circuits', () => {
      getCircuitBreaker('info_circuit');
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
