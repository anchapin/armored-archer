import { safeParse, safeParsePayload, createErrorResponse } from "../safeParse";

describe("safeParse", () => {
  const mockLogger = { error: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("safeParse", () => {
    it("parses valid JSON string", () => {
      const result = safeParse('{"a":1}', null, mockLogger, "test");
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1 });
    });

    it("returns error on invalid JSON", () => {
      const result = safeParse("{invalid}", null, mockLogger, "test");
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("handles null logger", () => {
      const result = safeParse('{"x":2}', null, null, "test");
      expect(result.success).toBe(true);
    });
  });

  describe("safeParsePayload", () => {
    it("returns parsed object for valid JSON", () => {
      const result = safeParsePayload('{"foo":"bar"}', mockLogger);
      expect(result).toEqual({ foo: "bar" });
    });

    it("returns null on empty payload", () => {
      expect(safeParsePayload("", mockLogger)).toBeNull();
    });

    it("returns null on invalid JSON", () => {
      expect(safeParsePayload("abc", mockLogger)).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("createErrorResponse", () => {
    it("creates error JSON", () => {
      const resp = createErrorResponse("ERR", "message");
      const parsed = JSON.parse(resp);
      expect(parsed).toEqual({
        error: "message",
        error_code: "ERR"
      });
    });
  });
});
