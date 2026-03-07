/**
 * Deployment Observability Tests
 *
 * These tests verify that the deployment observability module works correctly.
 */

import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';
import {
  registerDeploymentObservability,
  recordDeployment,
  recordDeploymentDuration,
  updateDeploymentHealth,
  getDeploymentRegistry,
  getDeploymentState,
} from '../deployment_observability';

describe('Deployment Observability', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'deployment-test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('registerDeploymentObservability', () => {
    it('should register deployment RPC endpoints', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerDeploymentObservability(mockInitializer);

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

  describe('recordDeployment', () => {
    it('should record a deployment event', () => {
      expect(() => {
        recordDeployment('production', '1.0.0', 'success');
      }).not.toThrow();
    });

    it('should record deployment with metadata', () => {
      expect(() => {
        recordDeployment('staging', '1.0.0', 'started', { startedAt: Date.now().toString() });
      }).not.toThrow();
    });
  });

  describe('recordDeploymentDuration', () => {
    it('should record deployment duration', () => {
      expect(() => {
        recordDeploymentDuration('production', 'success', 30.5);
      }).not.toThrow();
    });
  });

  describe('updateDeploymentHealth', () => {
    it('should update deployment health status', () => {
      expect(() => {
        updateDeploymentHealth('production', 'deployment', true);
      }).not.toThrow();

      expect(() => {
        updateDeploymentHealth('production', 'deployment', false);
      }).not.toThrow();
    });
  });

  describe('getDeploymentRegistry', () => {
    it('should return a Prometheus registry', () => {
      const registry = getDeploymentRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('getDeploymentState', () => {
    it('should return current deployment state', () => {
      const state = getDeploymentState();
      expect(state).toHaveProperty('environment');
      expect(state).toHaveProperty('version');
      expect(state).toHaveProperty('activeDeployments');
    });
  });
});

describe('Deployment Metrics', () => {
  describe('Prometheus Metrics', () => {
    it('should have deployment metrics defined', async () => {
      const registry = getDeploymentRegistry();
      const metrics = await registry.metrics();

      // Check that metrics contain deployment-related metrics
      expect(metrics).toContain('armored_archer_deployments_total');
      expect(metrics).toContain('armored_archer_deployment_duration_seconds');
      expect(metrics).toContain('armored_archer_active_deployments');
      expect(metrics).toContain('armored_archer_deployment_health_status');
    });
  });
});

describe('Deployment RPC Validation', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;
  let initializer: Runtime.Initializer;
  let registeredRpcs: Map<string, Function>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    registeredRpcs = new Map();

    initializer = {
      registerRpc: (rpcId: string, handler: Function) => {
        registeredRpcs.set(rpcId, handler);
      },
    } as unknown as Runtime.Initializer;

    registerDeploymentObservability(initializer);
  });

  describe('deployment_record RPC', () => {
    it('should be registered', () => {
      expect(registeredRpcs.has('armored_archer/deployment_record')).toBe(true);
    });

    it('should validate deployment payload', async () => {
      const handler = registeredRpcs.get('armored_archer/deployment_record');
      const payload = JSON.stringify({
        environment: 'production',
        version: '1.0.0',
        status: 'success',
      });

      const result = await handler(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should reject invalid status', async () => {
      const handler = registeredRpcs.get('armored_archer/deployment_record');
      const payload = JSON.stringify({
        environment: 'production',
        version: '1.0.0',
        status: 'invalid_status',
      });

      const result = await handler(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });
  });

  describe('deployment_health RPC', () => {
    it('should be registered', () => {
      expect(registeredRpcs.has('armored_archer/deployment_health')).toBe(true);
    });

    it('should return health status', async () => {
      const handler = registeredRpcs.get('armored_archer/deployment_health');
      const payload = JSON.stringify({});

      const result = await handler(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBeDefined();
      expect(parsed.environment).toBeDefined();
      expect(parsed.version).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('deployment_history RPC', () => {
    it('should be registered', () => {
      expect(registeredRpcs.has('armored_archer/deployment_history')).toBe(true);
    });

    it('should return deployment history', async () => {
      const handler = registeredRpcs.get('armored_archer/deployment_history');
      const payload = JSON.stringify({});

      const result = await handler(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.environment).toBeDefined();
      expect(parsed.version).toBeDefined();
      expect(parsed.deployments).toBeDefined();
      expect(parsed.count).toBeDefined();
    });
  });

  describe('deployment_metrics RPC', () => {
    it('should be registered', () => {
      expect(registeredRpcs.has('armored_archer/deployment_metrics')).toBe(true);
    });

    it('should return metrics in Prometheus format', async () => {
      const handler = registeredRpcs.get('armored_archer/deployment_metrics');
      const payload = JSON.stringify({});

      const result = await handler(mockCtx, mockLogger, mockNk, payload);

      expect(result).toContain('armored_archer_deployments_total');
      expect(result).toContain('armored_archer_deployment_duration_seconds');
    });
  });
});
