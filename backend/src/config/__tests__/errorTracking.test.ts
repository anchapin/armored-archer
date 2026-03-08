/**
 * Error Tracking Tests
 *
 * Tests for Sentry error tracking with contextual information.
 */

// Store original env
const originalEnv = { ...process.env };

// Set up test environment before importing the module
process.env.SENTRY_DSN = 'https://testkey@sentry.io/1234567';
process.env.NODE_ENV = 'test';
process.env.SENTRY_ENABLED = 'true';
process.env.SENTRY_TRACES_SAMPLE_RATE = '1.0';
process.env.SENTRY_INCLUDE_GAME_STATE = 'true';
process.env.SENTRY_INCLUDE_SESSION_CONTEXT = 'true';

const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetContext = jest.fn();
const mockSetUser = jest.fn();

jest.mock('@sentry/node', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  setContext: mockSetContext,
  setUser: mockSetUser,
  flush: jest.fn(),
}));

// Import after setting up mocks
import { errorTrackingConfig, initializeSentry, clearContext } from '../errorTracking';

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset environment
  process.env.SENTRY_DSN = 'https://testkey@sentry.io/1234567';
  process.env.NODE_ENV = 'test';
  process.env.SENTRY_ENABLED = 'true';
  process.env.SENTRY_TRACES_SAMPLE_RATE = '1.0';
  process.env.SENTRY_INCLUDE_GAME_STATE = 'true';
  process.env.SENTRY_INCLUDE_SESSION_CONTEXT = 'true';
});

afterAll(() => {
  process.env = originalEnv;
});

describe('ErrorTrackingConfig', () => {
  it('should have correct config structure', () => {
    // Note: Config is evaluated at module load time, so we test enabled state
    expect(errorTrackingConfig).toBeDefined();
    expect(errorTrackingConfig.tracesSampleRate).toBe(1.0);
    expect(errorTrackingConfig.includeGameState).toBe(true);
    expect(errorTrackingConfig.includeSessionContext).toBe(true);
  });
});

describe('initializeSentry', () => {
  it('should initialize Sentry when enabled with DSN', () => {
    // Set DSN for this test
    process.env.SENTRY_DSN = 'https://testkey@sentry.io/1234567';
    jest.resetModules();
    
    // Re-require to get fresh config
    const { initializeSentry } = require('../errorTracking');
    initializeSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://testkey@sentry.io/1234567',
        environment: 'test',
        tracesSampleRate: 1.0,
      })
    );
  });

  it('should not initialize when DSN is missing', () => {
    process.env.SENTRY_DSN = '';
    jest.resetModules();
    
    const { initializeSentry } = require('../errorTracking');
    initializeSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should not initialize when disabled', () => {
    process.env.SENTRY_ENABLED = 'false';
    jest.resetModules();
    
    const { initializeSentry } = require('../errorTracking');
    initializeSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });
});

describe('clearContext', () => {
  it('should clear all contexts', () => {
    clearContext();

    expect(mockSetContext).toHaveBeenCalledWith('session', {});
    expect(mockSetContext).toHaveBeenCalledWith('gameState', {});
    expect(mockSetContext).toHaveBeenCalledWith('request', {});
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });
});

describe('Disabled State', () => {
  beforeEach(() => {
    process.env.SENTRY_ENABLED = 'false';
    jest.resetModules();
  });

  it('should not call Sentry when disabled', () => {
    const { captureException, captureMessage, setSessionContext, setGameStateContext, clearContext } = 
      require('../errorTracking');
    
    captureException(new Error('Test error'));
    captureMessage('Test message');
    setSessionContext({ userId: 'user123' });
    setGameStateContext({ level: 5 });
    clearContext();

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockSetContext).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
  });
});
