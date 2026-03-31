import {
  ErrorCode,
  createErrorResponse,
  createSuccessResponse,
} from '../errors';
import type { ErrorResponse, SuccessResponse } from '../errors';

describe('ErrorCode enum', () => {
  test('should have authentication error codes', () => {
    expect(ErrorCode.NOT_AUTHENTICATED).toBe('NOT_AUTHENTICATED');
    expect(ErrorCode.INVALID_SESSION).toBe('INVALID_SESSION');
  });

  test('should have validation error codes', () => {
    expect(ErrorCode.INVALID_JSON).toBe('INVALID_JSON');
    expect(ErrorCode.INVALID_XP_AMOUNT).toBe('INVALID_XP_AMOUNT');
    expect(ErrorCode.INVALID_STAT_NAME).toBe('INVALID_STAT_NAME');
    expect(ErrorCode.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
    expect(ErrorCode.INVALID_DATA).toBe('INVALID_DATA');
    expect(ErrorCode.INVALID_AMOUNT).toBe('INVALID_AMOUNT');
  });

  test('should have resource error codes', () => {
    expect(ErrorCode.PLAYER_STATS_NOT_FOUND).toBe('PLAYER_STATS_NOT_FOUND');
    expect(ErrorCode.MATCH_NOT_FOUND).toBe('MATCH_NOT_FOUND');
    expect(ErrorCode.PLAYER_INVENTORY_NOT_FOUND).toBe('PLAYER_INVENTORY_NOT_FOUND');
    expect(ErrorCode.GEAR_NOT_FOUND).toBe('GEAR_NOT_FOUND');
  });

  test('should have combat error codes', () => {
    expect(ErrorCode.INVALID_COMBAT_ACTION).toBe('INVALID_COMBAT_ACTION');
    expect(ErrorCode.NOT_YOUR_TURN).toBe('NOT_YOUR_TURN');
    expect(ErrorCode.CANNOT_OWN_MATCH).toBe('CANNOT_OWN_MATCH');
  });

  test('should have system error codes', () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
  });
});

describe('createErrorResponse', () => {
  test('should create valid JSON error response', () => {
    const result = createErrorResponse(ErrorCode.INVALID_DATA, 'Invalid input');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe('INVALID_DATA');
    expect(parsed.error.message).toBe('Invalid input');
  });

  test('should include timestamp', () => {
    const before = Date.now();
    const result = createErrorResponse(ErrorCode.TIMEOUT, 'Request timed out');
    const after = Date.now();
    const parsed = JSON.parse(result);
    expect(parsed.error.timestamp).toBeGreaterThanOrEqual(before);
    expect(parsed.error.timestamp).toBeLessThanOrEqual(after);
  });

  test('should include optional details', () => {
    const details = { field: 'email', value: 'invalid' };
    const result = createErrorResponse(ErrorCode.INVALID_DATA, 'Bad email', details);
    const parsed = JSON.parse(result);
    expect(parsed.error.details).toEqual(details);
  });

  test('should handle undefined details', () => {
    const result = createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Something broke');
    const parsed = JSON.parse(result);
    expect(parsed.error.details).toBeUndefined();
  });

  test('should handle complex details objects', () => {
    const details = {
      errors: ['field1 required', 'field2 invalid'],
      path: '/api/player/stats',
      method: 'POST',
    };
    const result = createErrorResponse(ErrorCode.MISSING_REQUIRED_FIELD, 'Validation failed', details);
    const parsed = JSON.parse(result);
    expect(parsed.error.details).toEqual(details);
  });

  test('should return string type', () => {
    const result = createErrorResponse(ErrorCode.NOT_AUTHENTICATED, 'Not logged in');
    expect(typeof result).toBe('string');
  });
});

describe('createSuccessResponse', () => {
  test('should create valid JSON success response', () => {
    const result = createSuccessResponse({ level: 5 });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.level).toBe(5);
  });

  test('should handle primitive data', () => {
    const result = createSuccessResponse(42);
    const parsed = JSON.parse(result);
    expect(parsed.data).toBe(42);
  });

  test('should handle string data', () => {
    const result = createSuccessResponse('operation complete');
    const parsed = JSON.parse(result);
    expect(parsed.data).toBe('operation complete');
  });

  test('should handle array data', () => {
    const data = [1, 2, 3];
    const result = createSuccessResponse(data);
    const parsed = JSON.parse(result);
    expect(parsed.data).toEqual([1, 2, 3]);
  });

  test('should handle null data', () => {
    const result = createSuccessResponse(null);
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeNull();
  });

  test('should handle complex nested objects', () => {
    const data = {
      player: {
        id: '123',
        stats: { attack: 50, defense: 30 },
        inventory: ['sword', 'shield'],
      },
    };
    const result = createSuccessResponse(data);
    const parsed = JSON.parse(result);
    expect(parsed.data.player.stats.attack).toBe(50);
    expect(parsed.data.player.inventory).toHaveLength(2);
  });

  test('should return string type', () => {
    const result = createSuccessResponse({ ok: true });
    expect(typeof result).toBe('string');
  });
});

describe('ErrorResponse type', () => {
  test('should match ErrorResponse interface', () => {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: Date.now(),
      },
    };
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('TEST_ERROR');
  });

  test('should allow optional details', () => {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'With details',
        details: { extra: 'info' },
        timestamp: Date.now(),
      },
    };
    expect(response.error.details).toEqual({ extra: 'info' });
  });
});

describe('SuccessResponse type', () => {
  test('should match SuccessResponse interface with number', () => {
    const response: SuccessResponse<number> = {
      success: true,
      data: 42,
    };
    expect(response.success).toBe(true);
    expect(response.data).toBe(42);
  });

  test('should match SuccessResponse interface with object', () => {
    const response: SuccessResponse<{ name: string }> = {
      success: true,
      data: { name: 'test' },
    };
    expect(response.data.name).toBe('test');
  });
});
