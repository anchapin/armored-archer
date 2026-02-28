import { Runtime } from "../types/nakama";

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

export interface XPGainRequest {
  xp_amount: number;
  source: string; // "pve" or "pvp"
}

export interface StatAllocationRequest {
  stat_name: string; // "attack", "defense", "dodge", "crit_rate"
  points: number;
}

export function registerRpcGainXP(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/gain_xp", rpcGainXP);
}

function rpcGainXP(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Gain XP called for user: %s", ctx.userId);

  const request: XPGainRequest = JSON.parse(payload);

  if (request.xp_amount <= 0) {
    return JSON.stringify({
      error: "Invalid XP amount"
    });
  }

  const objects = nk.storageRead([
    {
      collection: "player_stats",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  let playerStats: PlayerStats;

  if (objects.length === 0) {
    playerStats = {
      user_id: ctx.userId,
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
  } else {
    const value = objects[0].value;
    if (value) {
      playerStats = JSON.parse(value) as PlayerStats;
    } else {
      playerStats = {
        user_id: ctx.userId,
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
    }
  }

  const oldLevel = playerStats.level;
  playerStats.xp += request.xp_amount;

  const newLevel = calculateLevel(playerStats.xp);
  playerStats.level = newLevel;

  if (newLevel > oldLevel) {
    const levelsGained = newLevel - oldLevel;
    playerStats.ability_points += levelsGained;
    logger.info("User %s leveled up from %d to %d, gained %d ability points", ctx.userId, oldLevel, newLevel, levelsGained);
  }

  nk.storageWrite([
    {
      collection: "player_stats",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerStats)
    }
  ]);

  return JSON.stringify({
    success: true,
    player_stats: playerStats,
    xp_gained: request.xp_amount,
    levels_gained: Math.max(0, newLevel - oldLevel)
  });
}

export function registerRpcAllocateStats(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/allocate_stats", rpcAllocateStats);
}

function rpcAllocateStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Allocate stats called for user: %s", ctx.userId);

  const request: StatAllocationRequest = JSON.parse(payload);

  const validStats = ["attack", "defense", "dodge", "crit_rate"];
  if (!validStats.includes(request.stat_name)) {
    return JSON.stringify({
      error: "Invalid stat name"
    });
  }

  if (request.points <= 0) {
    return JSON.stringify({
      error: "Invalid points amount"
    });
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

  const playerStats: PlayerStats = JSON.parse(objects[0].value ?? "{}");

  if (playerStats.ability_points < request.points) {
    return JSON.stringify({
      error: "Not enough ability points"
    });
  }

  playerStats.ability_points -= request.points;
  playerStats.stats[request.stat_name as keyof typeof playerStats.stats] += request.points;

  nk.storageWrite([
    {
      collection: "player_stats",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerStats)
    }
  ]);

  return JSON.stringify({
    success: true,
    player_stats: playerStats
  });
}

export function registerRpcGetPlayerStats(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_player_stats", rpcGetPlayerStats);
}

function rpcGetPlayerStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get player stats called for user: %s", ctx.userId);

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

  return objects[0].value ?? "{}";
}

function calculateLevel(xp: number): number {
  const baseXP = 100;
  const growthFactor = 1.5;
  let level = 1;
  let xpForNextLevel = baseXP;

  while (xp >= xpForNextLevel) {
    xp -= xpForNextLevel;
    level++;
    xpForNextLevel = Math.floor(xpForNextLevel * growthFactor);
  }

  return level;
}

function getXPForLevel(level: number): number {
  const baseXP = 100;
  const growthFactor = 1.5;
  let totalXP = 0;
  let xpForLevel = baseXP;

  for (let i = 1; i < level; i++) {
    totalXP += xpForLevel;
    xpForLevel = Math.floor(xpForLevel * growthFactor);
  }

  return totalXP;
}
