import { Runtime } from "../types/nakama";
import { safeParse, safeParsePayload, createErrorResponse } from "../utils/safeParse";
import { getCacheManager } from "../utils/cache";

export interface SeasonInfo {
  season_id: string;
  season_number: number;
  start_time: number;
  end_time: number;
  status: string; // "active", "ended"
  duration_weeks: number;
}

export interface LeaderboardEntry {
  owner_id: string;
  username: string;
  rank: number;
  score: number;
  meta: {
    wins: number;
    losses: number;
    win_rate: number;
    punch_up_wins: number;
  };
}

export interface RankChange {
  winner_id: string;
  loser_id: string;
  winner_old_rank: number;
  loser_old_rank: number;
  winner_new_rank: number;
  loser_new_rank: number;
  is_punch_up: boolean;
}

const SEASON_DURATION_WEEKS = 4;
const SEASON_DURATION_MS = SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000;

export function registerRpcGetSeasonInfo(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_season_info", rpcGetSeasonInfo);
}

function rpcGetSeasonInfo(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get season info called for user: %s", ctx.userId);

  const cacheManager = getCacheManager(logger);
  const seasonKey = `season_${getCurrentSeason().season_id}`;
  const cachedSeasonInfo = cacheManager.get<string>("season_info", seasonKey);

  let currentSeason: SeasonInfo;
  if (cachedSeasonInfo !== undefined) {
    currentSeason = JSON.parse(cachedSeasonInfo);
  } else {
    currentSeason = getCurrentSeason();
    cacheManager.set("season_info", seasonKey, JSON.stringify(currentSeason));
  }

  const userStats = getPlayerStats(nk, ctx.userId);

  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  return JSON.stringify({
    success: true,
    season: currentSeason,
    player_rank: playerEntry ? playerEntry.rank : null,
    player_score: playerEntry ? playerEntry.score : 0,
    time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
  });
}

export function registerRpcGetLeaderboard(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_leaderboard", rpcGetLeaderboard);
}

function rpcGetLeaderboard(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get leaderboard called for user: %s", ctx.userId);

  const currentSeason = getCurrentSeason();
  const requestParse = safeParsePayload<{ limit?: number }>(payload, logger, "get_leaderboard");
  const request = requestParse || {};
  const limit = request.limit || 50;

  const cacheManager = getCacheManager(logger);
  const leaderboardKey = `${currentSeason.season_id}_${limit}`;
  const cachedLeaderboard = cacheManager.get<string>("leaderboards", leaderboardKey);

  let result: string;
  if (cachedLeaderboard !== undefined) {
    result = cachedLeaderboard;
  } else {
    const records = nk.leaderboardRecordList(
      currentSeason.season_id,
      [],
      limit,
      "",
      0
    );

    const entries: LeaderboardEntry[] = records.map((record: any) => {
      const parseResult = safeParse(record.metadata || "{}", null, logger, "leaderboard_metadata");
      const meta = parseResult.success && parseResult.data ? parseResult.data : {
        wins: 0,
        losses: 0,
        win_rate: 0,
        punch_up_wins: 0
      };
      return {
        owner_id: record.ownerId,
        username: record.username,
        rank: record.rank,
        score: record.score,
        meta: meta
      };
    });

    result = JSON.stringify({
      success: true,
      season: currentSeason,
      leaderboard: entries,
      total: records.length
    });
    cacheManager.set("leaderboards", leaderboardKey, result);
  }

  return result;
}

export function registerRpcUpdateRank(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/update_rank", rpcUpdateRank);
}

function rpcUpdateRank(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Update rank called for user: %s", ctx.userId);

  const request = safeParsePayload<RankChange>(payload, logger, "update_rank");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (!request.winner_id || !request.loser_id) {
    return JSON.stringify({
      error: "Winner and loser IDs required"
    });
  }

  const currentSeason = getCurrentSeason();

  const winnerEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
  const loserEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);

  const winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
  const loserOldElo = loserEntry ? loserEntry.score : 1000;

  const K = request.is_punch_up ? 60 : 32; // Punch Up has higher K-factor
  const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerNewElo = Math.round(winnerOldElo + K * (1 - expectedWinner));
  const loserNewElo = Math.round(loserOldElo + K * (0 - expectedLoser));

  // Update winner
  const winnerMeta = winnerEntry ? winnerEntry.meta : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  winnerMeta.wins++;
  winnerMeta.punch_up_wins += request.is_punch_up ? 1 : 0;
  winnerMeta.win_rate = winnerMeta.wins / (winnerMeta.wins + winnerMeta.losses);

  nk.leaderboardRecordWrite(
    currentSeason.season_id,
    request.winner_id,
    ctx.username || "Player",
    winnerNewElo,
    0,
    {
      wins: String(winnerMeta.wins),
      losses: String(winnerMeta.losses),
      win_rate: String(winnerMeta.win_rate),
      punch_up_wins: String(winnerMeta.punch_up_wins)
    }
  );

  // Update loser
  const loserMeta = loserEntry ? loserEntry.meta : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  loserMeta.losses++;
  loserMeta.win_rate = loserMeta.wins / (loserMeta.wins + loserMeta.losses);

  nk.leaderboardRecordWrite(
    currentSeason.season_id,
    request.loser_id,
    "Opponent", // Will be updated with actual username
    loserNewElo,
    0,
    {
      wins: String(loserMeta.wins),
      losses: String(loserMeta.losses),
      win_rate: String(loserMeta.win_rate),
      punch_up_wins: String(loserMeta.punch_up_wins)
    }
  );

  // Invalidate leaderboard cache
  const cacheManager = getCacheManager(logger);
  cacheManager.clear("leaderboards");

  return JSON.stringify({
    success: true,
    winner: {
      user_id: request.winner_id,
      old_rank: winnerOldElo,
      new_rank: winnerNewElo,
      rank_change: winnerNewElo - winnerOldElo
    },
    loser: {
      user_id: request.loser_id,
      old_rank: loserOldElo,
      new_rank: loserNewElo,
      rank_change: loserNewElo - loserOldElo
    },
    is_punch_up: request.is_punch_up
  });
}

export function registerRpcGetSeasonRewards(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_season_rewards", rpcGetSeasonRewards);
}

function rpcGetSeasonRewards(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get season rewards called for user: %s", ctx.userId);

  const currentSeason = getCurrentSeason();
  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
      success: true,
      rewards: null
    });
  }

  const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);

  return JSON.stringify({
    success: true,
    rank: playerEntry.rank,
    rewards: rewards
  });
}

export function registerRpcClaimSeasonRewards(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/claim_season_rewards", rpcClaimSeasonRewards);
}

function rpcClaimSeasonRewards(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Claim season rewards called for user: %s", ctx.userId);

  const currentSeason = getCurrentSeason();

  const objects = nk.storageRead([
    {
      collection: "season_rewards_claimed",
      key: `${currentSeason.season_id}_${ctx.userId}`,
      userId: ctx.userId
    }
  ]);

  if (objects.length > 0) {
    return JSON.stringify({
      error: "Rewards already claimed for this season"
    });
  }

  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
      error: "No leaderboard entry found"
    });
  }

  const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);

  // Mark rewards as claimed
  nk.storageWrite([
    {
      collection: "season_rewards_claimed",
      key: `${currentSeason.season_id}_${ctx.userId}`,
      userId: ctx.userId,
      value: JSON.stringify({
        season_id: currentSeason.season_id,
        user_id: ctx.userId,
        claimed_at: Date.now(),
        rank: playerEntry.rank,
        rewards: rewards
      })
    }
  ]);

  // Give rewards (coins, cosmetics)
  const rewardChanges: { [key: string]: number } = {};
  
  if (rewards.coins) {
    rewardChanges["coins"] = rewards.coins;
  }
  
  if (rewards.gems) {
    rewardChanges["gems"] = rewards.gems;
  }

  if (Object.keys(rewardChanges).length > 0) {
    nk.walletUpdate(ctx.userId, rewardChanges);
  }

  return JSON.stringify({
    success: true,
    rewards: rewards,
    claimed: true
  });
}

export function registerRpcEndSeason(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/end_season", rpcEndSeason);
}

function rpcEndSeason(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("End season called for user: %s", ctx.userId);

  const currentSeason = getCurrentSeason();

  // Create new season
  const nextSeasonNumber = currentSeason.season_number + 1;
  const nextSeasonStartTime = Date.now();
  const nextSeasonEndTime = nextSeasonStartTime + SEASON_DURATION_MS;

  const nextSeason: SeasonInfo = {
    season_id: `season_${nextSeasonNumber}`,
    season_number: nextSeasonNumber,
    start_time: nextSeasonStartTime,
    end_time: nextSeasonEndTime,
    status: "active",
    duration_weeks: SEASON_DURATION_WEEKS
  };

  // Store new season info
  nk.storageWrite([
    {
      collection: "seasons",
      key: nextSeason.season_id,
      userId: ctx.userId,
      value: JSON.stringify(nextSeason)
    }
  ]);

  // Update current season status
  const oldSeason = currentSeason;
  oldSeason.status = "ended";

  nk.storageWrite([
    {
      collection: "seasons",
      key: oldSeason.season_id,
      userId: ctx.userId,
      value: JSON.stringify(oldSeason)
    }
  ]);

  // Create new leaderboard for next season
  nk.leaderboardCreate(
    nextSeason.season_id,
    true,
    "desc",
    "best",
    "",
    { season_number: String(nextSeasonNumber) }
  );

  return JSON.stringify({
    success: true,
    old_season: oldSeason,
    new_season: nextSeason
  });
}

function getCurrentSeason(): SeasonInfo {
  const now = Date.now();
  const seasonNumber = Math.floor(now / SEASON_DURATION_MS) + 1;
  const seasonStartTime = (seasonNumber - 1) * SEASON_DURATION_MS;
  const seasonEndTime = seasonStartTime + SEASON_DURATION_MS;

  return {
    season_id: `season_${seasonNumber}`,
    season_number: seasonNumber,
    start_time: seasonStartTime,
    end_time: seasonEndTime,
    status: "active",
    duration_weeks: SEASON_DURATION_WEEKS
  };
}

function getLeaderboardEntry(nk: Runtime.Nakama, userId: string, leaderboardId: string): LeaderboardEntry | null {
  const records = nk.leaderboardRecordList(
    leaderboardId,
    [userId],
    1,
    "",
    0
  );

  if (records.length === 0) {
    return null;
  }

  const record = records[0];
  const parseResult = safeParse<{ wins: number; losses: number; win_rate: number; punch_up_wins: number }>(record.metadata || "{}", null, undefined, "leaderboard_metadata");
  const meta = parseResult.success && parseResult.data ? parseResult.data : {
    wins: 0,
    losses: 0,
    win_rate: 0,
    punch_up_wins: 0
  };
  return {
    owner_id: record.ownerId,
    username: record.username,
    rank: record.rank,
    score: record.score,
    meta: meta
  };
}

function getPlayerStats(nk: Runtime.Nakama, userId: string): any {
  const objects = nk.storageRead([
    {
      collection: "player_stats",
      key: userId,
      userId: userId
    }
  ]);

  if (objects.length === 0) {
    return {
      level: 1,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5
      }
    };
  }

  const parseResult = safeParse(objects[0].value, null, undefined, "player_stats");
  if (!parseResult.success || !parseResult.data) {
    return {
      level: 1,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5
      }
    };
  }
  return parseResult.data;
}

function calculateRewards(rank: number, seasonNumber: number): any {
  if (rank <= 10) {
    return {
      rank_tier: "legendary",
      coins: 10000,
      gems: 500,
      cosmetics: {
        title: `Season ${seasonNumber} Champion`,
        aura: "legendary_aura"
      }
    };
  } else if (rank <= 50) {
    return {
      rank_tier: "epic",
      coins: 5000,
      gems: 200,
      cosmetics: {
        title: `Season ${seasonNumber} Elite`,
        aura: "epic_aura"
      }
    };
  } else if (rank <= 100) {
    return {
      rank_tier: "rare",
      coins: 2000,
      gems: 100,
      cosmetics: {
        title: `Season ${seasonNumber} Veteran`,
        aura: "rare_aura"
      }
    };
  } else if (rank <= 500) {
    return {
      rank_tier: "uncommon",
      coins: 500,
      gems: 0
    };
  } else {
    return {
      rank_tier: "common",
      coins: 100,
      gems: 0
    };
  }
}
