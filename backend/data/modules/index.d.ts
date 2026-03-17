import { InitModule, Runtime } from './types/nakama';
import './config';
import { StructuredLogger } from './config/structuredLogger';
/**
 * Gets the global structured logger instance.
 * Must be initialized during module startup.
 * Returns a no-op logger in test environment if not initialized.
 *
 * @returns The global StructuredLogger instance
 * @throws Error if not initialized (only in production)
 */
export declare function getStructuredLogger(): StructuredLogger;
/**
 * Check if structured logger has been initialized
 * Useful for tests that want to verify logging
 */
export declare function isStructuredLoggerInitialized(): boolean;
/**
 * Initializes the global structured logger with the Nakama runtime logger.
 *
 * @param runtimeLogger - The Nakama Runtime.Logger instance
 * @param serviceName - Name of the service
 */
export declare function initializeStructuredLogger(runtimeLogger: Runtime.Logger, serviceName?: string): void;
declare const InitModule: InitModule;
export default InitModule;
