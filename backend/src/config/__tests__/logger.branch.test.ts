import { logRpcEntry, logRpcExit, logRpcError } from '../logger';
import { captureRpcError } from '../errorTracking';

describe('logger branch coverage', () => {
  it('logRpcEntry executes without error', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123', { foo: 'bar' })).not.toThrow();
  });

  it('logRpcEntry with null payload executes without error', () => {
    expect(() => logRpcEntry('test_rpc', 'user-1', 'req-123', null)).not.toThrow();
  });

  it('logRpcExit executes without error', () => {
    expect(() => logRpcExit('test_rpc', 'user-1', 'req-123', 123)).not.toThrow();
  });

  it('logRpcError executes without error', () => {
    const error = new Error('fail');
    expect(() => logRpcError('test_rpc', 'user-1', 'req-123', error, 456)).not.toThrow();
  });

  it('logRpcError with empty message executes without error', () => {
    const error = new Error('');
    expect(() => logRpcError('test_rpc', 'user-1', 'req-123', error, 1)).not.toThrow();
  });

  it('captureRpcError executes without error', () => {
    const error = new Error('test');
    expect(() => captureRpcError('test_rpc', 'user-1', error, '{}')).not.toThrow();
  });
});
