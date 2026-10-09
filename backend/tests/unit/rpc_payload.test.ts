import { parseRpcPayload } from '../integration/rpc_payload';

describe('parseRpcPayload', () => {
  it('keeps an already-decoded successful response', () => {
    const payload = { success: true, rank: 3 };
    expect(parseRpcPayload(payload)).toBe(payload);
  });
  it('parses a legacy JSON string', () => {
    expect(parseRpcPayload('{"success":true}')).toEqual({ success: true });
  });
  it('keeps an error response visible', () => {
    expect(parseRpcPayload({ error: 'RATE_LIMITED' }).error).toBe('RATE_LIMITED');
  });
  it('returns an empty object for no payload', () => {
    expect(parseRpcPayload(undefined)).toEqual({});
  });
  it('rejects malformed or scalar payloads', () => {
    expect(() => parseRpcPayload('bad json')).toThrow();
    expect(() => parseRpcPayload(42)).toThrow();
    expect(() => parseRpcPayload([])).toThrow();
  });
});
