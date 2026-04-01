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
import { logger } from '../../config/logger';

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

    it('should create with custom options', () => {
      const breaker = createCircuitBreaker('custom_opts_cb', {
        timeout: 1000,
        errorThresholdPercentage: 75,
        volumeThreshold: 5,
        resetTimeout: 10000,
      });
      expect(breaker).toBeDefined();
    });

    it('should log warning on open event', () => {
      const breaker = createCircuitBreaker('event_open_cb');
      breaker.open();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('event_open_cb')
      );
    });

    it('should log info on close event', () => {
      const breaker = createCircuitBreaker('event_close_cb');
      breaker.open();
      breaker.close();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('event_close_cb')
      );
    });

    it('should log debug on success event', async () => {
      const breaker = createCircuitBreaker('event_success_cb');
      await breaker.fire(async () => 'ok');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('event_success_cb')
      );
    });

    it('should log error on failure event', async () => {
      const breaker = createCircuitBreaker('event_failure_cb');
      try { await breaker.fire(async () => { throw new Error('fail'); }); } catch {}
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('event_failure_cb')
      );
    });

    it('should log warning on reject event', async () => {
      const breaker = createCircuitBreaker('event_reject_cb');
      breaker.open();
      try { await breaker.fire(async () => 'ok'); } catch {}
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('event_reject_cb')
      );
    });

    it('should log info on halfOpen event', () => {
      const breaker = createCircuitBreaker('event_halfopen_cb');
      breaker.emit('halfOpen');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('event_halfopen_cb')
      );
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

    it('should accept custom options when creating new circuit', async () => {
      const fn = jest.fn().mockResolvedValue('custom_result');
      const result = await withCircuitBreaker('custom_with_cb', fn, undefined, {
        timeout: 2000,
      });
      expect(result).toBe('custom_result');
    });

    it('should not use fallback when circuit is closed but function throws', async () => {
      getCircuitBreaker('closed_err_cb');
      const fn = jest.fn().mockRejectedValue(new Error('fn error'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      await expect(withCircuitBreaker('closed_err_cb', fn, fallback)).rejects.toThrow();
      expect(fallback).not.toHaveBeenCalled();
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

    it('should return HALF_OPEN when circuit is half-open', () => {
      getCircuitBreaker('halfopen_state_cb');
      const states = getAllCircuitStates();
      // Manually set halfOpen on the instance to test the branch
      const breaker = getCircuitBreaker('halfopen_state_cb');
      (breaker as any).halfOpen = true;
      (breaker as any).opened = false;
      expect(getCircuitState('halfopen_state_cb')).toBe('HALF_OPEN');
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
      expect(stats).toHaveProperty('lastFailure');
    });

    it('should track failures via event', async () => {
      const breaker = getCircuitBreaker('stats_failures_cb');
      try { await breaker.fire(async () => { throw new Error('fail'); }); } catch {}
      const stats = getCircuitStats('stats_failures_cb');
      expect(stats!.failures).toBe(1);
      expect(stats!.lastFailure).not.toBeNull();
    });

    it('should track successes via event', async () => {
      const breaker = getCircuitBreaker('stats_successes_cb');
      await breaker.fire(async () => 'ok');
      const stats = getCircuitStats('stats_successes_cb');
      expect(stats!.successes).toBe(1);
    });

    it('should track rejects via event', async () => {
      const breaker = getCircuitBreaker('stats_rejects_cb');
      breaker.open();
      try { await breaker.fire(async () => 'ok'); } catch {}
      const stats = getCircuitStats('stats_rejects_cb');
      expect(stats!.rejects).toBe(1);
    });

    it('should return a copy of stats (not reference)', () => {
      getCircuitBreaker('stats_copy_cb');
      const stats1 = getCircuitStats('stats_copy_cb');
      const stats2 = getCircuitStats('stats_copy_cb');
      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('getAllCircuitStates', () => {
    it('should return states for all circuits', () => {
      getCircuitBreaker('state_a_cb');
      getCircuitBreaker('state_b_cb');
      const states = getAllCircuitStates();
      expect(states.size).toBeGreaterThanOrEqual(2);
    });

    it('should include OPEN state for opened circuits', () => {
      getCircuitBreaker('state_open_cb');
      openCircuit('state_open_cb');
      const states = getAllCircuitStates();
      expect(states.get('state_open_cb')).toBe('OPEN');
    });

    it('should include HALF_OPEN state for half-open circuits', () => {
      getCircuitBreaker('state_halfopen_cb');
      const breaker = getCircuitBreaker('state_halfopen_cb') as any;
      breaker.opened = false;
      breaker.halfOpen = true;
      const states = getAllCircuitStates();
      expect(states.get('state_halfopen_cb')).toBe('HALF_OPEN');
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

    it('should log warning when opening unknown circuit', () => {
      openCircuit('nonexistent_warn_cb');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot open circuit')
      );
    });

    it('should log warning when closing unknown circuit', () => {
      closeCircuit('nonexistent_close_cb');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot close circuit')
      );
    });

    it('should log warning when manually opening', () => {
      getCircuitBreaker('manual_open_cb');
      openCircuit('manual_open_cb');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit manually opened')
      );
    });

    it('should log info when manually closing', () => {
      getCircuitBreaker('manual_close_cb');
      openCircuit('manual_close_cb');
      closeCircuit('manual_close_cb');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit manually closed')
      );
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

    it('should return OPEN state in info for opened circuits', () => {
      getCircuitBreaker('info_open_cb');
      openCircuit('info_open_cb');
      const info = getAllCircuitInfo();
      const entry = info.find((i) => i.serviceName === 'info_open_cb');
      expect(entry).toBeDefined();
      expect(entry!.state).toBe('OPEN');
    });

    it('should return CLOSED state in info for closed circuits', () => {
      getCircuitBreaker('info_closed_cb');
      const info = getAllCircuitInfo();
      const entry = info.find((i) => i.serviceName === 'info_closed_cb');
      expect(entry).toBeDefined();
      expect(entry!.state).toBe('CLOSED');
    });

    it('should return HALF_OPEN state in info', () => {
      getCircuitBreaker('info_halfopen_cb');
      const breaker = getCircuitBreaker('info_halfopen_cb') as any;
      breaker.opened = false;
      breaker.halfOpen = true;
      const info = getAllCircuitInfo();
      const entry = info.find((i) => i.serviceName === 'info_halfopen_cb');
      expect(entry).toBeDefined();
      expect(entry!.state).toBe('HALF_OPEN');
    });

    it('should include options in info', () => {
      createCircuitBreaker('info_opts_cb', { timeout: 1234 });
      const info = getAllCircuitInfo();
      const entry = info.find((i) => i.serviceName === 'info_opts_cb');
      expect(entry).toBeDefined();
      expect(entry!.options.timeout).toBe(1234);
    });

    it('should include stats in info', async () => {
      const breaker = getCircuitBreaker('info_stats_cb');
      await breaker.fire(async () => 'ok');
      try { await breaker.fire(async () => { throw new Error('err'); }); } catch {}
      const info = getAllCircuitInfo();
      const entry = info.find((i) => i.serviceName === 'info_stats_cb');
      expect(entry).toBeDefined();
      expect(entry!.stats.successes).toBe(1);
      expect(entry!.stats.failures).toBe(1);
    });
  });
});
