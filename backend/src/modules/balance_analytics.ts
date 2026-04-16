/**
 * Balance Analytics Module.
 * @fileoverview Provides analytics for game balance decisions including drop distribution
 * and stage completion rates to help the team make data-driven tuning decisions.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// ==========================================
// Data Structures
// ==========================================

/**
 * Drop record for tracking gear drops by rarity and source.
 */
interface DropRecord {
  id: string;
  userId: string;
  timestamp: number;
  stageId: string;
  stagePrefix: string;
  difficulty: string;
  bossDefeated: boolean;
  gearRarity: string;
  gearType: string;
  gearId: string;
  dropRateUsed: number;
  rollValue: number;
}

/**
 * Stage attempt record for tracking completion rates.
 */
interface StageAttemptRecord {
  id: string;
  userId: string;
  timestamp: number;
  stageId: string;
  stagePrefix: string;
  difficulty: string;
  bossDefeated: boolean;
  completed: boolean;
  starsEarned: number;
  score: number;
  attemptNumber: number;
}

/**
 * Aggregated drop statistics.
 */
interface DropStatistics {
  totalDrops: number;
  totalAttempts: number;
  dropRate: number;
  byRarity: {
    [rarity: string]: {
      count: number;
      percentage: number;
      expectedPercentage: number;
      deviation: number;
    };
  };
  byDifficulty: {
    [difficulty: string]: {
      attempts: number;
      drops: number;
      dropRate: number;
    };
  };
  byStage: {
    [stageId: string]: {
      attempts: number;
      drops: number;
      dropRate: number;
      byRarity: { [rarity: string]: number };
    };
  };
  bossBonusDrops: {
    attempts: number;
    drops: number;
    dropRate: number;
  };
  timestamp: number;
}

/**
 * Aggregated stage completion statistics.
 */
interface StageCompletionStatistics {
  totalAttempts: number;
  totalCompletions: number;
  overallCompletionRate: number;
  byStage: {
    [stageId: string]: {
      attempts: number;
      completions: number;
      completionRate: number;
      averageStars: number;
      averageScore: number;
      difficulty: string;
    };
  };
  byDifficulty: {
    [difficulty: string]: {
      attempts: number;
      completions: number;
      completionRate: number;
      averageStars: number;
    };
  };
  byChapter: {
    [chapterId: string]: {
      totalStages: number;
      totalAttempts: number;
      totalCompletions: number;
      completionRate: number;
      stages: string[];
    };
  };
  bossStages: {
    attempts: number;
    completions: number;
    completionRate: number;
  };
  timestamp: number;
}

/**
 * Balance insights and recommendations.
 */
interface BalanceInsights {
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
  };
  drops: {
    summary: DropStatistics;
    issues: string[];
    recommendations: string[];
  };
  stages: {
    summary: StageCompletionStatistics;
    issues: string[];
    recommendations: string[];
  };
}

// ==========================================
// Storage Constants
// ==========================================

const DROPS_COLLECTION = 'balance_drops';
const STAGE_ATTEMPTS_COLLECTION = 'balance_stage_attempts';
const MAX_RECENT_DROPS = 100000;
const MAX_RECENT_ATTEMPTS = 100000;

// ==========================================
// In-Memory Storage (with persistence)
// ==========================================

const recentDrops: DropRecord[] = [];
const recentStageAttempts: StageAttemptRecord[] = [];
const dropStatsCache: Map<string, { data: DropStatistics; timestamp: number }> = new Map();
const stageStatsCache: Map<string, { data: StageCompletionStatistics; timestamp: number }> =
  new Map();

// ==========================================
// Expected Drop Rates (from gear_system.ts)
// ==========================================

const EXPECTED_DROP_RATES: { [rarity: string]: number } = {
  common: 0.6,
  rare: 0.25,
  epic: 0.1,
  legendary: 0.05,
};

// ==========================================
// Registration
// ==========================================

export function registerBalanceAnalyticsEndpoints(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/record_drop', 'record_drop', rpcRecordDrop);

  registerRpcWithMetrics(
    initializer,
    'armored_archer/record_stage_attempt',
    'record_stage_attempt',
    rpcRecordStageAttempt
  );

  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_drop_statistics',
    'get_drop_statistics',
    rpcGetDropStatistics
  );

  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_stage_completion_statistics',
    'get_stage_completion_statistics',
    rpcGetStageCompletionStatistics
  );

  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_balance_insights',
    'get_balance_insights',
    rpcGetBalanceInsights
  );
}

// ==========================================
// Internal Functions
// ==========================================

/**
 * Records a drop event.
 */
export async function recordDrop(
  nk: Runtime.Nakama,
  record: Omit<DropRecord, 'id'>
): Promise<void> {
  const dropRecord: DropRecord = {
    ...record,
    id: `drop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  // Add to in-memory storage
  recentDrops.push(dropRecord);
  if (recentDrops.length > MAX_RECENT_DROPS) {
    recentDrops.shift();
  }

  // Invalidate cache
  dropStatsCache.clear();

  // Persist to Nakama storage
  try {
    await nk.storageWrite([
      {
        collection: DROPS_COLLECTION,
        key: dropRecord.id,
        value: JSON.stringify(dropRecord),
        userId: record.userId,
      },
    ]);
  } catch (error) {
    logger.error('Failed to persist drop record', { error, dropId: dropRecord.id });
  }

  // Log audit
  logAudit(
    nk,
    record.userId,
    null,
    'balance_drop_recorded',
    'balance_analytics',
    {
      stageId: record.stageId,
      difficulty: record.difficulty,
      gearRarity: record.gearRarity,
      gearType: record.gearType,
      dropRateUsed: record.dropRateUsed,
    },
    'success'
  );
}

/**
 * Records a stage attempt event.
 */
export async function recordStageAttempt(
  nk: Runtime.Nakama,
  record: Omit<StageAttemptRecord, 'id'>
): Promise<void> {
  const attemptRecord: StageAttemptRecord = {
    ...record,
    id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  // Add to in-memory storage
  recentStageAttempts.push(attemptRecord);
  if (recentStageAttempts.length > MAX_RECENT_ATTEMPTS) {
    recentStageAttempts.shift();
  }

  // Invalidate cache
  stageStatsCache.clear();

  // Persist to Nakama storage
  try {
    await nk.storageWrite([
      {
        collection: STAGE_ATTEMPTS_COLLECTION,
        key: attemptRecord.id,
        value: JSON.stringify(attemptRecord),
        userId: record.userId,
      },
    ]);
  } catch (error) {
    logger.error('Failed to persist stage attempt record', {
      error,
      attemptId: attemptRecord.id,
    });
  }

  // Log audit
  logAudit(
    nk,
    record.userId,
    null,
    'balance_stage_attempt_recorded',
    'balance_analytics',
    {
      stageId: record.stageId,
      difficulty: record.difficulty,
      completed: record.completed,
      starsEarned: record.starsEarned,
      score: record.score,
    },
    'success'
  );
}

/**
 * Calculates drop statistics from recorded drops.
 */
export function calculateDropStatistics(startTime?: number, endTime?: number): DropStatistics {
  const now = Date.now();
  const start = startTime ?? now - 86400000; // Default to last 24 hours
  const end = endTime ?? now;

  // Filter drops by time range
  const filteredDrops = recentDrops.filter((d) => d.timestamp >= start && d.timestamp <= end);

  // Also load from storage if needed for longer time ranges
  // (simplified for this implementation - in production, use proper database queries)

  const stats: DropStatistics = {
    totalDrops: filteredDrops.length,
    totalAttempts: 0,
    dropRate: 0,
    byRarity: {},
    byDifficulty: {},
    byStage: {},
    bossBonusDrops: {
      attempts: 0,
      drops: 0,
      dropRate: 0,
    },
    timestamp: now,
  };

  // Initialize rarity stats
  for (const rarity of Object.keys(EXPECTED_DROP_RATES)) {
    stats.byRarity[rarity] = {
      count: 0,
      percentage: 0,
      expectedPercentage: EXPECTED_DROP_RATES[rarity] * 100,
      deviation: 0,
    };
  }

  // Process drops
  const difficultyStats: Map<string, { attempts: number; drops: number }> = new Map();
  const stageStats: Map<
    string,
    { attempts: number; drops: number; byRarity: Map<string, number> }
  > = new Map();

  for (const drop of filteredDrops) {
    // Count rarity
    if (stats.byRarity[drop.gearRarity]) {
      stats.byRarity[drop.gearRarity].count++;
    }

    // Process drop record using helper
    processDropRecord(drop, difficultyStats, stageStats, stats.bossBonusDrops);
  }

  // Calculate total attempts from stage attempts (for non-dropped rolls)
  const relevantAttempts = recentStageAttempts.filter(
    (a) => a.timestamp >= start && a.timestamp <= end && a.completed
  );

  stats.totalAttempts = relevantAttempts.length;
  stats.dropRate = stats.totalAttempts > 0 ? stats.totalDrops / stats.totalAttempts : 0;

  // Calculate rarity percentages and deviations
  if (stats.totalDrops > 0) {
    for (const data of Object.values(stats.byRarity)) {
      data.percentage = (data.count / stats.totalDrops) * 100;
      data.deviation = data.percentage - data.expectedPercentage;
    }
  }

  // Populate difficulty stats
  for (const [difficulty, data] of difficultyStats) {
    stats.byDifficulty[difficulty] = {
      attempts: data.attempts,
      drops: data.drops,
      dropRate: data.attempts > 0 ? data.drops / data.attempts : 0,
    };
  }

  // Populate stage stats
  for (const [stageId, data] of stageStats) {
    const stageDrops = Object.fromEntries(data.byRarity);
    stats.byStage[stageId] = {
      attempts: data.attempts,
      drops: data.drops,
      dropRate: data.attempts > 0 ? data.drops / data.attempts : 0,
      byRarity: stageDrops,
    };
  }

  // Calculate boss bonus drop rate
  if (stats.bossBonusDrops.attempts > 0) {
    stats.bossBonusDrops.dropRate = stats.bossBonusDrops.drops / stats.bossBonusDrops.attempts;
  }

  return stats;
}

/**
 * Calculates stage completion statistics from recorded attempts.
 */
export function calculateStageCompletionStatistics(
  startTime?: number,
  endTime?: number
): StageCompletionStatistics {
  const now = Date.now();
  const start = startTime ?? now - 86400000; // Default to last 24 hours
  const end = endTime ?? now;

  // Filter attempts by time range
  const filteredAttempts = recentStageAttempts.filter(
    (a) => a.timestamp >= start && a.timestamp <= end
  );

  const stats: StageCompletionStatistics = {
    totalAttempts: filteredAttempts.length,
    totalCompletions: 0,
    overallCompletionRate: 0,
    byStage: {},
    byDifficulty: {},
    byChapter: {},
    bossStages: {
      attempts: 0,
      completions: 0,
      completionRate: 0,
    },
    timestamp: now,
  };

  const stageData: Map<
    string,
    { attempts: number; completions: number; stars: number[]; scores: number[]; difficulty: string }
  > = new Map();
  const difficultyData: Map<string, { attempts: number; completions: number; stars: number[] }> =
    new Map();
  const chapterData: Map<
    string,
    { totalStages: Set<string>; attempts: number; completions: number }
  > = new Map();

  const totalCompletionsRef = { value: 0 };

  for (const attempt of filteredAttempts) {
    processStageAttempt(
      attempt,
      stageData,
      difficultyData,
      chapterData,
      stats.bossStages,
      totalCompletionsRef
    );
  }

  stats.totalCompletions = totalCompletionsRef.value;

  // Calculate overall completion rate
  stats.overallCompletionRate =
    stats.totalAttempts > 0 ? stats.totalCompletions / stats.totalAttempts : 0;

  // Populate stage stats
  for (const [stageId, data] of stageData) {
    const avgStars = calculateAverage(data.stars);
    const avgScore = calculateAverage(data.scores);

    stats.byStage[stageId] = {
      attempts: data.attempts,
      completions: data.completions,
      completionRate: data.attempts > 0 ? data.completions / data.attempts : 0,
      averageStars: avgStars,
      averageScore: avgScore,
      difficulty: data.difficulty,
    };
  }

  // Populate difficulty stats
  for (const [difficulty, data] of difficultyData) {
    const avgStars = calculateAverage(data.stars);

    stats.byDifficulty[difficulty] = {
      attempts: data.attempts,
      completions: data.completions,
      completionRate: data.attempts > 0 ? data.completions / data.attempts : 0,
      averageStars: avgStars,
    };
  }

  // Populate chapter stats
  for (const [chapterId, data] of chapterData) {
    stats.byChapter[chapterId] = {
      totalStages: data.totalStages.size,
      totalAttempts: data.attempts,
      totalCompletions: data.completions,
      completionRate: data.attempts > 0 ? data.completions / data.attempts : 0,
      stages: Array.from(data.totalStages),
    };
  }

  // Calculate boss completion rate
  if (stats.bossStages.attempts > 0) {
    stats.bossStages.completionRate = stats.bossStages.completions / stats.bossStages.attempts;
  }

  return stats;
}

// ==========================================
// Helper Functions for Complexity Reduction
// ==========================================

/**
 * Processes a single stage attempt into intermediate stats.
 */
function processStageAttempt(
  attempt: StageAttemptRecord,
  stageData: Map<
    string,
    { attempts: number; completions: number; stars: number[]; scores: number[]; difficulty: string }
  >,
  difficultyData: Map<string, { attempts: number; completions: number; stars: number[] }>,
  chapterData: Map<string, { totalStages: Set<string>; attempts: number; completions: number }>,
  bossStages: { attempts: number; completions: number },
  totalCompletionsRef: { value: number }
): void {
  // Track by stage
  if (!stageData.has(attempt.stageId)) {
    stageData.set(attempt.stageId, {
      attempts: 0,
      completions: 0,
      stars: [],
      scores: [],
      difficulty: attempt.difficulty,
    });
  }
  const stage = stageData.get(attempt.stageId)!;
  stage.attempts++;
  if (attempt.completed) {
    stage.completions++;
    stage.stars.push(attempt.starsEarned);
    stage.scores.push(attempt.score);
    totalCompletionsRef.value++;
  }

  // Track by difficulty
  if (!difficultyData.has(attempt.difficulty)) {
    difficultyData.set(attempt.difficulty, { attempts: 0, completions: 0, stars: [] });
  }
  const diff = difficultyData.get(attempt.difficulty)!;
  diff.attempts++;
  if (attempt.completed) {
    diff.completions++;
    diff.stars.push(attempt.starsEarned);
  }

  // Track by chapter
  const chapterId = attempt.stagePrefix;
  if (!chapterData.has(chapterId)) {
    chapterData.set(chapterId, { totalStages: new Set(), attempts: 0, completions: 0 });
  }
  const chapter = chapterData.get(chapterId)!;
  chapter.totalStages.add(attempt.stageId);
  chapter.attempts++;
  if (attempt.completed) {
    chapter.completions++;
  }

  // Track boss stages
  if (attempt.bossDefeated && attempt.completed) {
    bossStages.attempts++;
    bossStages.completions++;
  } else if (attempt.bossDefeated) {
    bossStages.attempts++;
  }
}

/**
 * Processes a single drop record into intermediate stats.
 */
function processDropRecord(
  drop: DropRecord,
  difficultyStats: Map<string, { attempts: number; drops: number }>,
  stageStats: Map<string, { attempts: number; drops: number; byRarity: Map<string, number> }>,
  bossBonusDrops: { attempts: number; drops: number }
): void {
  // Update difficulty stats
  if (!difficultyStats.has(drop.difficulty)) {
    difficultyStats.set(drop.difficulty, { attempts: 0, drops: 0 });
  }
  const diffStat = difficultyStats.get(drop.difficulty)!;
  diffStat.attempts++;
  diffStat.drops++;

  // Update stage stats
  if (!stageStats.has(drop.stageId)) {
    stageStats.set(drop.stageId, { attempts: 0, drops: 0, byRarity: new Map() });
  }
  const stageStat = stageStats.get(drop.stageId)!;
  stageStat.attempts++;
  stageStat.drops++;
  if (!stageStat.byRarity.has(drop.gearRarity)) {
    stageStat.byRarity.set(drop.gearRarity, 0);
  }
  stageStat.byRarity.set(drop.gearRarity, stageStat.byRarity.get(drop.gearRarity)! + 1);

  // Update boss bonus tracking
  if (drop.bossDefeated) {
    bossBonusDrops.attempts++;
    bossBonusDrops.drops++;
  }
}

/**
 * Calculates average from an array of numbers.
 */
function calculateAverage(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Analyzes drop distribution for insights.
 */
function analyzeDropDistribution(dropStats: DropStatistics, insights: BalanceInsights): void {
  for (const [rarity, data] of Object.entries(dropStats.byRarity)) {
    if (dropStats.totalDrops > 0) {
      const deviationPercent = Math.abs(data.deviation);
      if (deviationPercent > 10) {
        insights.drops.issues.push(
          `${rarity} drop rate is ${data.deviation > 0 ? 'above' : 'below'} expected by ${deviationPercent.toFixed(1)}%`
        );
      }
    }
  }
}

/**
 * Analyzes drop rate by difficulty for insights.
 */
function analyzeDifficultyDropRates(dropStats: DropStatistics, insights: BalanceInsights): void {
  for (const [difficulty, data] of Object.entries(dropStats.byDifficulty)) {
    if (data.attempts > 50) {
      if (data.dropRate < 0.1) {
        insights.drops.issues.push(
          `${difficulty} difficulty has very low drop rate (${(data.dropRate * 100).toFixed(1)}%)`
        );
        insights.drops.recommendations.push(
          `Consider increasing drop rates for ${difficulty} difficulty`
        );
      }
    }
  }
}

/**
 * Analyzes stage completion rates for insights.
 */
function analyzeStageCompletionRates(
  stageStats: StageCompletionStatistics,
  insights: BalanceInsights
): void {
  for (const [stageId, data] of Object.entries(stageStats.byStage)) {
    if (data.attempts > 20) {
      if (data.completionRate < 0.2) {
        insights.stages.issues.push(
          `${stageId} has very low completion rate (${(data.completionRate * 100).toFixed(1)}%)`
        );
        insights.stages.recommendations.push(
          `Consider lowering ${stageId} difficulty or adjusting rewards`
        );
      } else if (data.completionRate > 0.95) {
        insights.stages.issues.push(
          `${stageId} has very high completion rate (${(data.completionRate * 100).toFixed(1)}%) - may be too easy`
        );
        insights.stages.recommendations.push(`Consider increasing ${stageId} difficulty`);
      }
    }
  }
}

/**
 * Analyzes chapter progression for insights.
 */
function analyzeChapterProgression(
  stageStats: StageCompletionStatistics,
  insights: BalanceInsights
): void {
  const chapterCompletionRates = Object.entries(stageStats.byChapter).map(([chapterId, data]) => ({
    chapterId,
    rate: data.completionRate,
  }));
  chapterCompletionRates.sort((a, b) => a.rate - b.rate);

  if (chapterCompletionRates.length > 1) {
    const lowestRateChapter = chapterCompletionRates[0];
    const highestRateChapter = chapterCompletionRates[chapterCompletionRates.length - 1];
    const rateGap = highestRateChapter.rate - lowestRateChapter.rate;

    if (rateGap > 0.5) {
      insights.stages.issues.push(
        `Large progression gap: ${lowestRateChapter.chapterId} (${(lowestRateChapter.rate * 100).toFixed(1)}%) vs ${highestRateChapter.chapterId} (${(highestRateChapter.rate * 100).toFixed(1)}%)`
      );
      insights.stages.recommendations.push(
        'Consider adding progression bridges or difficulty scaling between chapters'
      );
    }
  }
}

/**
 * Analyzes boss completion rates for insights.
 */
function analyzeBossCompletionRates(
  stageStats: StageCompletionStatistics,
  insights: BalanceInsights
): void {
  if (stageStats.bossStages.attempts > 10) {
    if (stageStats.bossStages.completionRate < 0.3) {
      insights.stages.issues.push(
        `Boss stages have low completion rate (${(stageStats.bossStages.completionRate * 100).toFixed(1)}%)`
      );
      insights.stages.recommendations.push(
        'Consider reducing boss difficulty or improving player tools'
      );
    }
  }
}

/**
 * Generates balance insights and recommendations.
 */
export function generateBalanceInsights(startTime?: number, endTime?: number): BalanceInsights {
  const dropStats = calculateDropStatistics(startTime, endTime);
  const stageStats = calculateStageCompletionStatistics(startTime, endTime);

  const now = Date.now();
  const start = startTime ?? now - 86400000;
  const end = endTime ?? now;

  const insights: BalanceInsights = {
    generatedAt: now,
    timeRange: { start, end },
    drops: {
      summary: dropStats,
      issues: [],
      recommendations: [],
    },
    stages: {
      summary: stageStats,
      issues: [],
      recommendations: [],
    },
  };

  // Analyze drop distribution
  analyzeDropDistribution(dropStats, insights);

  // Check for drop rate issues by difficulty
  analyzeDifficultyDropRates(dropStats, insights);

  // Analyze stage completion rates
  analyzeStageCompletionRates(stageStats, insights);

  // Analyze chapter progression
  analyzeChapterProgression(stageStats, insights);

  // Analyze boss completion rates
  analyzeBossCompletionRates(stageStats, insights);

  return insights;
}

// ==========================================
// RPC Handlers
// ==========================================

/**
 * RPC: Record a gear drop for balance analytics.
 *
 * @example
 * // Request payload
 * {
 *   "stage_id": "1_1",
 *   "stage_prefix": "campaign_1",
 *   "difficulty": "medium",
 *   "boss_defeated": false,
 *   "gear_rarity": "rare",
 *   "gear_type": "bow",
 *   "gear_id": "bow_crossbow_rare_123",
 *   "drop_rate_used": 0.35,
 *   "roll_value": 0.25
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "drop_id": "drop_1234567890_abc123"
 * }
 */
export async function rpcRecordDrop(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Record drop called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.record_drop, payload, 'record_drop');
  if (!validation.success) {
    return createValidationErrorResponse(
      'record_drop',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as {
    stage_id: string;
    stage_prefix: string;
    difficulty: string;
    boss_defeated: boolean;
    gear_rarity: string;
    gear_type: string;
    gear_id: string;
    drop_rate_used: number;
    roll_value: number;
  };

  try {
    await recordDrop(nk, {
      userId: ctx.userId,
      timestamp: Date.now(),
      stageId: data.stage_id,
      stagePrefix: data.stage_prefix,
      difficulty: data.difficulty,
      bossDefeated: data.boss_defeated,
      gearRarity: data.gear_rarity,
      gearType: data.gear_type,
      gearId: data.gear_id,
      dropRateUsed: data.drop_rate_used,
      rollValue: data.roll_value,
    });

    logger.info('Drop recorded for user: %s', ctx.userId);

    return JSON.stringify({
      success: true,
      drop_id: `drop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });
  } catch (error) {
    logger.error('Failed to record drop: %s', String(error));
    return JSON.stringify({
      success: false,
      error: 'Failed to record drop',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * RPC: Record a stage attempt for balance analytics.
 *
 * @example
 * // Request payload
 * {
 *   "stage_id": "1_1",
 *   "stage_prefix": "campaign_1",
 *   "difficulty": "medium",
 *   "boss_defeated": false,
 *   "completed": true,
 *   "stars_earned": 3,
 *   "score": 1500,
 *   "attempt_number": 1
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "attempt_id": "attempt_1234567890_abc123"
 * }
 */
export async function rpcRecordStageAttempt(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Record stage attempt called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.record_stage_attempt,
    payload,
    'record_stage_attempt'
  );
  if (!validation.success) {
    return createValidationErrorResponse(
      'record_stage_attempt',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as {
    stage_id: string;
    stage_prefix: string;
    difficulty: string;
    boss_defeated: boolean;
    completed: boolean;
    stars_earned: number;
    score: number;
    attempt_number: number;
  };

  try {
    await recordStageAttempt(nk, {
      userId: ctx.userId,
      timestamp: Date.now(),
      stageId: data.stage_id,
      stagePrefix: data.stage_prefix,
      difficulty: data.difficulty,
      bossDefeated: data.boss_defeated,
      completed: data.completed,
      starsEarned: data.stars_earned,
      score: data.score,
      attemptNumber: data.attempt_number,
    });

    logger.info('Stage attempt recorded for user: %s', ctx.userId);

    return JSON.stringify({
      success: true,
      attempt_id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });
  } catch (error) {
    logger.error('Failed to record stage attempt: %s', String(error));
    return JSON.stringify({
      success: false,
      error: 'Failed to record stage attempt',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * RPC: Get drop distribution statistics.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "statistics": { ... }
 * }
 */
export function rpcGetDropStatistics(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get drop statistics called');

  const validation = validatePayload(
    ZodSchemas.get_balance_statistics,
    payload,
    'get_drop_statistics'
  );
  if (!validation.success) {
    return createValidationErrorResponse(
      'get_drop_statistics',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as {
    start_date?: string;
    end_date?: string;
  };

  try {
    const startTime = data.start_date ? new Date(data.start_date).getTime() : undefined;
    const endTime = data.end_date ? new Date(data.end_date).getTime() : undefined;

    const stats = calculateDropStatistics(startTime, endTime);

    return JSON.stringify({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    logger.error('Failed to get drop statistics: %s', String(error));
    return JSON.stringify({
      success: false,
      error: 'Failed to get drop statistics',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * RPC: Get stage completion statistics.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "statistics": { ... }
 * }
 */
export function rpcGetStageCompletionStatistics(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get stage completion statistics called');

  const validation = validatePayload(
    ZodSchemas.get_balance_statistics,
    payload,
    'get_stage_completion_statistics'
  );
  if (!validation.success) {
    return createValidationErrorResponse(
      'get_stage_completion_statistics',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as {
    start_date?: string;
    end_date?: string;
  };

  try {
    const startTime = data.start_date ? new Date(data.start_date).getTime() : undefined;
    const endTime = data.end_date ? new Date(data.end_date).getTime() : undefined;

    const stats = calculateStageCompletionStatistics(startTime, endTime);

    return JSON.stringify({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    logger.error('Failed to get stage completion statistics: %s', String(error));
    return JSON.stringify({
      success: false,
      error: 'Failed to get stage completion statistics',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * RPC: Get balance insights and recommendations.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "insights": { ... }
 * }
 */
export function rpcGetBalanceInsights(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get balance insights called');

  const validation = validatePayload(
    ZodSchemas.get_balance_statistics,
    payload,
    'get_balance_insights'
  );
  if (!validation.success) {
    return createValidationErrorResponse(
      'get_balance_insights',
      (validation as { success: false; error: string }).error
    );
  }

  const data = validation.data as {
    start_date?: string;
    end_date?: string;
  };

  try {
    const startTime = data.start_date ? new Date(data.start_date).getTime() : undefined;
    const endTime = data.end_date ? new Date(data.end_date).getTime() : undefined;

    const insights = generateBalanceInsights(startTime, endTime);

    return JSON.stringify({
      success: true,
      insights,
    });
  } catch (error) {
    logger.error('Failed to get balance insights: %s', String(error));
    return JSON.stringify({
      success: false,
      error: 'Failed to get balance insights',
      error_code: 'INTERNAL_ERROR',
    });
  }
}

// ==========================================
// Exported Utility Functions
// ==========================================

/**
 * Gets recent drop records for testing/debugging.
 */
export function getRecentDrops(limit: number = 100): DropRecord[] {
  return recentDrops.slice(-limit);
}

/**
 * Gets recent stage attempt records for testing/debugging.
 */
export function getRecentStageAttempts(limit: number = 100): StageAttemptRecord[] {
  return recentStageAttempts.slice(-limit);
}

/**
 * Clears in-memory storage (for testing only).
 */
export function clearAnalyticsStorage(): void {
  recentDrops.length = 0;
  recentStageAttempts.length = 0;
  dropStatsCache.clear();
  stageStatsCache.clear();
}
