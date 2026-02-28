import { Runtime } from "../types/nakama";
import { safeParse } from "./safeParse";
import { getCacheManager } from "./cache";

export interface PlayerStats {
  user_id: string;
  level: number;
  xp: number;
  ability_points: number;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
}

interface StorageReadRequest {
  collection: string;
  key: string;
  userId: string;
}

export function batchGetPlayerStats(
  nk: Runtime.Nakama,
  userIds: string[],
  logger: Runtime.Logger
): Map<string, PlayerStats> {
  const cacheManager = getCacheManager(logger);
  const result = new Map<string, PlayerStats>();
  const uncachedUserIds: string[] = [];

  for (const userId of userIds) {
    const cachedStats = cacheManager.get<PlayerStats>("player_stats", userId);
    if (cachedStats !== undefined) {
      result.set(userId, cachedStats);
    } else {
      uncachedUserIds.push(userId);
    }
  }

  if (uncachedUserIds.length > 0) {
    const readRequests: StorageReadRequest[] = uncachedUserIds.map(userId => ({
      collection: "player_stats",
      key: userId,
      userId: userId
    }));

    const objects = nk.storageRead(readRequests);

    for (const obj of objects) {
      if (obj.value) {
        const parseResult = safeParse<PlayerStats>(obj.value, null, logger, "player_stats");
        if (parseResult.success && parseResult.data) {
          const stats = parseResult.data;
          result.set(obj.userId, stats);
          cacheManager.set("player_stats", obj.userId, stats);
        }
      }
    }

    for (const userId of uncachedUserIds) {
      if (!result.has(userId)) {
        const defaultStats: PlayerStats = {
          user_id: userId,
          level: 1,
          xp: 0,
          ability_points: 0,
          stats: {
            attack: 10,
            defense: 10,
            dodge: 10,
            crit_rate: 5
          }
        };
        result.set(userId, defaultStats);
      }
    }
  }

  return result;
}

export function getPlayerStatsWithCache(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): PlayerStats {
  const cacheManager = getCacheManager(logger);
  const cachedStats = cacheManager.get<PlayerStats>("player_stats", userId);

  if (cachedStats !== undefined) {
    return cachedStats;
  }

  const objects = nk.storageRead([
    {
      collection: "player_stats",
      key: userId,
      userId: userId
    }
  ]);

  if (objects.length > 0 && objects[0].value) {
    const parseResult = safeParse<PlayerStats>(objects[0].value, null, logger, "player_stats");
    if (parseResult.success && parseResult.data) {
      const stats = parseResult.data;
      cacheManager.set("player_stats", userId, stats);
      return stats;
    }
  }

  const defaultStats: PlayerStats = {
    user_id: userId,
    level: 1,
    xp: 0,
    ability_points: 0,
    stats: {
      attack: 10,
      defense: 10,
      dodge: 10,
      crit_rate: 5
    }
  };
  cacheManager.set("player_stats", userId, defaultStats);
  return defaultStats;
}

export function invalidatePlayerStatsCache(userId: string, logger: Runtime.Logger): void {
  const cacheManager = getCacheManager(logger);
  cacheManager.delete("player_stats", userId);
}
