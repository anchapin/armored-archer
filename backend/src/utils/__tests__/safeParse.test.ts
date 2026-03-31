import { safeParse, safeParsePayload, createErrorResponse } from '../safeParse';

describe('safeParse', () => {
  const mockLogger = { error: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('safeParse', () => {
    it('parses valid JSON string', () => {
      const result = safeParse('{"a":1}', null, mockLogger, 'test');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1 });
    });

    it('returns error on invalid JSON', () => {
      const result = safeParse('{invalid}', null, mockLogger, 'test');
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('handles null logger', () => {
      const result = safeParse('{"x":2}', null, null, 'test');
      expect(result.success).toBe(true);
    });

    it('returns error on empty string', () => {
      const result = safeParse('', null, mockLogger, 'test');
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('returns error on null/undefined string', () => {
      const resultNull = safeParse(null as any, null, mockLogger, 'test');
      expect(resultNull.success).toBe(false);
    });

    it('parses arrays', () => {
      const result = safeParse('[1,2,3]', null, mockLogger, 'array_test');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('parses primitive values', () => {
      const strResult = safeParse('"hello"', null, mockLogger, 'string_test');
      expect(strResult.success).toBe(true);
      expect(strResult.data).toBe('hello');

      const numResult = safeParse('42', null, mockLogger, 'number_test');
      expect(numResult.success).toBe(true);
      expect(numResult.data).toBe(42);

      const boolResult = safeParse('true', null, mockLogger, 'bool_test');
      expect(boolResult.success).toBe(true);
      expect(boolResult.data).toBe(true);
    });

    it('parses null JSON value', () => {
      const result = safeParse('null', null, mockLogger, 'null_test');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('handles nested objects', () => {
      const nested = '{"user":{"name":"Alex","scores":[10,20,30]},"active":true}';
      const result = safeParse(nested, null, mockLogger, 'nested');
      expect(result.success).toBe(true);
      expect(result.data.user.name).toBe('Alex');
      expect(result.data.user.scores).toEqual([10, 20, 30]);
      expect(result.data.active).toBe(true);
    });

    it('does not log when logger is undefined', () => {
      safeParse('{bad}', null, undefined, 'no_logger');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs error with operation name', () => {
      safeParse('{bad}', null, mockLogger, 'my_operation');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse JSON for %s: %s',
        'my_operation',
        expect.anything()
      );
    });
  });

  describe('safeParsePayload', () => {
    it('returns parsed object for valid JSON', () => {
      const result = safeParsePayload('{"foo":"bar"}', mockLogger);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns null on empty payload', () => {
      expect(safeParsePayload('', mockLogger)).toBeNull();
    });

    it('returns null on invalid JSON', () => {
      expect(safeParsePayload('abc', mockLogger)).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns null on undefined payload', () => {
      expect(safeParsePayload(undefined as any, mockLogger)).toBeNull();
    });

    it('returns parsed array', () => {
      const result = safeParsePayload('[1,"two",3]', mockLogger);
      expect(result).toEqual([1, 'two', 3]);
    });

    it('logs error with operation parameter', () => {
      safeParsePayload('bad_json', mockLogger, 'parse_op');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse JSON payload for %s: %s',
        'parse_op',
        expect.anything()
      );
    });

    it('does not log when logger is undefined', () => {
      expect(safeParsePayload('bad', undefined, 'silent')).toBeNull();
    });

    it('handles null JSON payload', () => {
      const result = safeParsePayload('null', mockLogger);
      expect(result).toBeNull();
    });
  });

  describe('createErrorResponse', () => {
    it('creates error JSON', () => {
      const resp = createErrorResponse('ERR', 'message');
      const parsed = JSON.parse(resp);
      expect(parsed).toEqual({
        error: 'message',
        error_code: 'ERR',
      });
    });

    it('returns string type', () => {
      const resp = createErrorResponse('CODE', 'msg');
      expect(typeof resp).toBe('string');
    });

    it('handles empty code and message', () => {
      const resp = createErrorResponse('', '');
      const parsed = JSON.parse(resp);
      expect(parsed.error_code).toBe('');
      expect(parsed.error).toBe('');
    });

    it('handles special characters in message', () => {
      const resp = createErrorResponse('ERR', 'error with "quotes" & <html>');
      const parsed = JSON.parse(resp);
      expect(parsed.error).toBe('error with "quotes" & <html>');
    });
  });
});
