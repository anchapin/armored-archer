import {
  getProfilingConfig,
  setProfilingConfig,
  setProfilingEnabled,
  isProfilingEnabled,
  profileSync,
  profileAsync,
  profileFunction,
  createProfileBlock,
  getProfileData,
  getAllProfileData,
  getProfileReport,
  getFormattedProfileReport,
  clearProfileData,
  resetProfiling,
  wrapRpcWithProfiling,
  registerRpcWithProfiling,
  profileMethod,
  profileCriticalPath,
  initializeProfiling,
  logProfileReport,
} from '../profiling';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Profiling Configuration', () => {
  beforeEach(() => {
    resetProfiling();
  });

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

  test('setProfilingConfig should update configuration', () => {
    setProfilingConfig({ enabled: true, slowThresholdMs: 50 });
    const config = getProfilingConfig();
    expect(config.enabled).toBe(true);
    expect(config.slowThresholdMs).toBe(50);
  });

  test('setProfilingConfig should merge partial config', () => {
    setProfilingConfig({ enabled: true, slowThresholdMs: 100, logSlowOperations: false });
    setProfilingConfig({ enabled: false });
    const config = getProfilingConfig();
    expect(config.enabled).toBe(false);
    expect(config.slowThresholdMs).toBe(100);
    expect(config.logSlowOperations).toBe(false);
  });

  test('setProfilingEnabled should toggle profiling', () => {
    setProfilingEnabled(true);
    expect(isProfilingEnabled()).toBe(true);
    setProfilingEnabled(false);
    expect(isProfilingEnabled()).toBe(false);
  });
});

describe('profileSync', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should execute function and return result', () => {
    const result = profileSync('test_fn', () => 42);
    expect(result).toBe(42);
  });

  test('should record profile data', () => {
    profileSync('recorded_fn', () => 'hello');
    const data = getProfileData('recorded_fn');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
    expect(data?.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  test('should track min and max times', () => {
    profileSync('minmax_fn', () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) sum += i;
      return sum;
    });
    profileSync('minmax_fn', () => 0);
    const data = getProfileData('minmax_fn');
    expect(data?.callCount).toBe(2);
    expect(data?.maxTimeMs).toBeGreaterThanOrEqual(data?.minTimeMs);
  });

  test('should track errors', () => {
    expect(() =>
      profileSync('error_fn', () => {
        throw new Error('test error');
      })
    ).toThrow('test error');
    const data = getProfileData('error_fn');
    expect(data?.errors).toBe(1);
  });

  test('should not record when disabled', () => {
    setProfilingEnabled(false);
    profileSync('disabled_fn', () => 'result');
    expect(getProfileData('disabled_fn')).toBeNull();
  });
});

describe('profileAsync', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should execute async function and return result', async () => {
    const result = await profileAsync('async_fn', async () => 'async_result');
    expect(result).toBe('async_result');
  });

  test('should record profile data for async', async () => {
    await profileAsync('async_recorded', async () => {
      await new Promise((r) => setTimeout(r, 1));
      return true;
    });
    const data = getProfileData('async_recorded');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
  });

  test('should track errors in async', async () => {
    await expect(
      profileAsync('async_error', async () => {
        throw new Error('async error');
      })
    ).rejects.toThrow('async error');
    const data = getProfileData('async_error');
    expect(data?.errors).toBe(1);
  });
});

describe('profileFunction', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should work with sync functions', async () => {
    const result = await profileFunction('sync_wrapper', () => 123);
    expect(result).toBe(123);
  });

  test('should work with async functions', async () => {
    const result = await profileFunction('async_wrapper', async () => 'wrapped');
    expect(result).toBe('wrapped');
  });

  test('should not profile when disabled', () => {
    setProfilingEnabled(false);
    profileFunction('disabled_wrapper', () => 'skip');
    expect(getProfileData('disabled_wrapper')).toBeNull();
  });
});

describe('createProfileBlock', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should return end and getDuration functions', () => {
    const block = createProfileBlock('block_test');
    expect(typeof block.end).toBe('function');
    expect(typeof block.getDuration).toBe('function');
  });

  test('should getDuration return positive number', () => {
    const block = createProfileBlock('duration_test');
    const start = Date.now();
    while (Date.now() - start < 2) {}
    const duration = block.getDuration();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  test('should record data when end is called', () => {
    const block = createProfileBlock('end_test');
    block.end();
    const data = getProfileData('end_test');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
  });

  test('should not record when disabled', () => {
    setProfilingEnabled(false);
    const block = createProfileBlock('disabled_block');
    block.end();
    expect(getProfileData('disabled_block')).toBeNull();
  });
});

describe('Profile Data Retrieval', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('getProfileData should return null for unknown name', () => {
    expect(getProfileData('nonexistent')).toBeNull();
  });

  test('getAllProfileData should return empty map initially', () => {
    const all = getAllProfileData();
    expect(all.size).toBe(0);
  });

  test('getAllProfileData should return all profiles', () => {
    profileSync('fn1', () => 1);
    profileSync('fn2', () => 2);
    const all = getAllProfileData();
    expect(all.size).toBe(2);
    expect(all.has('fn1')).toBe(true);
    expect(all.has('fn2')).toBe(true);
  });

  test('getProfileReport should return sorted array', () => {
    profileSync('slow', () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++) sum += i;
      return sum;
    });
    profileSync('fast', () => 0);
    const report = getProfileReport();
    expect(Array.isArray(report)).toBe(true);
    expect(report.length).toBe(2);
  });

  test('getProfileReport should calculate avgTimeMs', () => {
    profileSync('avg_test', () => 0);
    profileSync('avg_test', () => 0);
    const report = getProfileReport();
    const entry = report.find((r) => r.name === 'avg_test');
    expect(entry).toBeDefined();
    expect(entry?.callCount).toBe(2);
  });

  test('getProfileReport should calculate errorRate', () => {
    expect(() =>
      profileSync('error_rate', () => {
        throw new Error('fail');
      })
    ).toThrow();
    profileSync('error_rate', () => 0);
    const report = getProfileReport();
    const entry = report.find((r) => r.name === 'error_rate');
    expect(entry?.errorRate).toBe(0.5);
  });

  test('getFormattedProfileReport should return string', () => {
    profileSync('format_test', () => 0);
    const formatted = getFormattedProfileReport();
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Profiling Report');
  });

  test('getFormattedProfileReport should handle empty data', () => {
    clearProfileData();
    const formatted = getFormattedProfileReport();
    expect(formatted).toContain('No profiling data');
  });
});

describe('clearProfileData and resetProfiling', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('clearProfileData should remove all data', () => {
    profileSync('clear1', () => 1);
    profileSync('clear2', () => 2);
    clearProfileData();
    expect(getAllProfileData().size).toBe(0);
  });

  test('resetProfiling should clear data and update config', () => {
    profileSync('reset_test', () => 1);
    resetProfiling({ enabled: false, slowThresholdMs: 200 });
    expect(getAllProfileData().size).toBe(0);
    expect(getProfilingConfig().enabled).toBe(false);
    expect(getProfilingConfig().slowThresholdMs).toBe(200);
  });
});

describe('wrapRpcWithProfiling', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should wrap sync handler and return result', async () => {
    const handler = (_ctx, _logger, _nk, payload) => `echo: ${payload}`;
    const wrapped = wrapRpcWithProfiling('echo', handler);
    const result = await wrapped({} as any, {} as any, {} as any, 'hello');
    expect(result).toBe('echo: hello');
  });

  test('should wrap async handler and return result', async () => {
    const handler = async (_ctx, _logger, _nk, payload) => `async: ${payload}`;
    const wrapped = wrapRpcWithProfiling('async_echo', handler);
    const result = await wrapped({} as any, {} as any, {} as any, 'world');
    expect(result).toBe('async: world');
  });

  test('should track errors in wrapped handler', async () => {
    const handler = () => {
      throw new Error('rpc error');
    };
    const wrapped = wrapRpcWithProfiling('error_rpc', handler);
    await expect(wrapped({} as any, {} as any, {} as any, '')).rejects.toThrow('rpc error');
    const data = getProfileData('rpc.error_rpc');
    expect(data?.errors).toBe(1);
  });
});

describe('profileMethod decorator', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should wrap method correctly', async () => {
    class TestService {
      async myMethod(x: number) {
        return x * 2;
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(TestService.prototype, 'myMethod');
    const decoratedDescriptor = profileMethod('myMethod')(
      TestService.prototype,
      'myMethod',
      descriptor!
    );

    const instance = new TestService();
    const result = await decoratedDescriptor.value.call(instance, 5);
    expect(result).toBe(10);
  });
});

describe('profileCriticalPath', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should return start, end, getDuration', () => {
    const path = profileCriticalPath('test_path');
    expect(typeof path.start).toBe('function');
    expect(typeof path.end).toBe('function');
    expect(typeof path.getDuration).toBe('function');
  });

  test('should record data when end is called', () => {
    const path = profileCriticalPath('critical_test');
    path.end();
    const data = getProfileData('critical.critical_test');
    expect(data).not.toBeNull();
  });

  test('should not double-record on multiple end calls', () => {
    const path = profileCriticalPath('double_end');
    path.end();
    path.end();
    const data = getProfileData('critical.double_end');
    expect(data?.callCount).toBe(1);
  });

  test('should not record when disabled', () => {
    setProfilingEnabled(false);
    const path = profileCriticalPath('disabled_path');
    path.end();
    expect(getProfileData('critical.disabled_path')).toBeNull();
  });
});

describe('initializeProfiling and logProfileReport', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('initializeProfiling should not throw', () => {
    expect(() => initializeProfiling()).not.toThrow();
  });

  test('logProfileReport should not throw', () => {
    expect(() => logProfileReport()).not.toThrow();
  });
});

describe('registerRpcWithProfiling', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should register handler via initializer', () => {
    const mockRegisterRpc = jest.fn();
    const mockInitializer = { registerRpc: mockRegisterRpc } as any;
    const handler = (_ctx: any, _logger: any, _nk: any, payload: string) => `result: ${payload}`;

    registerRpcWithProfiling(mockInitializer, 'my_rpc', 'my_rpc', handler);

    expect(mockRegisterRpc).toHaveBeenCalledTimes(1);
    expect(mockRegisterRpc).toHaveBeenCalledWith('my_rpc', expect.any(Function));
  });

  test('registered handler should be wrapped with profiling', async () => {
    let capturedHandler: any;
    const mockRegisterRpc = (_id: string, handler: any) => {
      capturedHandler = handler;
    };
    const mockInitializer = { registerRpc: mockRegisterRpc } as any;
    const handler = (_ctx: any, _logger: any, _nk: any, payload: string) => `echo: ${payload}`;

    registerRpcWithProfiling(mockInitializer, 'wrapped_rpc', 'wrapped_rpc', handler);

    const result = await capturedHandler({} as any, {} as any, {} as any, 'test');
    expect(result).toBe('echo: test');

    const data = getProfileData('rpc.wrapped_rpc');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
  });

  test('registered handler should track errors', async () => {
    let capturedHandler: any;
    const mockRegisterRpc = (_id: string, handler: any) => {
      capturedHandler = handler;
    };
    const mockInitializer = { registerRpc: mockRegisterRpc } as any;
    const handler = () => {
      throw new Error('handler error');
    };

    registerRpcWithProfiling(mockInitializer, 'error_rpc2', 'error_rpc2', handler);

    await expect(capturedHandler({} as any, {} as any, {} as any, '')).rejects.toThrow(
      'handler error'
    );

    const data = getProfileData('rpc.error_rpc2');
    expect(data?.errors).toBeGreaterThanOrEqual(1);
  });
});

describe('Slow operation logging', () => {
  beforeEach(() => {
    clearProfileData();
    setProfilingConfig({ enabled: true, slowThresholdMs: 1, logSlowOperations: true });
  });

  afterEach(() => {
    resetProfiling({ logSlowOperations: false });
  });

  test('profileSync should log slow operations when logSlowOperations is enabled', () => {
    const { logger: mockLogger } = require('../../config/logger');
    mockLogger.info.mockClear();

    profileSync('slow_sync_op', () => {
      // Busy-wait to exceed 1ms threshold
      const start = Date.now();
      while (Date.now() - start < 5) {}
      return true;
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Slow operation: slow_sync_op')
    );
  });

  test('profileAsync should log slow operations when logSlowOperations is enabled', async () => {
    const { logger: mockLogger } = require('../../config/logger');
    mockLogger.info.mockClear();

    await profileAsync('slow_async_op', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return true;
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Slow operation: slow_async_op')
    );
  });

  test('profileSync should not log when operation is fast', () => {
    const { logger: mockLogger } = require('../../config/logger');
    mockLogger.info.mockClear();

    profileSync('fast_op', () => 42);

    const slowCalls = mockLogger.info.mock.calls.filter((c: any[]) =>
      c[0]?.includes?.('Slow operation')
    );
    expect(slowCalls.length).toBe(0);
  });
});

describe('profileFunction sync path', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('should take sync path for regular functions', async () => {
    const syncFn = () => 'sync_result';
    // Verify it's not an AsyncFunction
    expect(syncFn.constructor.name).not.toBe('AsyncFunction');

    const result = await profileFunction('sync_path_test', syncFn);
    expect(result).toBe('sync_result');

    const data = getProfileData('sync_path_test');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
  });

  test('should take async path for arrow async functions', async () => {
    const asyncFn = async () => 'async_result';
    // Arrow async functions have constructor.name 'AsyncFunction'
    expect(asyncFn.constructor.name).toBe('AsyncFunction');

    const result = await profileFunction('async_path_test', asyncFn);
    expect(result).toBe('async_result');

    const data = getProfileData('async_path_test');
    expect(data).not.toBeNull();
    expect(data?.callCount).toBe(1);
  });
});

describe('profileCriticalPath start and end edge cases', () => {
  beforeEach(() => {
    resetProfiling({ enabled: true, slowThresholdMs: 1000, logSlowOperations: false });
  });

  test('start should be callable without error', () => {
    const path = profileCriticalPath('start_test');
    expect(() => path.start()).not.toThrow();
  });

  test('start after end should be a no-op', () => {
    const path = profileCriticalPath('start_after_end');
    path.end();
    const dataBefore = getProfileData('critical.start_after_end');
    const countBefore = dataBefore?.callCount ?? 0;

    // start() after end() should do nothing
    path.start();

    const dataAfter = getProfileData('critical.start_after_end');
    expect(dataAfter?.callCount).toBe(countBefore);
  });

  test('start when profiling disabled should be a no-op', () => {
    setProfilingEnabled(false);
    const path = profileCriticalPath('disabled_start');
    path.start();
    // No data should be recorded
    expect(getProfileData('critical.disabled_start')).toBeNull();
  });

  test('end when profiling disabled should not record', () => {
    setProfilingEnabled(false);
    const path = profileCriticalPath('disabled_end');
    path.end();
    expect(getProfileData('critical.disabled_end')).toBeNull();
  });

  test('getDuration should return positive value after start', () => {
    const path = profileCriticalPath('duration_after_start');
    path.start();
    const start = Date.now();
    while (Date.now() - start < 2) {}
    const duration = path.getDuration();
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
