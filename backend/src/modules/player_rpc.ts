import { Runtime } from "../types/nakama";

export function registerRpcHealthCheck(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/health_check", rpcHealthCheck);
}

function rpcHealthCheck(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Armored Archer health check called");
  return JSON.stringify({
    status: "ok",
    timestamp: Date.now(),
    version: "0.1.0"
  });
}

export function registerRpcGetPlayerStats(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_player_stats", rpcGetPlayerStats);
}

function rpcGetPlayerStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Getting player stats for user: %s", ctx.userId);

  const objects = nk.storageRead([
    {
      collection: "player_stats",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: "Player stats not found"
    });
  }

  return objects[0].value;
}
