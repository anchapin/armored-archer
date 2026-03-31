import { Runtime } from '../types/nakama';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
}

export function safeParse<T>(
  jsonString: string,
  context: string | null,
  logger: Runtime.Logger | undefined,
  operation: string
): ParseResult<T> {
  try {
    if (!jsonString) {
      return { success: false };
    }
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    if (logger) {
      logger.error('Failed to parse JSON for %s: %s', operation, error);
    }
    return { success: false };
  }
}

export function safeParsePayload<T>(
  payload: string,
  logger: Runtime.Logger | undefined,
  operation: string
): T | null {
  try {
    if (!payload) {
      return null;
    }
    return JSON.parse(payload) as T;
  } catch (error) {
    if (logger) {
      logger.error('Failed to parse JSON payload for %s: %s', operation, error);
    }
    return null;
  }
}

export function createErrorResponse(code: string, message: string): string {
  return JSON.stringify({
    error: message,
    error_code: code,
  });
}
