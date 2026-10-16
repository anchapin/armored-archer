/**
 * Unmocked runtime test for the circuitBreaker utility (issue #1414).
 *
 * Every other suite mocks either opossum or the module's behavior, so lint /
 * typecheck / unit pass even if the real library breaks across a major bump.
 * This test drives the REAL opossum instance through open / half-open /
 * close transitions and breaker.fire(), as required before the opossum 10
 * upgrade can merge. Only the logger is mocked (it is a side channel).
 */

// jest.setup.js globally mocks opossum for every suite; this file's whole
// purpose is to exercise the REAL library, so unmock it here.
jest.unmock('opossum');

import {
  createCircuitBreaker,
  withCircuitBreaker,
  getCircuitState,
  getCircuitStats,
} from '../circuitBreaker';

jest.mock('../../config/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('circuitBreaker runtime (unmocked opossum)', () => {
  const SERVICE = 'external_api';
  const OPTIONS = {
    timeout: 1000,
    errorThresholdPercentage: 50,
    volumeThreshold: 2,
    resetTimeout: 100,
  };

  it('drives open -> reject-with-fallback -> half-open -> close with the real library', async () => {
    createCircuitBreaker(SERVICE, OPTIONS);
    expect(getCircuitState(SERVICE)).toBe('CLOSED');

    const failing = async () => {
      throw new Error('downstream unavailable');
    };

    // Two failures reach the volume threshold at 100% error rate -> opens.
    await expect(withCircuitBreaker(SERVICE, failing)).rejects.toThrow(
      'downstream unavailable'
    );
    await expect(withCircuitBreaker(SERVICE, failing)).rejects.toThrow(
      'downstream unavailable'
    );
    expect(getCircuitState(SERVICE)).toBe('OPEN');

    // While open, fire() rejects immediately and the fallback is used.
    const fallbackResult = await withCircuitBreaker(
      SERVICE,
      async () => 'should not run',
      async () => 'fallback'
    );
    expect(fallbackResult).toBe('fallback');

    const statsAfterOpen = getCircuitStats(SERVICE);
    expect(statsAfterOpen).not.toBeNull();
    expect(statsAfterOpen!.failures).toBe(2);
    expect(statsAfterOpen!.rejects).toBeGreaterThanOrEqual(1);
    expect(statsAfterOpen!.lastFailure).not.toBeNull();

    // Past resetTimeout the next fire is the half-open trial; a success closes.
    await sleep(150);
    const recovered = await withCircuitBreaker(SERVICE, async () => 'ok');
    expect(recovered).toBe('ok');
    expect(getCircuitState(SERVICE)).toBe('CLOSED');

    const statsAfterClose = getCircuitStats(SERVICE);
    expect(statsAfterClose!.successes).toBe(1);
  }, 10000);
});
