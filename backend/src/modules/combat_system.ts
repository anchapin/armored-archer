import { Runtime } from "../types/nakama";
import { PvPMatch } from "./matchmaker";
import { PlayerStats } from "../types/game";

import { validatePayload, ZodSchemas, createValidationErrorResponse } from "./validation";
export interface CombatAction {
  match_id: string;
  action_type: string; // "shoot"
  angle: number;
  power?: number;
}

export interface CombatResult {
  success: boolean;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  attacker_stats: PlayerStats;
  defender_stats: PlayerStats;
  match_status: string;
  winner?: string;
}

export interface MatchState {
  match_id: string;
  turn: number;
  current_turn_user_id: string;
  creator_id: string;
  opponent_id: string;
  creator_health: number;
  opponent_health: number;
  creator_stats: PlayerStats;
  opponent_stats: PlayerStats;
  status: string;
  winner?: string;
  log: CombatLogEntry[];
}

export interface CombatLogEntry {
  turn: number;
  attacker_id: string;
  action: string;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  timestamp: number;
}

export function registerRpcSubmitCombatAction(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/submit_combat_action", rpcSubmitCombatAction);
}

function rpcSubmitCombatAction(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Submit combat action called for user: %s", ctx.userId);

  const validation = validatePayload(ZodSchemas.submit_combat_action, payload, "submit_combat_action");
  if (!validation.success) {
    return createValidationErrorResponse("submit_combat_action", validation.error);
  }

  const action = validation.data;

  const matchObjects = nk.storageRead([
    {
      collection: "pvp_matches",
      key: action.match_id,
      userId: ctx.userId
    }
  ]);

  if (matchObjects.length === 0) {
    return JSON.stringify({
      error: "Match not found"
    });
  }

  const match = JSON.parse(matchObjects[0].value);

  if (match.status !== "active") {
    return JSON.stringify({
      error: "Match is not active"
    });
  }

  if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
    return JSON.stringify({
      error: "Not a participant in this match"
    });
  }

  const matchState = getOrCreateMatchState(nk, action.match_id, match, logger);

  if (matchState.current_turn_user_id !== ctx.userId) {
    return JSON.stringify({
      error: "Not your turn"
    });
  }

  const result = processCombatAction(ctx.userId, action, match, matchState, nk, logger);

  saveMatchState(nk, matchState);

  if (result.winner) {
    updateMatchStatus(nk, match, result.winner);
  }

  return JSON.stringify({
    success: true,
    result: result
  });
}

export function registerRpcGetMatchState(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_match_state", rpcGetMatchState);
}

function rpcGetMatchState(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get match state called for user: %s", ctx.userId);

  const validation = validatePayload(ZodSchemas.get_match_state, payload, "get_match_state");
  if (!validation.success) {
    return createValidationErrorResponse("get_match_state", validation.error);
  }

  const request = validation.data;

  const stateObjects = nk.storageRead([
    {
      collection: "pvp_match_states",
      key: request.match_id,
      userId: ctx.userId
    }
  ]);

  if (stateObjects.length === 0) {
    return JSON.stringify({
      error: "Match state not found"
    });
  }

  return stateObjects[0].value;
}

function getOrCreateMatchState(nk: Runtime.Nakama, matchId: string, match: PvPMatch, logger: Runtime.Logger): MatchState {
  const stateObjects = nk.storageRead([
    {
      collection: "pvp_match_states",
      key: matchId,
      userId: match.creator_id
    }
  ]);

  if (stateObjects.length > 0) {
    return JSON.parse(stateObjects[0].value);
  }

  const creatorStats = getPlayerStats(nk, match.creator_id, logger);
  const opponentStats = getPlayerStats(nk, match.opponent_id, logger);

  const baseHealth = 100;
  const maxHealth = baseHealth + (creatorStats.level * 10);

  const matchState: MatchState = {
    match_id: matchId,
    turn: 1,
    current_turn_user_id: match.creator_id,
    creator_id: match.creator_id,
    opponent_id: match.opponent_id,
    creator_health: maxHealth,
    opponent_health: maxHealth,
    creator_stats: creatorStats,
    opponent_stats: opponentStats,
    status: "active",
    log: []
  };

  return matchState;
}

function processCombatAction(
  userId: string,
  action: CombatAction,
  match: PvPMatch,
  matchState: MatchState,
  _nk: Runtime.Nakama,
  _logger: Runtime.Logger
): CombatResult {
  const isCreator = userId === matchState.creator_id;
  const attackerStats = isCreator ? matchState.creator_stats : matchState.opponent_stats;
  const defenderStats = isCreator ? matchState.opponent_stats : matchState.creator_stats;

  const result: CombatResult = {
    success: true,
    hit: false,
    damage: 0,
    is_crit: false,
    attacker_stats: attackerStats,
    defender_stats: defenderStats,
    match_status: "active"
  };

  if (action.action_type === "shoot") {
    const hit = calculateHit(attackerStats, defenderStats);
    
    if (hit) {
      const damage = calculateDamage(attackerStats, defenderStats);
      const isCrit = calculateCrit(attackerStats.stats.crit_rate);
      const finalDamage = isCrit ? damage * 2 : damage;

      result.hit = true;
      result.damage = finalDamage;
      result.is_crit = isCrit;

      if (isCreator) {
        matchState.opponent_health = Math.max(0, matchState.opponent_health - finalDamage);
      } else {
        matchState.creator_health = Math.max(0, matchState.creator_health - finalDamage);
      }

      const logEntry: CombatLogEntry = {
        turn: matchState.turn,
        attacker_id: userId,
        action: action.action_type,
        hit: true,
        damage: finalDamage,
        is_crit: isCrit,
        timestamp: Date.now()
      };

      matchState.log.push(logEntry);

      if (matchState.creator_health <= 0) {
        result.winner = matchState.opponent_id;
        result.match_status = "completed";
        matchState.status = "completed";
        matchState.winner = matchState.opponent_id;
      } else if (matchState.opponent_health <= 0) {
        result.winner = matchState.creator_id;
        result.match_status = "completed";
        matchState.status = "completed";
        matchState.winner = matchState.creator_id;
      }
    } else {
      const logEntry: CombatLogEntry = {
        turn: matchState.turn,
        attacker_id: userId,
        action: action.action_type,
        hit: false,
        damage: 0,
        is_crit: false,
        timestamp: Date.now()
      };

      matchState.log.push(logEntry);
    }
  }

  matchState.turn++;
  matchState.current_turn_user_id = isCreator ? matchState.opponent_id : matchState.creator_id;

  return result;
}

function calculateHit(attackerStats: PlayerStats, defenderStats: PlayerStats): boolean {
  const dodgeChance = defenderStats.stats.dodge / 100.0;
  const hitChance = 1.0 - dodgeChance;
  const roll = Math.random();

  return roll <= hitChance;
}

function calculateDamage(attackerStats: PlayerStats, defenderStats: PlayerStats): number {
  const baseDamage = 10 + (attackerStats.stats.attack * 0.5);
  const defenseReduction = defenderStats.stats.defense * 0.3;
  const finalDamage = Math.max(1, baseDamage - defenseReduction);

  return Math.floor(finalDamage);
}

function calculateCrit(critRate: number): boolean {
  const critChance = critRate / 100.0;
  const roll = Math.random();

  return roll <= critChance;
}

function getPlayerStats(nk: Runtime.Nakama, userId: string, _logger: Runtime.Logger): PlayerStats {
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
      xp: 0,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5
      }
    };
  }

  return JSON.parse(objects[0].value);
}

function saveMatchState(nk: Runtime.Nakama, matchState: MatchState): void {
  nk.storageWrite([
    {
      collection: "pvp_match_states",
      key: matchState.match_id,
      userId: matchState.creator_id,
      value: JSON.stringify(matchState)
    }
  ]);
}

function updateMatchStatus(nk: Runtime.Nakama, match: PvPMatch, winner: string): void {
  match.status = "completed";
  match.winner = winner;
  match.updated_at = Date.now();

  nk.storageWrite([
    {
      collection: "pvp_matches",
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match)
    }
  ]);
}
