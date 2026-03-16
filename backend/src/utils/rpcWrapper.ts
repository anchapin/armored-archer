import { captureRpcError } from '../config/errorTracking';
import { logRpcEntry, logRpcExit, logRpcError } from '../config/logger';
import { Runtime } from '../types/nakama';

export type RpcHandler = (
  ctx: Runtime.Context,
  loggerParam: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string;

export interface RpcWrapperOptions {
  name: string;
  validatePayload?: (payload: unknown) => boolean;
}

export function wrapRpc(handler: RpcHandler, options: RpcWrapperOptions): RpcHandler {
  return (
    ctx: Runtime.Context,
    loggerParam: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): string => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      let parsedPayload: unknown = undefined;

      if (payload) {
        try {
          parsedPayload = JSON.parse(payload);
          if (options.validatePayload && !options.validatePayload(parsedPayload)) {
            throw new Error('Invalid payload');
          }
        } catch (parseError) {
          const error = parseError as Error;
          logRpcError(options.name, ctx.userId, requestId, error, Date.now() - startTime);
          captureRpcError(options.name, ctx.userId, error, payload);
          return JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'Invalid request payload',
            },
          });
        }
      }

      logRpcEntry(options.name, ctx.userId, requestId, parsedPayload);

      const result = handler(ctx, loggerParam, nk, payload);

      const durationMs = Date.now() - startTime;
      logRpcExit(options.name, ctx.userId, requestId, durationMs);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error as Error;

      logRpcError(options.name, ctx.userId, requestId, err, durationMs);
      captureRpcError(options.name, ctx.userId, err, payload);

      return JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred',
        },
      });
    }
  };
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function createErrorResponse(code: string, message: string): string {
  return JSON.stringify({
    success: false,
    error: {
      code,
      message,
    },
  });
}

export function createSuccessResponse(data: unknown): string {
  return JSON.stringify({
    success: true,
    data,
  });
}
