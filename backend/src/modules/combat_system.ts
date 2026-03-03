/**
 * Combat System module.
 * @fileoverview Manages PvP combat actions and turn processing.
 */

import { Runtime } from '../types/nakama';
import { PvPMatch } from './matchmaker';
import { PlayerStats } from '../types/game';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Combat action request data.
 *
 * @property match_id - Unique identifier for the match
 * @property action_type - Type of combat action ("shoot")
 * @property angle - Angle of attack in radians
 * @property power - Optional power level for the attack
 */
export interface CombatAction {
  match_id: string;
  action_type: string; // "shoot"
  angle: number;
  power?: number;
}

/**
 * Result of a combat action.
 *
 * @property success - Whether the action was processed successfully
 * @property hit - Whether the attack hit the target
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was a critical hit
 * @property attacker_stats - Stats of the attacking player
 * @property defender_stats - Stats of the defending player
 * @property match_status - Current status of the match
 * @property winner - Optional winner if match completed
 */
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

/**
 * Current state of a PvP match.
 *
 * @property match_id - Unique identifier for the match
 * @property turn - Current turn number
 * @property current_turn_user_id - Player whose turn it is
 * @property creator_id - ID of the match creator
 * @property opponent_id - ID of the opponent
 * @property creator_health - Current health of the creator
 * @property opponent_health - Current health of the opponent
 * @property creator_stats - Stats of the creator
 * @property opponent_stats - Stats of the opponent
 * @property status - Current match status
 * @property winner - Optional winner if match completed
 * @property log - Combat log entries
 */
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

/**
 * Combat log entry for tracking match history.
 *
 * @property turn - Turn number when this action occurred
 * @property attacker_id - ID of the attacking player
 * @property action - Type of action performed
 * @property hit - Whether the attack hit
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was critical
 * @property timestamp - Timestamp when the action occurred
 */
export interface CombatLogEntry {
  turn: number;
  attacker_id: string;
  action: string;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  timestamp: number;
}

/**
 * Registers the submit combat action RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSubmitCombatAction(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/submit_combat_action', rpcSubmitCombatAction);
}

/**
 * Handles combat action submissions from players.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing combat action data
 * @returns JSON string with combat result
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "action_type": "shoot", "angle": 1.57 }
 *
 * // Response
 * {
 *   "success": true,
 *   "result": {
 *     "hit": true,
 *     "damage": 25,
 *     "is_crit": false,
 *     "match_status": "active"
 *   }
 * }
 */
export function rpcSubmitCombatAction(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Submit combat action called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.submit_combat_action,
    payload,
    'submit_combat_action'
  );
  if (!validation.success) {
    return createValidationErrorResponse('submit_combat_action', validation.error);
  }

  const action = validation.data;

  const matchObjects = nk.storageRead([
    {
      collection: 'pvp_matches',
      key: action.match_id,
      userId: ctx.userId,
    },
  ]);

  if (matchObjects.length === 0) {
    return JSON.stringify({
      error: 'Match not found',
    });
  }

  const match = JSON.parse(matchObjects[0].value);

  if (match.status !== 'active') {
    return JSON.stringify({
      error: 'Match is not active',
    });
  }

  if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
    return JSON.stringify({
      error: 'Not a participant in this match',
    });
  }

  const matchState = getOrCreateMatchState(nk, action.match_id, match, logger);

  if (matchState.current_turn_user_id !== ctx.userId) {
    return JSON.stringify({
      error: 'Not your turn',
    });
  }

  const result = processCombatAction(ctx.userId, action, match, matchState, nk, logger);

  saveMatchState(nk, matchState);

  if (result.winner) {
    updateMatchStatus(nk, match, result.winner);
  }

  return JSON.stringify({
    success: true,
    result: result,
  });
}

/**
 * Registers the get match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetMatchState(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_match_state', rpcGetMatchState);
}

/**
 * Retrieves the current state of a PvP match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with match state
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "match_id": "match_123",
 *   "turn": 3,
 *   "current_turn_user_id": "user_456",
 *   "creator_health": 75,
 *   "opponent_health": 50,
 *   ...
 * }
 */
export function rpcGetMatchState(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get match state called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_match_state, payload, 'get_match_state');
  if (!validation.success) {
    return createValidationErrorResponse('get_match_state', validation.error);
  }

  const request = validation.data;

  const stateObjects = nk.storageRead([
    {
      collection: 'pvp_match_states',
      key: request.match_id,
      userId: ctx.userId,
    },
  ]);

  if (stateObjects.length === 0) {
    return JSON.stringify({
      error: 'Match state not found',
    });
  }

  return stateObjects[0].value;
}

/**
 * Retrieves or creates match state for a PvP match.
 *
 * @param nk - Nakama server interface
 * @param matchId - Unique identifier for the match
 * @param match - PvP match data
 * @param logger - Nakama logger instance
 * @returns Current match state
 */
function getOrCreateMatchState(
  nk: Runtime.Nakama,
  matchId: string,
  match: PvPMatch,
  logger: Runtime.Logger
): MatchState {
  const stateObjects = nk.storageRead([
    {
      collection: 'pvp_match_states',
      key: matchId,
      userId: match.creator_id,
    },
  ]);

  if (stateObjects.length > 0) {
    return JSON.parse(stateObjects[0].value);
  }

  const creatorStats = getPlayerStats(nk, match.creator_id, logger);
  const opponentStats = getPlayerStats(nk, match.opponent_id, logger);

  const baseHealth = 100;
  const maxHealth = baseHealth + creatorStats.level * 10;

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
    status: 'active',
    log: [],
  };

  return matchState;
}

/**
 * Processes a combat action and calculates results.
 *
 * @param userId - ID of the player performing the action
 * @param action - Combat action data
 * @param match - PvP match data
 * @param matchState - Current match state
 * @param _nk - Nakama server interface
 * @param _logger - Nakama logger instance
 * @returns Combat result with hit/miss and damage calculations
 */
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
    match_status: 'active',
  };

  if (action.action_type === 'shoot') {
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
        timestamp: Date.now(),
      };

      matchState.log.push(logEntry);

      if (matchState.creator_health <= 0) {
        result.winner = matchState.opponent_id;
        result.match_status = 'completed';
        matchState.status = 'completed';
        matchState.winner = matchState.opponent_id;
      } else if (matchState.opponent_health <= 0) {
        result.winner = matchState.creator_id;
        result.match_status = 'completed';
        matchState.status = 'completed';
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
        timestamp: Date.now(),
      };

      matchState.log.push(logEntry);
    }
  }

  matchState.turn++;
  matchState.current_turn_user_id = isCreator ? matchState.opponent_id : matchState.creator_id;

  return result;
}

/**
 * Calculates whether an attack hits based on defender's dodge chance.
 *
 * @param attackerStats - Stats of the attacking player
 * @param defenderStats - Stats of the defending player
 * @returns True if attack hits, false if it misses
 */
function calculateHit(attackerStats: PlayerStats, defenderStats: PlayerStats): boolean {
  const dodgeChance = defenderStats.stats.dodge / 100.0;
  const hitChance = 1.0 - dodgeChance;
  const roll = Math.random();

  return roll <= hitChance;
}

/**
 * Calculates damage dealt based on attacker's attack and defender's defense.
 *
 * @param attackerStats - Stats of the attacking player
 * @param defenderStats - Stats of the defending player
 * @returns Calculated damage amount
 */
function calculateDamage(attackerStats: PlayerStats, defenderStats: PlayerStats): number {
  const baseDamage = 10 + attackerStats.stats.attack * 0.5;
  const defenseReduction = defenderStats.stats.defense * 0.3;
  const finalDamage = Math.max(1, baseDamage - defenseReduction);

  return Math.floor(finalDamage);
}

/**
 * Determines if an attack is a critical hit based on crit rate.
 *
 * @param critRate - Critical hit rate percentage
 * @returns True if attack is critical, false otherwise
 */
function calculateCrit(critRate: number): boolean {
  const critChance = critRate / 100.0;
  const roll = Math.random();

  return roll <= critChance;
}

/**
 * Retrieves player statistics for combat calculations.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve stats for
 * @param _logger - Nakama logger instance
 * @returns Player stats or default stats if not found
 */
function getPlayerStats(nk: Runtime.Nakama, userId: string, _logger: Runtime.Logger): PlayerStats {
  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return {
      level: 1,
      xp: 0,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5,
      },
    };
  }

  return JSON.parse(objects[0].value);
}

/**
 * Saves the current match state to storage.
 *
 * @param nk - Nakama server interface
 * @param matchState - Match state to save
 */
function saveMatchState(nk: Runtime.Nakama, matchState: MatchState): void {
  nk.storageWrite([
    {
      collection: 'pvp_match_states',
      key: matchState.match_id,
      userId: matchState.creator_id,
      value: JSON.stringify(matchState),
    },
  ]);
}

/**
 * Updates match status when a winner is determined.
 *
 * @param nk - Nakama server interface
 * @param match - PvP match data
 * @param winner - ID of the winning player
 */
function updateMatchStatus(nk: Runtime.Nakama, match: PvPMatch, winner: string): void {
  match.status = 'completed';
  match.winner = winner;
  match.updated_at = Date.now();

  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);
}
