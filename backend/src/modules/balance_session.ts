/**
 * Balance Session Module
 * @fileoverview Simulates balancing sessions with internal/simulated player cohorts.
 * Uses existing combat, gear, difficulty, and economy formulas to run PvE encounters,
 * PvP matchups, and economy simulations to identify balance issues and suggest adjustments.
 */

import { PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { getEnemyDamageMult } from './difficulty_scaling';
import { calculateDropRate } from './gear_system';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { WeaponTier } from './weapon_balance';
import { getXpForLevel } from './xp_manager';

// ==========================================
// Seeded PRNG (mulberry32)
// ==========================================

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==========================================
// Type Definitions
// ==========================================

export enum PlayerArchetype {
  NEW = 'new',
  MID = 'mid',
  VETERAN = 'veteran',
  ENDGAME = 'endgame',
}

export interface SimulatedPlayer {
  id: string;
  archetype: PlayerArchetype;
  level: number;
  baseStats: PlayerStats;
  gearStats: { attack: number; defense: number; dodge: number; crit_rate: number };
  effectiveStats: PlayerStats;
  weaponTier: WeaponTier;
}

export interface BalanceSessionConfig {
  cohortSize: number;
  pveIterations: number;
  pvpIterations: number;
  seed: number;
  difficulties: string[];
}

export interface PvECombatResult {
  playerId: string;
  playerLevel: number;
  playerArchetype: PlayerArchetype;
  difficulty: string;
  completed: boolean;
  turnsTaken: number;
  remainingHealth: number;
  totalHealth: number;
  starsEarned: number;
  bossDefeated: boolean;
  drops: SimulatedDrop[];
}

export interface PvPMatchResult {
  player1Id: string;
  player1Archetype: PlayerArchetype;
  player2Id: string;
  player2Archetype: PlayerArchetype;
  winnerId: string;
  winnerArchetype: PlayerArchetype;
  turnsTotal: number;
  player1RemainingHealth: number;
  player2RemainingHealth: number;
}

export interface SimulatedDrop {
  rarity: string;
  gearType: string;
  dropRateUsed: number;
  rollValue: number;
}

export interface PvESummary {
  totalRuns: number;
  completionRateByArchetype: Record<string, { rate: number; avgStars: number; avgTurns: number }>;
  completionRateByDifficulty: Record<string, { rate: number; avgStars: number }>;
  bossDefeatRate: number;
  averageHealthRemainingPercent: number;
}

export interface PvPSummary {
  totalMatches: number;
  winRateMatrix: Record<string, Record<string, number>>;
  averageTurnsPerMatch: number;
  upsetRate: number;
  dominantArchetype: string | null;
}

export interface EconomySummary {
  totalDrops: number;
  totalRuns: number;
  dropRateByRarity: Record<string, { observed: number; expected: number; deviation: number }>;
  averageDropsPerRun: number;
  estimatedRunsToRarity: Record<string, number>;
}

export interface BalanceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'pve' | 'pvp' | 'economy';
  description: string;
  evidence: string;
}

export interface ParameterAdjustment {
  module: string;
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
}

export interface BalanceSessionReport {
  sessionId: string;
  timestamp: number;
  config: BalanceSessionConfig;
  pve: PvESummary;
  pvp: PvPSummary;
  economy: EconomySummary;
  issues: BalanceIssue[];
  recommendations: string[];
  suggestedAdjustments: ParameterAdjustment[];
}

// ==========================================
// Constants
// ==========================================

const ARCHETYPE_LEVEL_RANGES: Record<PlayerArchetype, [number, number]> = {
  [PlayerArchetype.NEW]: [1, 10],
  [PlayerArchetype.MID]: [11, 20],
  [PlayerArchetype.VETERAN]: [21, 30],
  [PlayerArchetype.ENDGAME]: [31, 50],
};

const ARCHETYPE_WEAPON_TIER: Record<PlayerArchetype, WeaponTier> = {
  [PlayerArchetype.NEW]: WeaponTier.COMMON,
  [PlayerArchetype.MID]: WeaponTier.RARE,
  [PlayerArchetype.VETERAN]: WeaponTier.EPIC,
  [PlayerArchetype.ENDGAME]: WeaponTier.LEGENDARY,
};

const GEAR_TYPES = ['helm', 'armor', 'bow', 'arrow', 'amulet'] as const;

// Gear stat generation constants (mirrors gear_balance.ts MAX_STATS)
const GEAR_STAT_RANGES: Record<string, Record<string, [number, number]>> = {
  helm: { defense: [10, 50], health: [50, 250] },
  armor: { defense: [15, 75], health: [60, 300] },
  bow: { attack: [15, 75], crit_rate: [3, 15] },
  arrow: { attack: [10, 50], crit_rate: [2, 12] },
  amulet: { dodge: [3, 15], crit_rate: [2, 10] },
};

// Rarity stat multipliers (mirrors gear_system.ts RARITIES)
const RARITY_STAT_MULTIPLIER: Record<string, number> = {
  common: 1.0,
  rare: 1.5,
  epic: 1.8,
  legendary: 2.2,
};

// Rarity drop chances (mirrors gear_system.ts RARITIES)
const RARITY_DROP_CHANCES: Record<string, number> = {
  common: 0.6,
  rare: 0.25,
  epic: 0.1,
  legendary: 0.05,
};

const BASE_DROP_RATE = 0.4;

const MAX_PVE_TURNS = 50;
const MAX_PVP_TURNS = 50;
const PVP_DAMAGE_REDUCTION = 0.85;

// Stat growth per level for base player stats
const STAT_GROWTH = { attack: 2, defense: 2, dodge: 1, crit_rate: 0.5 };

// Base stats at level 1 (mirrors combat_system.ts defaults)
const BASE_STAT_VALUES = { attack: 10, defense: 10, dodge: 10, crit_rate: 5 };

// ==========================================
// Cohort Generation
// ==========================================

function generateBaseStats(level: number): PlayerStats {
  return {
    level,
    xp: getXpForLevel(level),
    stats: {
      attack: BASE_STAT_VALUES.attack + (level - 1) * STAT_GROWTH.attack,
      defense: BASE_STAT_VALUES.defense + (level - 1) * STAT_GROWTH.defense,
      dodge: BASE_STAT_VALUES.dodge + (level - 1) * STAT_GROWTH.dodge,
      crit_rate: BASE_STAT_VALUES.crit_rate + (level - 1) * STAT_GROWTH.crit_rate,
    },
  };
}

function archetypeToRarity(archetype: PlayerArchetype): string {
  const map: Record<PlayerArchetype, string> = {
    [PlayerArchetype.NEW]: 'common',
    [PlayerArchetype.MID]: 'rare',
    [PlayerArchetype.VETERAN]: 'epic',
    [PlayerArchetype.ENDGAME]: 'legendary',
  };
  return map[archetype];
}

function generateGearStats(
  archetype: PlayerArchetype,
  rng: () => number
): { attack: number; defense: number; dodge: number; crit_rate: number } {
  const rarityMultiplier = RARITY_STAT_MULTIPLIER[archetypeToRarity(archetype)];

  const gearStats = { attack: 0, defense: 0, dodge: 0, crit_rate: 0 };

  for (const gearType of GEAR_TYPES) {
    const statRanges = GEAR_STAT_RANGES[gearType];
    for (const [statName, [min, max]] of Object.entries(statRanges)) {
      const roll = min + rng() * (max - min);
      const value = roll * rarityMultiplier;
      if (statName in gearStats) {
        (gearStats as Record<string, number>)[statName] += value;
      }
    }
  }

  return gearStats;
}

function generateSimulatedPlayer(
  archetype: PlayerArchetype,
  index: number,
  rng: () => number
): SimulatedPlayer {
  const [minLevel, maxLevel] = ARCHETYPE_LEVEL_RANGES[archetype];
  const level = Math.floor(minLevel + rng() * (maxLevel - minLevel + 1));
  const baseStats = generateBaseStats(level);
  const gearStats = generateGearStats(archetype, rng);
  const weaponTier = ARCHETYPE_WEAPON_TIER[archetype];

  const effectiveStats: PlayerStats = {
    level: baseStats.level,
    xp: baseStats.xp,
    stats: {
      attack: baseStats.stats.attack + gearStats.attack,
      defense: baseStats.stats.defense + gearStats.defense,
      dodge: baseStats.stats.dodge + gearStats.dodge,
      crit_rate: baseStats.stats.crit_rate + gearStats.crit_rate,
    },
  };

  return {
    id: `sim_${archetype}_L${level}_${index}`,
    archetype,
    level,
    baseStats,
    gearStats,
    effectiveStats,
    weaponTier,
  };
}

function generateCohort(config: BalanceSessionConfig, rng: () => number): SimulatedPlayer[] {
  const players: SimulatedPlayer[] = [];
  for (const archetype of Object.values(PlayerArchetype)) {
    for (let i = 0; i < config.cohortSize; i++) {
      players.push(generateSimulatedPlayer(archetype, i, rng));
    }
  }
  return players;
}

// ==========================================
// Combat Simulation Helpers
// (mirrors combat_system.ts private functions exactly)
// ==========================================

function simulateHit(_attackerDodge: number, defenderDodge: number, rng: () => number): boolean {
  const dodgeChance = defenderDodge / 100.0;
  const hitChance = 1.0 - dodgeChance;
  return rng() <= hitChance;
}

function simulateDamage(attack: number, defense: number): number {
  const baseDamage = 10 + attack * 0.5;
  const defenseReduction = defense * 0.3;
  return Math.max(1, Math.floor(baseDamage - defenseReduction));
}

function simulateCrit(critRate: number, rng: () => number): boolean {
  return rng() <= critRate / 100.0;
}

function calculateHealth(level: number): number {
  return 100 + level * 10;
}

function calculateStars(remainingHealth: number, totalHealth: number): number {
  const pct = remainingHealth / totalHealth;
  if (pct > 0.7) return 3;
  if (pct > 0.4) return 2;
  if (pct > 0) return 1;
  return 0;
}

function rollRarity(rng: () => number): string {
  const roll = rng();
  let cumulative = 0;
  for (const [rarity, chance] of Object.entries(RARITY_DROP_CHANCES)) {
    cumulative += chance;
    if (roll <= cumulative) return rarity;
  }
  return 'common';
}

// ==========================================
// PvE Simulation
// ==========================================

function simulatePvECombat(
  player: SimulatedPlayer,
  difficulty: string,
  rng: () => number
): PvECombatResult {
  const playerHealth = calculateHealth(player.level);
  let currentHealth = playerHealth;

  const enemyMult = getEnemyDamageMult(player.level);
  const enemyAttack = (10 + player.level * 1.5) * enemyMult;
  const enemyDefense = 5 + player.level * 0.8;
  const enemyHealth = (50 + player.level * 15) * enemyMult;
  const enemyDodge = 5;
  let currentEnemyHealth = enemyHealth;

  const isBoss = rng() < 0.2;
  let turnsTaken = 0;

  while (currentHealth > 0 && currentEnemyHealth > 0 && turnsTaken < MAX_PVE_TURNS) {
    turnsTaken++;

    // Player attacks enemy
    const playerHit = simulateHit(player.effectiveStats.stats.dodge, enemyDodge, rng);
    if (playerHit) {
      let damage = simulateDamage(player.effectiveStats.stats.attack, enemyDefense);
      if (simulateCrit(player.effectiveStats.stats.crit_rate, rng)) {
        damage *= 2;
      }
      currentEnemyHealth = Math.max(0, currentEnemyHealth - damage);
    }

    if (currentEnemyHealth <= 0) break;

    // Enemy attacks player
    const enemyHit = simulateHit(enemyDodge, player.effectiveStats.stats.dodge, rng);
    if (enemyHit) {
      let damage = simulateDamage(enemyAttack, player.effectiveStats.stats.defense);
      if (rng() < 0.05) damage *= 1.5; // enemy crit (5%)
      currentHealth = Math.max(0, currentHealth - damage);
    }
  }

  const completed = currentEnemyHealth <= 0;
  const stars = completed ? calculateStars(currentHealth, playerHealth) : 0;

  // Simulate drops
  const dropRate = calculateDropRate(difficulty, isBoss);
  const drops: SimulatedDrop[] = [];
  if (completed) {
    const dropRoll = rng();
    if (dropRoll <= dropRate) {
      const rarity = rollRarity(rng);
      const gearType = GEAR_TYPES[Math.floor(rng() * GEAR_TYPES.length)];
      drops.push({ rarity, gearType, dropRateUsed: dropRate, rollValue: dropRoll });
    }
  }

  return {
    playerId: player.id,
    playerLevel: player.level,
    playerArchetype: player.archetype,
    difficulty,
    completed,
    turnsTaken,
    remainingHealth: currentHealth,
    totalHealth: playerHealth,
    starsEarned: stars,
    bossDefeated: isBoss && completed,
    drops,
  };
}

// ==========================================
// PvP Simulation
// ==========================================

function simulatePvpDamage(
  attacker: SimulatedPlayer,
  defender: SimulatedPlayer,
  rng: () => number
): number {
  // Mirrors combat_system.ts calculateDamage exactly
  let damage = simulateDamage(
    attacker.effectiveStats.stats.attack,
    defender.effectiveStats.stats.defense
  );

  // Apply PvP damage reduction (mirrors weapon_balance.ts)
  damage *= PVP_DAMAGE_REDUCTION;

  // Crit check
  if (simulateCrit(attacker.effectiveStats.stats.crit_rate, rng)) {
    damage *= 2;
  }

  return Math.max(1, Math.floor(damage));
}

function simulatePvPCombat(
  player1: SimulatedPlayer,
  player2: SimulatedPlayer,
  rng: () => number
): PvPMatchResult {
  const p1Health = calculateHealth(player1.level);
  const p2Health = calculateHealth(player2.level);
  let p1Current = p1Health;
  let p2Current = p2Health;
  let turnsTotal = 0;

  while (p1Current > 0 && p2Current > 0 && turnsTotal < MAX_PVP_TURNS) {
    turnsTotal++;

    // Player 1 attacks Player 2
    const p1Hit = simulateHit(
      player1.effectiveStats.stats.dodge,
      player2.effectiveStats.stats.dodge,
      rng
    );
    if (p1Hit) {
      const damage = simulatePvpDamage(player1, player2, rng);
      p2Current = Math.max(0, p2Current - damage);
    }

    if (p2Current <= 0) break;

    // Player 2 attacks Player 1
    const p2Hit = simulateHit(
      player2.effectiveStats.stats.dodge,
      player1.effectiveStats.stats.dodge,
      rng
    );
    if (p2Hit) {
      const damage = simulatePvpDamage(player2, player1, rng);
      p1Current = Math.max(0, p1Current - damage);
    }
  }

  const winnerId = p2Current <= 0 ? player1.id : player2.id;
  const winnerArchetype = p2Current <= 0 ? player1.archetype : player2.archetype;

  return {
    player1Id: player1.id,
    player1Archetype: player1.archetype,
    player2Id: player2.id,
    player2Archetype: player2.archetype,
    winnerId,
    winnerArchetype,
    turnsTotal,
    player1RemainingHealth: p1Current,
    player2RemainingHealth: p2Current,
  };
}

// ==========================================
// Economy Simulation
// ==========================================

function simulateEconomy(
  players: SimulatedPlayer[],
  config: BalanceSessionConfig,
  rng: () => number
): EconomySummary {
  const rarityCounts: Record<string, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  let totalDrops = 0;
  let totalRuns = 0;

  for (let p = 0; p < players.length; p++) {
    for (let i = 0; i < config.pveIterations; i++) {
      for (const difficulty of config.difficulties) {
        totalRuns++;
        const dropRate = calculateDropRate(difficulty, rng() < 0.2);
        const dropRoll = rng();
        if (dropRoll <= dropRate) {
          totalDrops++;
          const rarity = rollRarity(rng);
          rarityCounts[rarity]++;
        }
      }
    }
  }

  const dropRateByRarity: Record<
    string,
    { observed: number; expected: number; deviation: number }
  > = {};
  for (const [rarity, expectedChance] of Object.entries(RARITY_DROP_CHANCES)) {
    const observed = totalDrops > 0 ? rarityCounts[rarity] / totalDrops : 0;
    dropRateByRarity[rarity] = {
      observed,
      expected: expectedChance,
      deviation: observed - expectedChance,
    };
  }

  const estimatedRunsToRarity: Record<string, number> = {};
  for (const [rarity, chance] of Object.entries(RARITY_DROP_CHANCES)) {
    const overallDropRate = BASE_DROP_RATE; // medium difficulty baseline
    const rarityChance = overallDropRate * chance;
    estimatedRunsToRarity[rarity] = rarityChance > 0 ? Math.ceil(1 / rarityChance) : Infinity;
  }

  return {
    totalDrops,
    totalRuns,
    dropRateByRarity,
    averageDropsPerRun: totalRuns > 0 ? totalDrops / totalRuns : 0,
    estimatedRunsToRarity,
  };
}

// ==========================================
// Analysis Helpers (extracted to reduce complexity)
// ==========================================

interface ArchetypeAgg {
  completions: number;
  total: number;
  stars: number[];
  turns: number[];
}

interface DifficultyAgg {
  completions: number;
  total: number;
  stars: number[];
}

function aggregatePvEByArchetype(results: PvECombatResult[]): {
  agg: Record<string, ArchetypeAgg>;
  completedCount: number;
  totalHealthPct: number;
} {
  const agg: Record<string, ArchetypeAgg> = {};
  let completedCount = 0;
  let totalHealthPct = 0;

  for (const r of results) {
    if (!agg[r.playerArchetype]) {
      agg[r.playerArchetype] = { completions: 0, total: 0, stars: [], turns: [] };
    }
    agg[r.playerArchetype].total++;
    if (r.completed) {
      agg[r.playerArchetype].completions++;
      agg[r.playerArchetype].stars.push(r.starsEarned);
      agg[r.playerArchetype].turns.push(r.turnsTaken);
      completedCount++;
      totalHealthPct += r.remainingHealth / r.totalHealth;
    }
  }
  return { agg, completedCount, totalHealthPct };
}

function aggregatePvEByDifficulty(results: PvECombatResult[]): Record<string, DifficultyAgg> {
  const agg: Record<string, DifficultyAgg> = {};
  for (const r of results) {
    if (!agg[r.difficulty]) {
      agg[r.difficulty] = { completions: 0, total: 0, stars: [] };
    }
    agg[r.difficulty].total++;
    if (r.completed) {
      agg[r.difficulty].completions++;
      agg[r.difficulty].stars.push(r.starsEarned);
    }
  }
  return agg;
}

function average(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ==========================================
// Analysis and Reporting
// ==========================================

function analyzePvE(results: PvECombatResult[]): PvESummary {
  const { agg: byArch, completedCount, totalHealthPct } = aggregatePvEByArchetype(results);
  const byDiff = aggregatePvEByDifficulty(results);

  let bossDefeats = 0;
  for (const r of results) {
    if (r.bossDefeated) bossDefeats++;
  }

  const completionRateByArchetype: PvESummary['completionRateByArchetype'] = {};
  for (const [arch, data] of Object.entries(byArch)) {
    completionRateByArchetype[arch] = {
      rate: data.total > 0 ? data.completions / data.total : 0,
      avgStars: average(data.stars),
      avgTurns: average(data.turns),
    };
  }

  const completionRateByDifficulty: PvESummary['completionRateByDifficulty'] = {};
  for (const [diff, data] of Object.entries(byDiff)) {
    completionRateByDifficulty[diff] = {
      rate: data.total > 0 ? data.completions / data.total : 0,
      avgStars: average(data.stars),
    };
  }

  return {
    totalRuns: results.length,
    completionRateByArchetype,
    completionRateByDifficulty,
    bossDefeatRate: results.length > 0 ? bossDefeats / results.length : 0,
    averageHealthRemainingPercent: completedCount > 0 ? totalHealthPct / completedCount : 0,
  };
}

const ARCHETYPE_ORDER = [
  PlayerArchetype.NEW,
  PlayerArchetype.MID,
  PlayerArchetype.VETERAN,
  PlayerArchetype.ENDGAME,
];

function countUpset(r: PvPMatchResult): boolean {
  const p1Idx = ARCHETYPE_ORDER.indexOf(r.player1Archetype);
  const p2Idx = ARCHETYPE_ORDER.indexOf(r.player2Archetype);
  return (
    (r.winnerId === r.player1Id && p1Idx < p2Idx) || (r.winnerId === r.player2Id && p2Idx < p1Idx)
  );
}

function findDominantArchetype(
  matchups: Record<string, Record<string, { wins: number; total: number }>>
): string | null {
  let dominantArchetype: string | null = null;
  let bestWinRate = 0;
  for (const archetype of ARCHETYPE_ORDER) {
    const opponents = matchups[archetype];
    if (!opponents) continue;
    let totalWins = 0;
    let totalMatches = 0;
    for (const data of Object.values(opponents)) {
      totalWins += data.wins;
      totalMatches += data.total;
    }
    const winRate = totalMatches > 0 ? totalWins / totalMatches : 0;
    if (winRate > bestWinRate) {
      bestWinRate = winRate;
      dominantArchetype = archetype;
    }
  }
  return dominantArchetype;
}

function buildWinRateMatrix(
  matchups: Record<string, Record<string, { wins: number; total: number }>>
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const [a1, opponents] of Object.entries(matchups)) {
    matrix[a1] = {};
    for (const [a2, data] of Object.entries(opponents)) {
      matrix[a1][a2] = data.total > 0 ? data.wins / data.total : 0;
    }
  }
  return matrix;
}

function analyzePvP(results: PvPMatchResult[]): PvPSummary {
  const matchups: Record<string, Record<string, { wins: number; total: number }>> = {};
  let totalTurns = 0;
  let upsets = 0;

  for (const r of results) {
    if (!matchups[r.player1Archetype]) matchups[r.player1Archetype] = {};
    if (!matchups[r.player1Archetype][r.player2Archetype]) {
      matchups[r.player1Archetype][r.player2Archetype] = { wins: 0, total: 0 };
    }
    matchups[r.player1Archetype][r.player2Archetype].total++;
    if (r.winnerId === r.player1Id) {
      matchups[r.player1Archetype][r.player2Archetype].wins++;
    }
    totalTurns += r.turnsTotal;
    if (countUpset(r)) upsets++;
  }

  const winRateMatrix = buildWinRateMatrix(matchups);
  const dominantArchetype = findDominantArchetype(matchups);

  return {
    totalMatches: results.length,
    winRateMatrix,
    averageTurnsPerMatch: results.length > 0 ? totalTurns / results.length : 0,
    upsetRate: results.length > 0 ? upsets / results.length : 0,
    dominantArchetype,
  };
}

function identifyPvEIssues(pve: PvESummary, issues: BalanceIssue[]): void {
  for (const [archetype, data] of Object.entries(pve.completionRateByArchetype)) {
    if (data.rate < 0.3) {
      issues.push({
        severity: 'critical',
        category: 'pve',
        description: `${archetype} players have very low completion rate (${(data.rate * 100).toFixed(1)}%)`,
        evidence: `Completion rate: ${(data.rate * 100).toFixed(1)}%, average stars: ${data.avgStars.toFixed(1)}`,
      });
    } else if (data.rate < 0.5) {
      issues.push({
        severity: 'warning',
        category: 'pve',
        description: `${archetype} players have below-target completion rate (${(data.rate * 100).toFixed(1)}%)`,
        evidence: `Completion rate: ${(data.rate * 100).toFixed(1)}%, average stars: ${data.avgStars.toFixed(1)}`,
      });
    } else if (data.rate > 0.95) {
      issues.push({
        severity: 'warning',
        category: 'pve',
        description: `${archetype} players have very high completion rate (${(data.rate * 100).toFixed(1)}%) - may be too easy`,
        evidence: `Completion rate: ${(data.rate * 100).toFixed(1)}%, average stars: ${data.avgStars.toFixed(1)}`,
      });
    }
  }

  for (const [difficulty, data] of Object.entries(pve.completionRateByDifficulty)) {
    if (data.rate < 0.2) {
      issues.push({
        severity: 'critical',
        category: 'pve',
        description: `${difficulty} difficulty has very low completion rate (${(data.rate * 100).toFixed(1)}%)`,
        evidence: `Difficulty: ${difficulty}, rate: ${(data.rate * 100).toFixed(1)}%`,
      });
    }
  }
}

function identifyPvPIssues(pvp: PvPSummary, issues: BalanceIssue[]): void {
  const archetypes = Object.values(PlayerArchetype);
  for (const a1 of archetypes) {
    for (const a2 of archetypes) {
      const winRate = pvp.winRateMatrix[a1]?.[a2];
      if (winRate === undefined || a1 === a2) continue;

      if (winRate > 0.75) {
        issues.push({
          severity: 'critical',
          category: 'pvp',
          description: `${a1} dominates ${a2} with ${(winRate * 100).toFixed(1)}% win rate`,
          evidence: `Matchup ${a1} vs ${a2}: ${(winRate * 100).toFixed(1)}% win rate for ${a1}`,
        });
      } else if (winRate > 0.65) {
        issues.push({
          severity: 'warning',
          category: 'pvp',
          description: `${a1} has strong advantage over ${a2} (${(winRate * 100).toFixed(1)}% win rate)`,
          evidence: `Matchup ${a1} vs ${a2}: ${(winRate * 100).toFixed(1)}% win rate for ${a1}`,
        });
      }
    }
  }

  if (pvp.upsetRate < 0.05) {
    issues.push({
      severity: 'info',
      category: 'pvp',
      description: 'Very low upset rate suggests gear/level advantage is too deterministic',
      evidence: `Upset rate: ${(pvp.upsetRate * 100).toFixed(1)}%`,
    });
  }
}

function identifyEconomyIssues(economy: EconomySummary, issues: BalanceIssue[]): void {
  for (const [rarity, data] of Object.entries(economy.dropRateByRarity)) {
    const deviationPct = Math.abs(data.deviation) * 100;
    if (deviationPct > 10) {
      issues.push({
        severity: 'warning',
        category: 'economy',
        description: `${rarity} drop rate deviates significantly from expected (${deviationPct.toFixed(1)}% off)`,
        evidence: `Observed: ${(data.observed * 100).toFixed(1)}%, expected: ${(data.expected * 100).toFixed(1)}%`,
      });
    }
  }
}

function identifyIssues(pve: PvESummary, pvp: PvPSummary, economy: EconomySummary): BalanceIssue[] {
  const issues: BalanceIssue[] = [];
  identifyPvEIssues(pve, issues);
  identifyPvPIssues(pvp, issues);
  identifyEconomyIssues(economy, issues);
  return issues;
}

function generateRecommendations(issues: BalanceIssue[]): string[] {
  return issues.map((issue) => {
    switch (issue.category) {
      case 'pve':
        if (issue.description.includes('low completion rate')) {
          return `PvE: Reduce enemy scaling or increase player stat growth for ${issue.description.split(' ')[0]} tier players`;
        }
        if (issue.description.includes('high completion rate')) {
          return `PvE: Increase enemy difficulty scaling or reduce player power for ${issue.description.split(' ')[0]} tier players`;
        }
        if (issue.description.includes('difficulty')) {
          return 'PvE: Adjust difficulty multiplier for the affected difficulty level';
        }
        return 'PvE: Review encounter balance for the affected tier';
      case 'pvp':
        if (issue.description.includes('dominates') || issue.description.includes('advantage')) {
          return 'PvP: Narrow the power gap between gear tiers via diminishing returns or matchmaking adjustments';
        }
        if (issue.description.includes('upset rate')) {
          return 'PvP: Introduce more variance mechanics to allow lower-tier upsets (e.g., dodge/crit randomness)';
        }
        return 'PvP: Review matchup balance across gear tiers';
      case 'economy':
        return 'Economy: Adjust drop rate tables to bring observed rates closer to expected values';
      default:
        return 'Review balance parameters';
    }
  });
}

function suggestAdjustments(pve: PvESummary, pvp: PvPSummary): ParameterAdjustment[] {
  const adjustments: ParameterAdjustment[] = [];

  const endgameRate = pve.completionRateByArchetype[PlayerArchetype.ENDGAME]?.rate;
  if (endgameRate !== undefined && endgameRate > 0.95) {
    adjustments.push({
      module: 'difficulty_scaling',
      parameter: 'getEnemyDamageMult late-game scaling',
      currentValue: 2.0,
      suggestedValue: 2.3,
      reason: `Endgame completion rate is ${(endgameRate * 100).toFixed(1)}%, suggesting enemies are too weak`,
    });
  }

  const newRate = pve.completionRateByArchetype[PlayerArchetype.NEW]?.rate;
  if (newRate !== undefined && newRate < 0.5) {
    adjustments.push({
      module: 'difficulty_scaling',
      parameter: 'getEnemyDamageMult early-game scaling',
      currentValue: 0.8,
      suggestedValue: 0.7,
      reason: `New player completion rate is ${(newRate * 100).toFixed(1)}%, suggesting early game is too hard`,
    });
  }

  if (pvp.dominantArchetype === PlayerArchetype.ENDGAME) {
    const endgameVsNew = pvp.winRateMatrix[PlayerArchetype.ENDGAME]?.[PlayerArchetype.NEW];
    if (endgameVsNew !== undefined && endgameVsNew > 0.85) {
      adjustments.push({
        module: 'weapon_balance',
        parameter: 'TIER_MULTIPLIERS legendary',
        currentValue: 2.0,
        suggestedValue: 1.8,
        reason: `Endgame vs new player win rate is ${(endgameVsNew * 100).toFixed(1)}%, legendary multiplier may be too high`,
      });
    }
  }

  return adjustments;
}

// ==========================================
// Session Runner
// ==========================================

export function runBalanceSession(config: BalanceSessionConfig): BalanceSessionReport {
  const rng = createRng(config.seed);

  // Generate cohort
  const players = generateCohort(config, rng);

  // Run PvE simulations
  const pveResults: PvECombatResult[] = [];
  for (const player of players) {
    for (let i = 0; i < config.pveIterations; i++) {
      for (const difficulty of config.difficulties) {
        pveResults.push(simulatePvECombat(player, difficulty, rng));
      }
    }
  }

  // Run PvP simulations
  const pvpResults: PvPMatchResult[] = [];
  const archetypes = Object.values(PlayerArchetype);
  for (const a1 of archetypes) {
    const players1 = players.filter((p) => p.archetype === a1);
    for (const a2 of archetypes) {
      const players2 = players.filter((p) => p.archetype === a2);
      for (let i = 0; i < config.pvpIterations; i++) {
        const p1 = players1[Math.floor(rng() * players1.length)];
        const p2 = players2[Math.floor(rng() * players2.length)];
        if (p1 && p2) {
          pvpResults.push(simulatePvPCombat(p1, p2, rng));
        }
      }
    }
  }

  // Run economy simulation
  const economy = simulateEconomy(players, config, rng);

  // Analyze results
  const pve = analyzePvE(pveResults);
  const pvp = analyzePvP(pvpResults);

  // Generate report
  const issues = identifyIssues(pve, pvp, economy);
  const recommendations = generateRecommendations(issues);
  const suggestedAdjustments = suggestAdjustments(pve, pvp);

  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    config,
    pve,
    pvp,
    economy,
    issues,
    recommendations,
    suggestedAdjustments,
  };
}

// ==========================================
// RPC Registration
// ==========================================

export function registerRpcRunBalanceSession(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/run_balance_session',
    'run_balance_session',
    rpcRunBalanceSession
  );
}

async function rpcRunBalanceSession(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Run balance session called');

  const validation = validatePayload(
    ZodSchemas.run_balance_session,
    payload,
    'run_balance_session'
  );

  if (!validation.success) {
    return createValidationErrorResponse(
      'run_balance_session',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as Record<string, unknown>;

  const config: BalanceSessionConfig = {
    cohortSize: typeof data.cohort_size === 'number' ? data.cohort_size : 50,
    pveIterations: typeof data.pve_iterations === 'number' ? data.pve_iterations : 10,
    pvpIterations: typeof data.pvp_iterations === 'number' ? data.pvp_iterations : 100,
    seed: typeof data.seed === 'number' ? data.seed : Date.now(),
    difficulties: Array.isArray(data.difficulties)
      ? (data.difficulties as string[])
      : ['easy', 'medium', 'hard', 'nightmare'],
  };

  try {
    const report = runBalanceSession(config);
    logger.info('Balance session completed: %s', report.sessionId);
    return JSON.stringify({ success: true, report });
  } catch (error) {
    logger.error('Balance session failed: %s', String(error));
    return JSON.stringify({ success: false, error: 'Balance session failed' });
  }
}
