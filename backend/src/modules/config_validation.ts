import { Runtime } from '../types/nakama';
import { config } from '../config';

export function validateConfiguration(logger: Runtime.Logger): void {
  if (config.server.port < 1 || config.server.port > 65535) {
    logger.warn('Invalid server port: %d', config.server.port);
  }
  if (config.server.consolePort < 1 || config.server.consolePort > 65535) {
    logger.warn('Invalid console port: %d', config.server.consolePort);
  }
  logger.info('Configuration validated successfully');
}
