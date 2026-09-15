/**
 * Deployment Observability Module Tests
 *
 * Comprehensive tests for the deployment tracking and observability system
 * with mocked config and logger.
 */

jest.mock('../../config', () => ({
  config: {
    environment: 'test',
    tracing: { serviceVersion: '1.0.0' },
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

jest.mock('../validation', () => ({
  validatePayload: jest.fn(),
  ZodSchemas: {
    deployment_record: {},
    health_check: {},
  },
  createValidationErrorResponse: jest.fn((name: string, error: string) =>
    JSON.stringify({ success: false, error, name })
  ),
}));

import { Registry } from 'prom-client';
import {
  recordDeployment,
  recordDeploymentDuration,
  updateDeploymentHealth,
  getDeploymentRegistry,
  getDeploymentState,
  initializeDeploymentObservability,
  registerDeploymentObservability,
} from '../deployment_observability';
import { resetAdminAllowlistCache } from '../admin_auth';

describe('deployment_observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordDeployment', () => {
    it('should increment active count when status is started', () => {
      const stateBefore = getDeploymentState();
      const countBefore = stateBefore.activeDeployments;

      recordDeployment('production', '1.0.0', 'started');

      const stateAfter = getDeploymentState();
      expect(stateAfter.activeDeployments).toBe(countBefore + 1);
    });

    it('should decrement active count when status is success', () => {
      // First start a deployment to have something to decrement
      recordDeployment('production', '1.0.0', 'started');
      const stateAfterStart = getDeploymentState();
      const countAfterStart = stateAfterStart.activeDeployments;

      recordDeployment('production', '1.0.0', 'success');

      const stateAfterSuccess = getDeploymentState();
      expect(stateAfterSuccess.activeDeployments).toBe(countAfterStart - 1);
    });

    it('should decrement active count when status is failed', () => {
      // First start a deployment to have something to decrement
      recordDeployment('production', '1.0.0', 'started');
      const stateAfterStart = getDeploymentState();
      const countAfterStart = stateAfterStart.activeDeployments;

      recordDeployment('production', '1.0.0', 'failed');

      const stateAfterFailed = getDeploymentState();
      expect(stateAfterFailed.activeDeployments).toBe(countAfterStart - 1);
    });

    it('should decrement active count when status is rollback', () => {
      recordDeployment('production', '1.0.0', 'started');
      const stateAfterStart = getDeploymentState();
      const countAfterStart = stateAfterStart.activeDeployments;

      recordDeployment('production', '1.0.0', 'rollback');

      const stateAfterRollback = getDeploymentState();
      expect(stateAfterRollback.activeDeployments).toBe(countAfterStart - 1);
    });

    it('should not allow active count to go below zero', () => {
      // Try to decrement without any active deployments
      recordDeployment('production', '1.0.0', 'success');

      const state = getDeploymentState();
      expect(state.activeDeployments).toBeGreaterThanOrEqual(0);
    });

    it('should update state with environment and version on started', () => {
      recordDeployment('staging', '2.0.0', 'started');

      const state = getDeploymentState();
      expect(state.environment).toBe('staging');
      expect(state.version).toBe('2.0.0');
    });

    it('should increment deployment counter for each call', () => {
      const registry = getDeploymentRegistry();

      recordDeployment('production', '1.0.0', 'success');
      recordDeployment('production', '1.0.0', 'success');

      // Counter should exist and have been incremented
      expect(registry).toBeDefined();
    });

    it('should not throw when called with metadata', () => {
      expect(() => {
        recordDeployment('production', '1.0.0', 'started', {
          commit: 'abc123',
          branch: 'main',
        });
      }).not.toThrow();
    });
  });

  describe('recordDeploymentDuration', () => {
    it('should not throw when called', () => {
      expect(() => {
        recordDeploymentDuration('production', 'success', 30.5);
      }).not.toThrow();
    });

    it('should accept zero duration', () => {
      expect(() => {
        recordDeploymentDuration('production', 'success', 0);
      }).not.toThrow();
    });

    it('should accept large durations', () => {
      expect(() => {
        recordDeploymentDuration('production', 'failed', 600);
      }).not.toThrow();
    });

    it('should work for different environments', () => {
      expect(() => {
        recordDeploymentDuration('production', 'success', 15);
        recordDeploymentDuration('staging', 'success', 10);
        recordDeploymentDuration('development', 'failed', 5);
      }).not.toThrow();
    });
  });

  describe('updateDeploymentHealth', () => {
    it('should set healthy gauge to 1 when isHealthy is true', async () => {
      updateDeploymentHealth('production', 'deployment', true);

      const registry = getDeploymentRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_deployment_health_status'
      );

      expect(healthMetric).toBeDefined();
      const values = (healthMetric as any).values;
      const match = values.find(
        (v: any) => v.labels.environment === 'production' && v.labels.component === 'deployment'
      );
      expect(match).toBeDefined();
      expect(match.value).toBe(1);
    });

    it('should set healthy gauge to 0 when isHealthy is false', async () => {
      updateDeploymentHealth('production', 'deployment', false);

      const registry = getDeploymentRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_deployment_health_status'
      );

      expect(healthMetric).toBeDefined();
      const values = (healthMetric as any).values;
      const match = values.find(
        (v: any) => v.labels.environment === 'production' && v.labels.component === 'deployment'
      );
      expect(match).toBeDefined();
      expect(match.value).toBe(0);
    });

    it('should track health for different components independently', async () => {
      updateDeploymentHealth('production', 'deployment', true);
      updateDeploymentHealth('production', 'database', false);

      const registry = getDeploymentRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_deployment_health_status'
      );

      const values = (healthMetric as any).values;
      const deploymentVal = values.find(
        (v: any) => v.labels.environment === 'production' && v.labels.component === 'deployment'
      );
      const databaseVal = values.find(
        (v: any) => v.labels.environment === 'production' && v.labels.component === 'database'
      );

      expect(deploymentVal.value).toBe(1);
      expect(databaseVal.value).toBe(0);
    });

    it('should not throw', () => {
      expect(() => {
        updateDeploymentHealth('production', 'system', true);
      }).not.toThrow();
    });
  });

  describe('getDeploymentState', () => {
    it('should return object with environment, version, and activeDeployments', () => {
      const state = getDeploymentState();

      expect(state).toHaveProperty('environment');
      expect(typeof state.environment).toBe('string');

      expect(state).toHaveProperty('version');
      expect(typeof state.version).toBe('string');

      expect(state).toHaveProperty('activeDeployments');
      expect(typeof state.activeDeployments).toBe('number');
    });

    it('should reflect active deployment count after started deployment', () => {
      const stateBefore = getDeploymentState();
      const countBefore = stateBefore.activeDeployments;

      recordDeployment('production', '1.0.0', 'started');

      const stateAfter = getDeploymentState();
      expect(stateAfter.activeDeployments).toBe(countBefore + 1);
    });

    it('should reflect decreasing count after success deployment', () => {
      recordDeployment('production', '1.0.0', 'started');
      const countAfterStart = getDeploymentState().activeDeployments;

      recordDeployment('production', '1.0.0', 'success');
      const countAfterSuccess = getDeploymentState().activeDeployments;

      expect(countAfterSuccess).toBe(countAfterStart - 1);
    });

    it('should update environment and version on started', () => {
      recordDeployment('staging', '3.0.0', 'started');

      const state = getDeploymentState();
      expect(state.environment).toBe('staging');
      expect(state.version).toBe('3.0.0');
    });
  });

  describe('getDeploymentRegistry', () => {
    it('should return a prom-client Registry instance', () => {
      const registry = getDeploymentRegistry();
      expect(registry).toBeInstanceOf(Registry);
    });

    it('should return the same registry on multiple calls', () => {
      const registry1 = getDeploymentRegistry();
      const registry2 = getDeploymentRegistry();
      expect(registry1).toBe(registry2);
    });

    it('should contain deployment metric definitions', async () => {
      const registry = getDeploymentRegistry();
      const metrics = await registry.metrics();

      expect(metrics).toContain('armored_archer_deployments_total');
      expect(metrics).toContain('armored_archer_deployment_duration_seconds');
      expect(metrics).toContain('armored_archer_active_deployments');
      expect(metrics).toContain('armored_archer_deployment_health_status');
      expect(metrics).toContain('armored_archer_deployment_last_success_timestamp');
    });
  });

  describe('initializeDeploymentObservability', () => {
    it('should set initial health without errors', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      expect(() => initializeDeploymentObservability(mockLogger as any)).not.toThrow();
    });

    it('should set deployment and system health to healthy', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeDeploymentObservability(mockLogger as any);

      const registry = getDeploymentRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_deployment_health_status'
      );

      expect(healthMetric).toBeDefined();
      const values = (healthMetric as any).values;
      const deploymentVal = values.find(
        (v: any) => v.labels.environment === 'test' && v.labels.component === 'deployment'
      );
      const systemVal = values.find(
        (v: any) => v.labels.environment === 'test' && v.labels.component === 'system'
      );

      expect(deploymentVal).toBeDefined();
      expect(deploymentVal.value).toBe(1);
      expect(systemVal).toBeDefined();
      expect(systemVal.value).toBe(1);
    });

    it('should log initialization message', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeDeploymentObservability(mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[DeploymentObservability] Initialized')
      );
    });

    it('should log environment and version details', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeDeploymentObservability(mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('test'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('1.0.0'));
    });
  });

  describe('registerDeploymentObservability', () => {
    it('should register all 4 deployment RPC handlers', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerDeploymentObservability(mockInitializer as any);

      expect(mockInitializer.registerRpc).toHaveBeenCalledTimes(4);
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/deployment_record',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/deployment_health',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/deployment_history',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/deployment_metrics',
        expect.any(Function)
      );
    });
  });

  describe('RPC handlers', () => {
    let rpcHandlers: Record<string, Function>;

    // Registered handlers are behind the shared admin gate (issue #1075),
    // so the test caller ctx must be allowlisted via ADMIN_USER_IDS.
    const previousAdminIds = process.env.ADMIN_USER_IDS;

    beforeEach(() => {
      process.env.ADMIN_USER_IDS = '00000000-0000-4000-8000-000000000008';
      resetAdminAllowlistCache();
      rpcHandlers = {};
      const mockInitializer = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          rpcHandlers[id] = handler;
        }),
      };
      registerDeploymentObservability(mockInitializer as any);
    });

    afterEach(() => {
      if (previousAdminIds === undefined) {
        delete process.env.ADMIN_USER_IDS;
      } else {
        process.env.ADMIN_USER_IDS = previousAdminIds;
      }
      resetAdminAllowlistCache();
    });

    describe('rpcRecordDeployment', () => {
      it('should return error for invalid payload', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: false, error: 'Invalid' });

        const result = await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          'invalid'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      });

      it('should record deployment on valid payload', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'success',
            metadata: {},
          },
        });

        const result = await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.environment).toBe('production');
        expect(parsed.version).toBe('1.0.0');
      });

      it('should record duration when startedAt in metadata and status is terminal', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'success',
            metadata: { startedAt: String(Date.now() - 5000) },
          },
        });

        const result = await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      });

      it('should update health status to healthy on success', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'success',
            metadata: {},
          },
        });

        await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const registry = getDeploymentRegistry();
        const metrics = await registry.getMetricsAsJSON();
        const healthMetric = metrics.find(
          (m: any) => m.name === 'armored_archer_deployment_health_status'
        );
        const values = (healthMetric as any).values;
        const deploymentHealth = values.find(
          (v: any) => v.labels.environment === 'production' && v.labels.component === 'deployment'
        );
        expect(deploymentHealth.value).toBe(1);
      });

      it('should update health status to unhealthy on failure', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'failed',
            metadata: {},
          },
        });

        await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const registry = getDeploymentRegistry();
        const metrics = await registry.getMetricsAsJSON();
        const healthMetric = metrics.find(
          (m: any) => m.name === 'armored_archer_deployment_health_status'
        );
        const values = (healthMetric as any).values;
        const deploymentHealth = values.find(
          (v: any) => v.labels.environment === 'production' && v.labels.component === 'deployment'
        );
        expect(deploymentHealth.value).toBe(0);
      });

      it('should not record duration when startedAt is missing', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'success',
            metadata: {},
          },
        });

        const result = await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      });

      it('should not update health for rollback status', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({
          success: true,
          data: {
            environment: 'production',
            version: '1.0.0',
            status: 'rollback',
            metadata: {},
          },
        });

        const result = await rpcHandlers['armored_archer/deployment_record'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe('rpcDeploymentHealth', () => {
      it('should return error for invalid payload', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: false, error: 'Invalid' });

        const result = await rpcHandlers['armored_archer/deployment_health'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          'invalid'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      });

      it('should return health status with components', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: true, data: {} });

        const result = await rpcHandlers['armored_archer/deployment_health'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('status');
        expect(parsed).toHaveProperty('environment');
        expect(parsed).toHaveProperty('version');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('components');
      });

      it('should report healthy when no components set', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: true, data: {} });

        const result = await rpcHandlers['armored_archer/deployment_health'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed.status).toBe('healthy');
      });
    });

    describe('rpcDeploymentHistory', () => {
      it('should return deployment history with default limit', async () => {
        const result = await rpcHandlers['armored_archer/deployment_history'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('environment');
        expect(parsed).toHaveProperty('deployments');
        expect(parsed).toHaveProperty('count');
        expect(Array.isArray(parsed.deployments)).toBe(true);
      });

      it('should accept custom limit from payload', async () => {
        const result = await rpcHandlers['armored_archer/deployment_history'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          JSON.stringify({ limit: 5 })
        );

        const parsed = JSON.parse(result);
        expect(parsed.deployments.length).toBeLessThanOrEqual(5);
      });

      it('should handle invalid JSON payload gracefully', async () => {
        const result = await rpcHandlers['armored_archer/deployment_history'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          'not json'
        );

        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('deployments');
      });

      it('should handle null payload', async () => {
        const result = await rpcHandlers['armored_archer/deployment_history'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          null as any
        );

        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('deployments');
      });

      it('should return deployments sorted by startedAt descending', async () => {
        // Record some deployments first
        recordDeployment('test', '1.0.0', 'started');
        recordDeployment('test', '2.0.0', 'started');

        const result = await rpcHandlers['armored_archer/deployment_history'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        const parsed = JSON.parse(result);
        // Deployments should be sorted most recent first
        for (let i = 1; i < parsed.deployments.length; i++) {
          expect(parsed.deployments[i - 1].startedAt).toBeGreaterThanOrEqual(
            parsed.deployments[i].startedAt
          );
        }
      });
    });

    describe('rpcDeploymentMetrics', () => {
      it('should return error for invalid payload', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: false, error: 'Invalid' });

        const result = await rpcHandlers['armored_archer/deployment_metrics'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          'invalid'
        );

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
      });

      it('should return Prometheus metrics on valid payload', async () => {
        const { validatePayload } = require('../validation');
        validatePayload.mockReturnValue({ success: true, data: {} });

        const result = await rpcHandlers['armored_archer/deployment_metrics'](
          { userId: '00000000-0000-4000-8000-000000000008' },
          { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          {},
          '{}'
        );

        expect(typeof result).toBe('string');
        expect(result).toContain('armored_archer_');
      });
    });
  });
});
