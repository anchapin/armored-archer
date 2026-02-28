import { Runtime } from "../types/nakama";
import { getCacheManager } from "../utils/cache";
import { registerRpcWithMetrics } from "./metrics";

export function registerRpcHealthCheck(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, "armored_archer/health_check", "health_check", rpcHealthCheck);
}

function rpcHealthCheck(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, _payload: string): string {
  logger.info("Armored Archer health check called");
  return JSON.stringify({
    status: "ok",
    timestamp: Date.now(),
    version: "0.1.0"
  });
}

export function registerRpcGetPlayerStats(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, "armored_archer/get_player_stats", "get_player_stats", rpcGetPlayerStats);
}

function rpcGetPlayerStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, _payload: string): string {
  logger.info("Getting player stats for user: %s", ctx.userId);

  const cacheManager = getCacheManager(logger);
  const cachedStats = cacheManager.get<string>("player_stats", ctx.userId);

  if (cachedStats !== undefined) {
    return cachedStats;
  }

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

  const stats = objects[0].value ?? "{}";
  cacheManager.set("player_stats", ctx.userId, stats);

  return stats;
}
