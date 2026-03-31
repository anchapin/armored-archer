import {
  initializeDataDog,
  getDataDogClient,
  sendRpcMetricsToDataDog,
  sendPlayerMetricsToDataDog,
  sendMatchMetricsToDataDog,
  sendEconomyMetricsToDataDog,
  sendHealthMetricsToDataDog,
  isDataDogEnabled,
  getDataDogConfig,
} from '../../src/modules/datadog_integration';

// Mock dependencies
jest.mock('../../src/config', () => ({
  config: {
    datadog: {
      enabled: false,
      port: 8125,
      prefix: 'armed_archer',
      tags: {
        environment: 'test',
      },
    },
    environment: 'test',
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('datadog_integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeDataDog', () => {
    it('should not initialize when disabled', () => {
      initializeDataDog();

      expect(isDataDogEnabled()).toBe(false);
    });

    it('should initialize with config when enabled', () => {
      jest.doMock('../config', () => ({
        config: {
          datadog: {
            enabled: true,
            host: 'localhost',
            port: 8125,
            prefix: 'test_prefix',
            tags: { environment: 'test' },
          },
          environment: 'test',
        },
      }));

      initializeDataDog();

      expect(isDataDogEnabled()).toBe(true);
      const config = getDataDogConfig();
      expect(config.enabled).toBe(true);
    });
  });

  describe('getDataDogClient', () => {
    it('should return null when not initialized', () => {
      const client = getDataDogClient();
      expect(client).toBeNull();
    });
  });

  describe('sendRpcMetricsToDataDog', () => {
    it('should not send when client not initialized', () => {
      expect(() => sendRpcMetricsToDataDog('test_rpc', 100, true)).not.toThrow();
    });
  });

  describe('sendPlayerMetricsToDataDog', () => {
    it('should not send when client not initialized', () => {
      expect(() => sendPlayerMetricsToDataDog(10)).not.toThrow();
    });
  });

  describe('sendMatchMetricsToDataDog', () => {
    it('should not send when client not initialized', () => {
      expect(() => sendMatchMetricsToDataDog('pvp', 5, 1000)).not.toThrow();
    });
  });

  describe('sendEconomyMetricsToDataDog', () => {
    it('should not send when client not initialized', () => {
      expect(() => sendEconomyMetricsToDataDog('gems', 99, 'USD', true)).not.toThrow();
    });
  });

  describe('sendHealthMetricsToDataDog', () => {
    it('should not send when client not initialized', () => {
      expect(() => sendHealthMetricsToDataDog(true, 50, 60)).not.toThrow();
    });
  });

  describe('isDataDogEnabled', () => {
    it('should return false when not initialized', () => {
      expect(isDataDogEnabled()).toBe(false);
    });
  });

  describe('getDataDogConfig', () => {
    it('should return config copy', () => {
      const config = getDataDogConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });
});
