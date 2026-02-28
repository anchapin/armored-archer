import { Runtime } from "../types/nakama";
import { safeParse, safeParsePayload, createErrorResponse } from "../utils/safeParse";

export interface PvPMatch {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  creator_rank: number;
  opponent_rank: number;
  match_type: "ranked" | "casual";
  is_punch_up: boolean;
  status: "pending" | "active" | "completed";
  created_at: number;
  updated_at: number;
  creator_turn_data?: any;
  opponent_turn_data?: any;
  winner?: string;
}

export interface CreateMatchRequest {
  match_type: "ranked" | "casual";
  is_punch_up?: boolean;
  target_opponent_id?: string;
}

export interface AcceptMatchRequest {
  match_id: string;
}

export interface ListMatchesRequest {
  match_type?: "ranked" | "casual";
  min_rank?: number;
  max_rank?: number;
  limit?: number;
}

export function registerRpcListMatches(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/list_matches", rpcListMatches);
}

function rpcListMatches(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("List matches called for user: %s", ctx.userId);

  const requestParse = safeParsePayload<ListMatchesRequest>(payload, logger, "list_matches");
  const request = requestParse || {};
  const limit = request.limit || 20;

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

  const parseResult = safeParse(objects[0].value, null, logger, "player_stats");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player stats for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player stats");
  }
  const playerStats = parseResult.data;
  const playerRank = calculateRank(playerStats);

  const matches = nk.storageList(
    ctx.userId,
    "pvp_matches",
    limit,
    "",
    ""
  );

  let filteredMatches: PvPMatch[] = [];

  for (const object of matches) {
    const parseResult = safeParse(object.value, null, logger, "pvp_match");
    if (!parseResult.success || !parseResult.data) {
      logger.error("Failed to parse match data");
      continue;
    }
    const match: PvPMatch = parseResult.data!;
    
    if (match.status !== "pending") {
      continue;
    }

    if (request.match_type && match.match_type !== request.match_type) {
      continue;
    }

    if (match.creator_id === ctx.userId) {
      continue;
    }

    const rankDiff = Math.abs(match.creator_rank - playerRank);
    
    if (request.min_rank !== undefined && match.creator_rank < request.min_rank) {
      continue;
    }

    if (request.max_rank !== undefined && match.creator_rank > request.max_rank) {
      continue;
    }

    filteredMatches.push(match);
  }

  filteredMatches.sort((a, b) => b.created_at - a.created_at);

  return JSON.stringify({
    success: true,
    matches: filteredMatches.slice(0, limit),
    player_rank: playerRank,
    total: filteredMatches.length
  });
}

export function registerRpcCreateMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/create_match", rpcCreateMatch);
}

function rpcCreateMatch(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Create match called for user: %s", ctx.userId);

  const request = safeParsePayload<CreateMatchRequest>(payload, logger, "create_match");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (!request.match_type || (request.match_type !== "ranked" && request.match_type !== "casual")) {
    return JSON.stringify({
      error: "Invalid match type"
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

  const parseResult = safeParse(objects[0].value, null, logger, "player_stats");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player stats for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player stats");
  }
  const playerStats = parseResult.data;
  const playerRank = calculateRank(playerStats);

  if (request.target_opponent_id) {
    const targetStats = nk.storageRead([
      {
        collection: "player_stats",
        key: request.target_opponent_id,
        userId: request.target_opponent_id
      }

    ]);

    if (targetStats.length === 0) {
      return JSON.stringify({
        error: "Target player not found"
      });
    }

    const targetParseResult = safeParse(targetStats[0].value, null, logger, "player_stats");
    if (!targetParseResult.success || !targetParseResult.data) {
      logger.error("Failed to parse target player stats: %s", request.target_opponent_id);
      return createErrorResponse("INVALID_DATA", "Failed to parse target player stats");
    }
    const targetPlayerStats = targetParseResult.data;
    const targetRank = calculateRank(targetPlayerStats);

    if (!request.is_punch_up && Math.abs(playerRank - targetRank) > 3) {
      return JSON.stringify({
        error: "Rank difference too large for direct challenge"
      });
    }

    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: request.target_opponent_id,
      creator_rank: playerRank,
      opponent_rank: targetRank,
      match_type: request.match_type,
      is_punch_up: request.is_punch_up || false,
      status: "pending",
      created_at: Date.now(),
      updated_at: Date.now()
    };

    nk.storageWrite([
      {
        collection: "pvp_matches",
        key: match.match_id,
        userId: ctx.userId,
        value: JSON.stringify(match)
      }
    ]);

    return JSON.stringify({
      success: true,
      match: match
    });
  } else {
    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: "",
      creator_rank: playerRank,
      opponent_rank: 0,
      match_type: request.match_type,
      is_punch_up: false,
      status: "pending",
      created_at: Date.now(),
      updated_at: Date.now()
    };

    nk.storageWrite([
      {
        collection: "pvp_matches",
        key: match.match_id,
        userId: ctx.userId,
        value: JSON.stringify(match)
      }
    ]);

    return JSON.stringify({
      success: true,
      match: match
    });
  }
}

export function registerRpcAcceptMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/accept_match", rpcAcceptMatch);
}

function rpcAcceptMatch(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Accept match called for user: %s", ctx.userId);

  const request = safeParsePayload<AcceptMatchRequest>(payload, logger, "accept_match");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }

  if (!request.match_id) {
    return JSON.stringify({
      error: "Match ID required"
    });
  }

  const objects = nk.storageRead([
    {
      collection: "pvp_matches",
      key: request.match_id,
      userId: ctx.userId
    }
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: "Match not found"
    });
  }

  const parseResult = safeParse(objects[0].value, null, logger, "pvp_match");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse match data: %s", request.match_id);
    return createErrorResponse("INVALID_DATA", "Failed to parse match data");
  }
  const match: PvPMatch = parseResult.data!;

  if (match.creator_id === ctx.userId) {
    return JSON.stringify({
      error: "Cannot accept your own match"
    });
  }

  if (match.status !== "pending") {
    return JSON.stringify({
      error: "Match is no longer available"
    });
  }

  const playerObjects = nk.storageRead([
    {
      collection: "player_stats",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);

  if (playerObjects.length === 0) {
    return JSON.stringify({
      error: "Player stats not found"
    });
  }

  const parseResult = safeParse(playerObjects[0].value, null, logger, "player_stats");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player stats for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player stats");
  }
  const playerStats = parseResult.data;
  match.opponent_id = ctx.userId;
  match.opponent_rank = calculateRank(playerStats);
  match.status = "active";
  match.updated_at = Date.now();

  nk.storageWrite([
    {
      collection: "pvp_matches",
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match)
    }
  ]);

  return JSON.stringify({
    success: true,
    match: match
  });
}

export function registerRpcGetPlayerRank(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_player_rank", rpcGetPlayerRank);
}

function rpcGetPlayerRank(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get player rank called for user: %s", ctx.userId);

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

  const parseResult = safeParse(objects[0].value, null, logger, "player_stats");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player stats for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player stats");
  }
  const playerStats = parseResult.data;
  const rank = calculateRank(playerStats);

  return JSON.stringify({
    success: true,
    rank: rank,
    level: playerStats.level,
    xp: playerStats.xp
  });
}

function calculateRank(playerStats: any): number {
  const baseRank = playerStats.level * 10;
  const statsTotal = playerStats.stats.attack + 
                     playerStats.stats.defense + 
                     playerStats.stats.dodge + 
                     playerStats.stats.crit_rate;
  
  return Math.floor(baseRank + (statsTotal / 4));
}

function generateMatchId(): string {
  return "match_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}
