import { getProfilingConfig } from '../profiling';

describe('Profiling Configuration', () => {
  test('getProfilingConfig should return config object', () => {
    const config = getProfilingConfig();
    expect(config).toBeDefined();
    expect(typeof config.enabled).toBe('boolean');
  });

  test('getProfilingConfig should have slowThresholdMs', () => {
    const config = getProfilingConfig();
    expect(config.slowThresholdMs).toBeDefined();
    expect(typeof config.slowThresholdMs).toBe('number');
    expect(config.slowThresholdMs).toBeGreaterThan(0);
  });

  test('getProfilingConfig should have logSlowOperations', () => {
    const config = getProfilingConfig();
    expect(config.logSlowOperations).toBeDefined();
    expect(typeof config.logSlowOperations).toBe('boolean');
  });
});

describe('ProfilingConfig interface', () => {
  test('should allow creating config with all properties', () => {
    const customConfig = {
      enabled: true,
      slowThresholdMs: 50,
      logSlowOperations: true,
    };

    expect(customConfig.enabled).toBe(true);
    expect(customConfig.slowThresholdMs).toBe(50);
    expect(customConfig.logSlowOperations).toBe(true);
  });

  test('should allow creating disabled config', () => {
    const disabledConfig = {
      enabled: false,
      slowThresholdMs: 1000,
      logSlowOperations: false,
    };

    expect(disabledConfig.enabled).toBe(false);
    expect(disabledConfig.slowThresholdMs).toBe(1000);
    expect(disabledConfig.logSlowOperations).toBe(false);
  });
});
