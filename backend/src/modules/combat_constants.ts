/**
 * Combat Constants module.
 * @fileoverview Single source of truth for combat and damage-math constants.
 *
 * Why this file exists
 * --------------------
 * The combat system is server-authoritative (AGENTS.md §"Architecture Notes";
 * ADR-0002; ADR-0005). Any change to how damage, crits, or starting health are
 * computed must be made **here**, in this one file, so that:
 *
 *   1. The server and any future server-driven client consumes the *same*
 *      numbers — there is one truth.
 *   2. A balance change does not silently drift across re-implementations.
 *   3. The boundary ratifying the contract (ADR-0007) has an artifact to point
 *      at, not just prose.
 *
 * This module is consumed by `combat_system.ts` and `rpg_system.ts` (via
 * `export * from './combat_constants'` re-exports) so existing callers that
 * import those modules keep working without code changes. New server-side
 * callers should import from this module directly.
 *
 * What is NOT in this file
 * ------------------------
 * - Gear-tier multipliers (`TIER_MULTIPLIERS`) and per-tier `BASE_DAMAGES`
 *   live in `weapon_balance.ts` (those are catalog data, not damage math).
 * - Stat growth per level (`STAT_GROWTH`) lives in `balance_session.ts`
 *   (that is progression tuning, not damage math).
 * - Per-stat point cost and respec pricing live in `rpg_system.ts`.
 *
 * What IS in this file
 * --------------------
 * The coefficients used by `calculateDamage` / `calculateCrit` /
 * `processCombatAction` in `combat_system.ts` (and mirrored, with the same
 * numbers, in `balance_session.ts` and `weapon_balance.ts`). ADR-0007 ratifies
 * that these are the canonical values; the inline magic numbers in those
 * other files are documented follow-up refactor targets.
 *
 * Cross-references: ADR-0002 (server-declared match settlement);
 * ADR-0005 (combat authority boundary); ADR-0007 (this file's contract).
 */

// ---------------------------------------------------------------------------
// Damage math (server-authoritative)
// ---------------------------------------------------------------------------

/**
 * Additive base damage before per-stat coefficients are applied. The current
 * damage formula is:
 *
 *   base_damage      = BASE_DAMAGE + attack * ATTACK_DAMAGE_COEFFICIENT
 *   damage_reduction = defense * DEFENSE_REDUCTION_COEFFICIENT
 *   final_damage     = max(MIN_DAMAGE, floor(base_damage - damage_reduction))
 *
 * If a crit lands, the final damage is multiplied by `CRIT_DAMAGE_MULTIPLIER`.
 *
 * Currently used by:
 *   - combat_system.ts  : calculateDamage()        (the canonical site)
 *   - balance_session.ts: per-turn preview damage (duplicate, followup refactor)
 *   - weapon_balance.ts : PvP damage curve input  (duplicate, followup refactor)
 */
export const BASE_DAMAGE = 10;

/**
 * Multiplier converting the attacker's `attack` stat into damage. Used by
 *   - combat_system.ts:   `baseDamage = 10 + attack * 0.5`
 *   - balance_session.ts: `baseDamage = 10 + attack * 0.5`
 *   - weapon_balance.ts:  `pvpDamage += weapon_stats.attack * 0.5`
 */
export const ATTACK_DAMAGE_COEFFICIENT = 0.5;

/**
 * Multiplier converting the defender's `defense` stat into damage reduction.
 * Used by:
 *   - combat_system.ts:   `defenseReduction = defense * 0.3`
 *   - balance_session.ts: `defenseReduction = defense * 0.3`
 *
 * (weapon_balance.ts uses the same `0.3` multiplier for `ability_power`; that
 * is a different physical quantity but the same magic number, and is on the
 * follow-up list to disambiguate rather than re-use.)
 */
export const DEFENSE_REDUCTION_COEFFICIENT = 0.3;

/**
 * Multiplier applied to damage when a critical hit lands.
 * Used by:
 *   - combat_system.ts:  `finalDamage = isCrit ? damage * 2 : damage`
 *   - weapon_balance.ts: `powerRating += stats.critical_damage * 2`
 *                       (same magic number, different physical quantity —
 *                       followup refactor.)
 */
export const CRIT_DAMAGE_MULTIPLIER = 2;

/**
 * Floor on final damage — even a fully-defended hit does 1 damage. Prevents
 * "immortal" defender stacks from turning the duel into a stalemate.
 * Used by:
 *   - combat_system.ts:   `Math.max(1, baseDamage - defenseReduction)`
 *   - balance_session.ts: `Math.max(1, Math.floor(baseDamage - defenseReduction))`
 */
export const MIN_DAMAGE = 1;

// ---------------------------------------------------------------------------
// Health (combat-adjacent — kept here because it is computed in the same
// turn-resolution path and shares the "server-only" contract).
// ---------------------------------------------------------------------------

/**
 * Starting health for a fresh level-1 player in a PvP match. Health at level
 * `L` is `BASE_HEALTH + L * HEALTH_PER_LEVEL`, capped at `MAX_HEALTH`.
 */
export const BASE_HEALTH = 100;

/**
 * Per-level health increment. Combined with `BASE_HEALTH`:
 *   max_health(L) = BASE_HEALTH + L * HEALTH_PER_LEVEL
 * (then clamped at `MAX_HEALTH`).
 */
export const HEALTH_PER_LEVEL = 10;

/**
 * Hard cap on per-match max-health, regardless of level. Defends against
 * runaway scaling if a player reaches an unexpected level band.
 */
export const MAX_HEALTH = 9999;
