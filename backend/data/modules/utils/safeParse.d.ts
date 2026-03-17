import { Runtime } from '../types/nakama';
export interface ParseResult<T> {
    success: boolean;
    data?: T;
}
export declare function safeParse<T>(jsonString: string, context: string | null, logger: Runtime.Logger | undefined, operation: string): ParseResult<T>;
export declare function safeParsePayload<T>(payload: string, logger: Runtime.Logger | undefined, operation: string): T | null;
export declare function createErrorResponse(code: string, message: string): string;
