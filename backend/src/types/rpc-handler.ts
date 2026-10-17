import type { Runtime } from './nakama';

/** Type for RPC handlers. */
export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;
