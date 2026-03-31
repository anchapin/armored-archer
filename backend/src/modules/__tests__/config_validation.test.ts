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
    it('should log warning for invalid server port', () => {
      const mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
      };

      // Set invalid port
      jest.doMock('../../config', () => ({
        config: {
          server: {
            port: 0,
            consolePort: 7351,
          },
        },
      }));

      // Need to reimport after mock change
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

    it('should log warning for invalid console port', () => {
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
  });
});
