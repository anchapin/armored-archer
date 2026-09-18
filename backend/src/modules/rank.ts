/**
 * Rank helpers shared between matchmaker and season_leaderboard.
 *
 * @fileoverview Pure, stateless Power-Rating derivation. Extracted from
 * matchmaker.ts to break the matchmaker ↔ season_leaderboard ↔ season_system
 * import cycle (issue #1086). The function only depends on `PlayerStats`,
 * so it has no runtime coupling to either module — placing it here makes
 * the dependency graph acyclic and lets both modules import rank without
 * transitively pulling in each other.
 *
 * IMPORTANT: do not add module-level imports to anything other than
 * `../types/game` here. If this file grows runtime dependencies, the
 * boundary rule in `eslint.config.js` will lose its meaning.
 */

import { PlayerStats } from '../types/game';

/**
 * Calculates a player's rank based on level and stats.
 *
 * This is the Power Rating derivation (build strength). It is recomputed
 * from player_stats on every use — matchmaking, punch-up eligibility,
 * and the consolidated get_player_rank RPC in season_leaderboard (which
 * exposes it as the explicit `power_rating` response field, issue #871).
 * It is never persisted and never decays (issue #865).
 *
 * @param playerStats - Player statistics data
 * @returns Calculated player rank
 */
export function calculateRank(playerStats: PlayerStats): number {
  const baseRank = playerStats.level * 10;
  const statsTotal =
    playerStats.stats.attack +
    playerStats.stats.defense +
    playerStats.stats.dodge +
    playerStats.stats.crit_rate;

  return Math.floor(baseRank + statsTotal / 4);
}
