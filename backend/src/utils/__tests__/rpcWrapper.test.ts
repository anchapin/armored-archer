import { wrapRpc, createErrorResponse, createSuccessResponse } from "../rpcWrapper";
import { captureRpcError, logRpcEntry, logRpcError, logRpcExit } from "../../config/logger";

jest.mock("../../config/logger", () => ({
  captureRpcError: jest.fn(),
  logRpcEntry: jest.fn(),
  logRpcError: jest.fn(),
  logRpcExit: jest.fn(),
}));

describe("rpcWrapper", () => {
  let mockHandler: jest.Mock;
  const mockCtx = { userId: "test-user-123" } as any;
  const mockLogger = {};
  const mockNk = {};
  const options = { name: "test_rpc" };

  beforeEach(() => {
    mockHandler = jest.fn();
    jest.clearAllMocks();
  });

  describe("wrapRpc", () => {
    it("should call handler and return result on success", () => {
      mockHandler.mockReturnValue('{"success":true}');
      const wrapped = wrapRpc(mockHandler, options);
      const result = wrapped(mockCtx, mockLogger, mockNk, "{}");
      expect(result).toBe('{"success":true}');
      expect(logRpcEntry).toHaveBeenCalledWith("test_rpc", "test-user-123", expect.any(String), {});
      expect(logRpcExit).toHaveBeenCalledWith("test_rpc", "test-user-123", expect.any(String), expect.any(Number));
    });

    it("should log parsed payload", () => {
      mockHandler.mockReturnValue("ok");
      const wrapped = wrapRpc(mockHandler, options);
      wrapped(mockCtx, mockLogger, mockNk, '{"foo":"bar"}');
      expect(logRpcEntry).toHaveBeenCalledWith("test_rpc", "test-user-123", expect.any(String), { foo: "bar" });
    });

    it("should handle empty payload without parsing", () => {
      mockHandler.mockReturnValue("ok");
      const wrapped = wrapRpc(mockHandler, options);
      const result = wrapped(mockCtx, mockLogger, mockNk, "");
      expect(result).toBe("ok");
      expect(logRpcEntry).toHaveBeenCalledWith("test_rpc", "test-user-123", expect.any(String), undefined);
    });

    it("should return INVALID_PAYLOAD for invalid JSON", () => {
      mockHandler.mockReturnValue("ok");
      const wrapped = wrapRpc(mockHandler, options);
      const result = wrapped(mockCtx, mockLogger, mockNk, "{{");
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("INVALID_PAYLOAD");
      expect(captureRpcError).toHaveBeenCalled();
    });

    it("should return INVALID_PAYLOAD for validation failure", () => {
      const validator = (payload: unknown) => (payload as any).valid === true;
      const wrapped = wrapRpc(mockHandler, { ...options, validatePayload: validator });
      const result = wrapped(mockCtx, mockLogger, mockNk, '{"valid":false}');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("INVALID_PAYLOAD");
    });

    it("should catch exceptions and return INTERNAL_ERROR", () => {
      mockHandler.mockImplementation(() => { throw new Error("something went wrong"); });
      const wrapped = wrapRpc(mockHandler, options);
      const result = wrapped(mockCtx, mockLogger, mockNk, "{}");
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("INTERNAL_ERROR");
      expect(parsed.error.message).toBe("something went wrong");
      expect(captureRpcError).toHaveBeenCalled();
    });
  });

  describe("createErrorResponse", () => {
    it("should create proper error JSON", () => {
      const resp = createErrorResponse("MY_ERROR", "my message");
      const parsed = JSON.parse(resp);
      expect(parsed).toEqual({
        success: false,
        error: { code: "MY_ERROR", message: "my message" },
      });
    });
  });

  describe("createSuccessResponse", () => {
    it("should create success JSON with data", () => {
      const resp = createSuccessResponse({ level: 5 });
      const parsed = JSON.parse(resp);
      expect(parsed).toEqual({ success: true, data: { level: 5 } });
    });

    it("should handle null data", () => {
      const resp = createSuccessResponse(null);
      const parsed = JSON.parse(resp);
      expect(parsed).toEqual({ success: true, data: null });
    });
  });
});
