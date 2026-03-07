/**
 * Tests for error tracking integration in metrics module.
 */

import { wrapRpcWithMetrics } from '../../modules/metrics';
import {
  captureRpcError,
  setSessionContext,
  clearContext,
  errorTrackingConfig,
} from '../../config/errorTracking';
import { Runtime } from '../../types/nakama';

// Mock the error tracking module
jest.mock('../../config/errorTracking', () => ({
  captureRpcError: jest.fn(),
  setSessionContext: jest.fn(),
  clearContext: jest.fn(),
  errorTrackingConfig: {
    enabled: true,
    includeSessionContext: true,
  },
}));

describe('Error Tracking in Metrics', () => {
  let mockHandler: jest.Mock;
  const mockCtx = {
    userId: 'test-user-123',
    sessionExpiry: 1234567890,
    env: 'development',
  } as unknown as Runtime.Context;
  const mockLogger = {} as Runtime.Logger;
  const mockNk = {} as Runtime.Nakama;

  beforeEach(() => {
    mockHandler = jest.fn();
    jest.clearAllMocks();
  });

  describe('wrapRpcWithMetrics with error tracking', () => {
    it('should set session context before handler execution', async () => {
      mockHandler.mockResolvedValue('{"success":true}');
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await wrapped(mockCtx, mockLogger, mockNk, '{}');

      expect(setSessionContext).toHaveBeenCalledWith({
        userId: 'test-user-123',
        sessionId: 'expiry:1234567890',
        serverRegion: 'development',
      });
    });

    it('should capture error with context when handler throws', async () => {
      const testError = new Error('Test error');
      mockHandler.mockRejectedValue(testError);
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await expect(wrapped(mockCtx, mockLogger, mockNk, '{}')).rejects.toThrow('Test error');

      expect(captureRpcError).toHaveBeenCalledWith(
        'test_rpc',
        'test-user-123',
        testError,
        '{}',
        expect.objectContaining({
          userId: 'test-user-123',
          sessionId: 'expiry:1234567890',
          serverRegion: 'development',
        }),
        undefined
      );
    });

    it('should clear context after handler completes', async () => {
      mockHandler.mockResolvedValue('{"success":true}');
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await wrapped(mockCtx, mockLogger, mockNk, '{}');

      expect(clearContext).toHaveBeenCalled();
    });

    it('should clear context after handler errors', async () => {
      mockHandler.mockRejectedValue(new Error('Test error'));
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await expect(wrapped(mockCtx, mockLogger, mockNk, '{}')).rejects.toThrow();

      expect(clearContext).toHaveBeenCalled();
    });

    it('should not set session context when error tracking is disabled', async () => {
      (errorTrackingConfig.enabled as boolean) = false;
      mockHandler.mockResolvedValue('{"success":true}');
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await wrapped(mockCtx, mockLogger, mockNk, '{}');

      expect(setSessionContext).not.toHaveBeenCalled();
      expect(clearContext).not.toHaveBeenCalled();

      // Restore for other tests
      (errorTrackingConfig.enabled as boolean) = true;
    });

    it('should capture error even when userId is undefined', async () => {
      const testError = new Error('Test error');
      const ctxWithoutUser = {
        userId: undefined,
        sessionId: 'session-456',
        env: 'development',
      } as unknown as Runtime.Context;
      mockHandler.mockRejectedValue(testError);
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await expect(wrapped(ctxWithoutUser, mockLogger, mockNk, '{}')).rejects.toThrow();

      expect(captureRpcError).toHaveBeenCalledWith(
        'test_rpc',
        'anonymous',
        testError,
        '{}',
        expect.objectContaining({
          userId: 'anonymous',
        }),
        undefined
      );
    });

    it('should pass payload to error capture for debugging', async () => {
      const testError = new Error('Test error');
      const payload = '{"action":"test","data":123}';
      mockHandler.mockRejectedValue(testError);
      const wrapped = wrapRpcWithMetrics('test_rpc', mockHandler);

      await expect(wrapped(mockCtx, mockLogger, mockNk, payload)).rejects.toThrow();

      expect(captureRpcError).toHaveBeenCalledWith(
        'test_rpc',
        'test-user-123',
        testError,
        payload,
        expect.anything(),
        undefined
      );
    });
  });
});
