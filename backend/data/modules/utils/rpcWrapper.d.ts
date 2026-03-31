import { Runtime } from '../types/nakama';
export type RpcHandler = (ctx: Runtime.Context, loggerParam: Runtime.Logger, nk: Runtime.Nakama, payload: string) => string;
export interface RpcWrapperOptions {
    name: string;
    validatePayload?: (payload: unknown) => boolean;
}
export declare function wrapRpc(handler: RpcHandler, options: RpcWrapperOptions): RpcHandler;
export declare function createErrorResponse(code: string, message: string): string;
export declare function createSuccessResponse(data: unknown): string;
