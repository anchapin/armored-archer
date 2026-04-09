import {
  profileSync,
  profileAsync,
  profileFunction,
  createProfileBlock,
  setProfilingConfig,
  getProfilingConfig,
  setProfilingEnabled,
  isProfilingEnabled,
  getProfileData,
  getAllProfileData,
  getProfileReport,
  getFormattedProfileReport,
  clearProfileData,
  resetProfiling,
  wrapRpcWithProfiling,
  registerRpcWithProfiling,
  initializeProfiling,
  logProfileReport,
  profileCriticalPath,
  profileMethod,
} from '../../src/modules/profiling';

describe('profiling', () => {
  beforeEach(() => {
    // Reset profiling state
    resetProfiling({ enabled: true, slowThresholdMs: 100, logSlowOperations: false });
  });

  afterEach(() => {
    clearProfileData();
  });

  describe('configuration', () => {
    it('should have default config disabled', () => {
      resetProfiling({ enabled: false });
      expect(isProfilingEnabled()).toBe(false);
    });

    it('should enable profiling', () => {
      setProfilingEnabled(true);
      expect(isProfilingEnabled()).toBe(true);
    });

    it('should disable profiling', () => {
      setProfilingEnabled(false);
      expect(isProfilingEnabled()).toBe(false);
    });

    it('should get profiling config', () => {
      const config = getProfilingConfig();
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.slowThresholdMs).toBe(100);
    });

    it('should update profiling config', () => {
      setProfilingConfig({ slowThresholdMs: 500 });
      const config = getProfilingConfig();
      expect(config.slowThresholdMs).toBe(500);
    });
  });

  describe('profileSync', () => {
    it('should execute function and return result when profiling disabled', () => {
      setProfilingEnabled(false);
      const result = profileSync('test_sync', () => 'result');
      expect(result).toBe('result');
    });

    it('should execute function when profiling enabled', () => {
      setProfilingEnabled(true);
      const result = profileSync('test_sync', () => 'result');
      expect(result).toBe('result');
    });

    it('should record profile data', () => {
      setProfilingEnabled(true);
      profileSync('test_op', () => {
        // Simple operation
      });

      const data = getProfileData('test_op');
      expect(data).not.toBeNull();
      expect(data?.callCount).toBe(1);
    });

    it('should handle errors and still record', () => {
      setProfilingEnabled(true);
      expect(() => {
        profileSync('test_error', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      const data = getProfileData('test_error');
      expect(data?.errors).toBe(1);
    });

    it('should measure duration', () => {
      setProfilingEnabled(true);
      profileSync('test_duration', () => {
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for ~10ms
        }
      });

      const data = getProfileData('test_duration');
      expect(data?.totalTimeMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe('profileAsync', () => {
    it('should execute async function when profiling disabled', async () => {
      setProfilingEnabled(false);
      const result = await profileAsync('test_async', async () => 'result');
      expect(result).toBe('result');
    });

    it('should execute async function when profiling enabled', async () => {
      setProfilingEnabled(true);
      const result = await profileAsync('test_async', async () => 'result');
      expect(result).toBe('result');
    });

    it('should record profile data for async function', async () => {
      setProfilingEnabled(true);
      await profileAsync('test_async_op', async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      const data = getProfileData('test_async_op');
      expect(data?.callCount).toBe(1);
    });

    it('should handle async errors', async () => {
      setProfilingEnabled(true);
      await expect(
        profileAsync('test_async_error', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');

      const data = getProfileData('test_async_error');
      expect(data?.errors).toBe(1);
    });
  });

  describe('profileFunction', () => {
    it('should detect and run sync function', async () => {
      setProfilingEnabled(true);
      const result = await profileFunction('test_fn_sync', () => 'sync_result');
      expect(result).toBe('sync_result');
    });

    it('should detect and run async function', async () => {
      setProfilingEnabled(true);
      const result = await profileFunction('test_fn_async', async () => 'async_result');
      expect(result).toBe('async_result');
    });

    it('should skip profiling when disabled', async () => {
      setProfilingEnabled(false);
      const result = await profileFunction('test_fn_disabled', () => 'result');
      expect(result).toBe('result');
      expect(getProfileData('test_fn_disabled')).toBeNull();
    });
  });

  describe('createProfileBlock', () => {
    it('should return end and getDuration functions', () => {
      setProfilingEnabled(true);
      const block = createProfileBlock('test_block');
      expect(block.end).toBeDefined();
      expect(block.getDuration).toBeDefined();
      expect(typeof block.end).toBe('function');
      expect(typeof block.getDuration).toBe('function');
    });

    it('should record data when end is called', () => {
      setProfilingEnabled(true);
      const block = createProfileBlock('test_block_record');
      block.end();

      const data = getProfileData('test_block_record');
      expect(data?.callCount).toBe(1);
    });

    it('should return duration', () => {
      setProfilingEnabled(true);
      const block = createProfileBlock('test_block_duration');
      const duration = block.getDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should not record when profiling disabled', () => {
      setProfilingEnabled(false);
      const block = createProfileBlock('test_block_disabled');
      block.end();

      expect(getProfileData('test_block_disabled')).toBeNull();
    });
  });

  describe('getProfileData', () => {
    it('should return null for non-existent profile', () => {
      expect(getProfileData('nonexistent')).toBeNull();
    });

    it('should return profile data for existing profile', () => {
      setProfilingEnabled(true);
      profileSync('existing_profile', () => {});

      const data = getProfileData('existing_profile');
      expect(data).not.toBeNull();
      expect(data?.callCount).toBe(1);
    });
  });

  describe('getAllProfileData', () => {
    it('should return empty map initially', () => {
      const allData = getAllProfileData();
      expect(allData.size).toBe(0);
    });

    it('should return all profile data', () => {
      setProfilingEnabled(true);
      profileSync('profile_1', () => {});
      profileSync('profile_2', () => {});

      const allData = getAllProfileData();
      expect(allData.size).toBe(2);
    });

    it('should return a copy, not the original', () => {
      setProfilingEnabled(true);
      profileSync('copy_test', () => {});

      const allData = getAllProfileData();
      allData.clear();

      const newData = getAllProfileData();
      expect(newData.size).toBe(1);
    });
  });

  describe('getProfileReport', () => {
    it('should return empty array when no data', () => {
      const report = getProfileReport();
      expect(report).toEqual([]);
    });

    it('should return report sorted by total time', () => {
      setProfilingEnabled(true);
      profileSync('slow_op', () => {
        const start = Date.now();
        while (Date.now() - start < 20) {}
      });
      profileSync('fast_op', () => {});

      const report = getProfileReport();
      expect(report.length).toBe(2);
      expect(report[0].name).toBe('slow_op');
      expect(report[0].totalTimeMs).toBeGreaterThan(report[1].totalTimeMs);
    });

    it('should calculate average time', () => {
      setProfilingEnabled(true);
      profileSync('avg_op', () => {});
      profileSync('avg_op', () => {});

      const report = getProfileReport();
      const avgOp = report.find((r) => r.name === 'avg_op');
      expect(avgOp?.avgTimeMs).toBeGreaterThan(0);
    });

    it('should calculate error rate', () => {
      setProfilingEnabled(true);
      profileSync('error_rate_op', () => {});

      try {
        profileSync('error_rate_op', () => {
          throw new Error('Error');
        });
      } catch (e) {}

      const report = getProfileReport();
      const errorOp = report.find((r) => r.name === 'error_rate_op');
      expect(errorOp?.errorRate).toBe(0.5);
    });
  });

  describe('getFormattedProfileReport', () => {
    it('should return message when no data', () => {
      const report = getFormattedProfileReport();
      expect(report).toContain('No profiling data');
    });

    it('should return formatted report', () => {
      setProfilingEnabled(true);
      profileSync('formatted_op', () => {});

      const report = getFormattedProfileReport();
      expect(report).toContain('Profiling Report');
      expect(report).toContain('formatted_op');
    });
  });

  describe('clearProfileData', () => {
    it('should clear all profile data', () => {
      setProfilingEnabled(true);
      profileSync('clear_test', () => {});

      clearProfileData();

      expect(getProfileData('clear_test')).toBeNull();
      expect(getAllProfileData().size).toBe(0);
    });
  });

  describe('resetProfiling', () => {
    it('should clear data and update config', () => {
      setProfilingEnabled(true);
      profileSync('reset_test', () => {});

      resetProfiling({ slowThresholdMs: 200 });

      expect(getProfileData('reset_test')).toBeNull();
      expect(getProfilingConfig().slowThresholdMs).toBe(200);
    });
  });

  describe('wrapRpcWithProfiling', () => {
    it('should wrap RPC handler with profiling', async () => {
      setProfilingEnabled(true);

      const mockHandler = jest.fn().mockReturnValue('{"success": true}');
      const wrappedHandler = wrapRpcWithProfiling('test_rpc', mockHandler);

      const ctx = { userId: 'user123' };
      const logger = { info: jest.fn() };
      const nk = {};

      const result = await wrappedHandler(ctx as any, logger as any, nk as any, '{}');

      expect(mockHandler).toHaveBeenCalled();
      expect(result).toBe('{"success": true}');
      expect(getProfileData('rpc.test_rpc')).not.toBeNull();
    });

    it('should record errors in profile', async () => {
      setProfilingEnabled(true);

      const mockHandler = jest.fn().mockRejectedValue(new Error('RPC Error'));
      const wrappedHandler = wrapRpcWithProfiling('error_rpc', mockHandler);

      const ctx = { userId: 'user123' };
      const logger = { info: jest.fn(), error: jest.fn() };
      const nk = {};

      await expect(wrappedHandler(ctx as any, logger as any, nk as any, '{}')).rejects.toThrow(
        'RPC Error'
      );

      const data = getProfileData('rpc.error_rpc');
      expect(data?.errors).toBe(1);
    });
  });

  describe('registerRpcWithProfiling', () => {
    it('should register RPC with profiling wrapper', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      const handler = () => 'result';
      registerRpcWithProfiling(mockInitializer as any, 'test_rpc', 'test', handler);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith('test_rpc', expect.any(Function));
    });
  });

  describe('initializeProfiling', () => {
    it('should initialize without error', () => {
      expect(() => initializeProfiling()).not.toThrow();
    });
  });

  describe('logProfileReport', () => {
    it('should log report without error', () => {
      setProfilingEnabled(true);
      profileSync('log_test', () => {});

      expect(() => logProfileReport()).not.toThrow();
    });
  });

  describe('profileCriticalPath', () => {
    it('should return start, end, and getDuration functions', () => {
      setProfilingEnabled(true);
      const profile = profileCriticalPath('critical_path');

      expect(profile.start).toBeDefined();
      expect(profile.end).toBeDefined();
      expect(profile.getDuration).toBeDefined();
    });

    it('should record when end is called', () => {
      setProfilingEnabled(true);
      const profile = profileCriticalPath('critical_record');
      profile.end();

      expect(getProfileData('critical.critical_record')).not.toBeNull();
    });

    it('should not record when disabled', () => {
      setProfilingEnabled(false);
      const profile = profileCriticalPath('critical_disabled');
      profile.end();

      expect(getProfileData('critical.critical_disabled')).toBeNull();
    });
  });

  describe('profileMethod decorator', () => {
    it('should return a decorator function', () => {
      const decorator = profileMethod('decorated_method');
      expect(typeof decorator).toBe('function');
    });
  });
});
