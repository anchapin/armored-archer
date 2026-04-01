import { validateConfiguration } from '../config_validation';

// Mock config - use correct path
jest.mock('../../config', () => ({
  config: {
    server: {
      port: 7350,
      consolePort: 7351,
    },
  },
}));

describe('config_validation', () => {
  describe('validateConfiguration', () => {
    it('should log warning for invalid server port of 0', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 0,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid server port: %d', 0);
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });

    it('should log warning for server port of 65536 (above max)', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 65536,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid server port: %d', 65536);
    });

    it('should log warning for negative server port', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: -1,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid server port: %d', -1);
    });

    it('should accept server port of 1 (min valid)', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 1,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });

    it('should accept server port of 65535 (max valid)', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 65535,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });

    it('should log warning for invalid console port of 0', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: 0,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid console port: %d', 0);
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });

    it('should log warning for console port above 65535', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: 70000,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid console port: %d', 70000);
    });

    it('should log warning for negative console port', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: -100,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid console port: %d', -100);
    });

    it('should accept console port of 1 (min valid)', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: 1,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should accept console port of 65535 (max valid)', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: 65535,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should only log info for valid configuration', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 7350,
            consolePort: 7351,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });

    it('should warn for both invalid server and console ports', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 0,
            consolePort: 99999,
          },
        },
      }));

      const { validateConfiguration } = require('../config_validation');
      validateConfiguration(mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid server port: %d', 0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid console port: %d', 99999);
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration validated successfully');
    });
  });
});
