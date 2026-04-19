import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { config } from '../config';
import { Runtime } from '../types/nakama';
import * as rateLimiter from '../utils/rateLimiter';
import { getDeploymentRegistry } from './deployment_observability';
import { initializeNPlusOneDetectionWithMetrics, getNPlusOneReport } from './n_plus_one_detection';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { recordRpcLatency, recordRpcError } from './rpc_latency_tracker';

const register = new Registry();

collectDefaultMetrics({ register });

// Initialize N+1 detection with metrics if enabled
if (config.nPlusOne && config.nPlusOne.enabled && config.nPlusOne.metricsEnabled) {
  initializeNPlusOneDetectionWithMetrics(register);
}

// ==========================================
// Core RPC Metrics
// ==========================================

const rpcCallsTotal = new Counter({
  name: 'armored_archer_rpc_calls_total',
  help: 'Total number of RPC calls',
  labelNames: ['rpc', 'status'] as const,
  registers: [register],
});

const rpcDurationSeconds = new Histogram({
  name: 'armored_archer_rpc_duration_seconds',
  help: 'RPC call duration in seconds',
  labelNames: ['rpc'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const rpcErrorsTotal = new Counter({
  name: 'armored_archer_rpc_errors_total',
  help: 'Total number of RPC errors',
  labelNames: ['rpc', 'error_type'] as const,
  registers: [register],
});

// ==========================================
// Rate Limiting Metrics
// ==========================================

const rateLimitViolationsTotal = new Counter({
  name: 'armored_archer_rate_limit_violations_total',
  help: 'Total number of rate limit violations',
  labelNames: ['rpc'] as const,
  registers: [register],
});

const rateLimitActiveUsers = new Gauge({
  name: 'armored_archer_rate_limit_active_users',
  help: 'Number of users currently being rate limited',
  registers: [register],
});

// ==========================================
// Player Metrics
// ==========================================

const playerActiveSessions = new Gauge({
  name: 'armored_archer_player_active_sessions',
  help: 'Number of currently active player sessions',
  registers: [register],
});

const playerNewRegistrations = new Counter({
  name: 'armored_archer_player_new_registrations_total',
  help: 'Total number of new player registrations',
  labelNames: ['platform'] as const,
  registers: [register],
});

const playerLoginAttempts = new Counter({
  name: 'armored_archer_player_login_attempts_total',
  help: 'Total number of player login attempts',
  labelNames: ['status'] as const,
  registers: [register],
});

const playerSessionDuration = new Histogram({
  name: 'armored_archer_player_session_duration_seconds',
  help: 'Player session duration in seconds',
  buckets: [30, 60, 120, 300, 600, 1800, 3600, 7200, 14400],
  registers: [register],
});

// ==========================================
// Match/Multiplayer Metrics
// ==========================================

const matchesCreatedTotal = new Counter({
  name: 'armored_archer_matches_created_total',
  help: 'Total number of matches created',
  labelNames: ['match_type'] as const,
  registers: [register],
});

const matchesCompletedTotal = new Counter({
  name: 'armored_archer_matches_completed_total',
  help: 'Total number of matches completed',
  labelNames: ['match_type', 'result'] as const,
  registers: [register],
});

const matchQueueSize = new Gauge({
  name: 'armored_archer_match_queue_size',
  help: 'Current number of players in match queue',
  labelNames: ['match_type'] as const,
  registers: [register],
});

const matchWaitTimeSeconds = new Histogram({
  name: 'armored_archer_match_wait_time_seconds',
  help: 'Time players wait for match in seconds',
  labelNames: ['match_type'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 180, 300],
  registers: [register],
});

const matchPlayersCount = new Histogram({
  name: 'armored_archer_match_players_count',
  help: 'Number of players per match',
  labelNames: ['match_type'] as const,
  buckets: [1, 2, 4, 8, 16],
  registers: [register],
});

// ==========================================
// Economy/Store Metrics
// ==========================================

const purchasesTotal = new Counter({
  name: 'armored_archer_purchases_total',
  help: 'Total number of purchases',
  labelNames: ['product_type', 'status'] as const,
  registers: [register],
});

const purchaseRevenue = new Counter({
  name: 'armored_archer_purchase_revenue_total',
  help: 'Total purchase revenue in cents',
  labelNames: ['currency', 'product_type'] as const,
  registers: [register],
});

const currencySpent = new Counter({
  name: 'armored_archer_currency_spent_total',
  help: 'Total in-game currency spent',
  labelNames: ['currency_type', 'reason'] as const,
  registers: [register],
});

const currencyEarned = new Counter({
  name: 'armored_archer_currency_earned_total',
  help: 'Total in-game currency earned',
  labelNames: ['currency_type', 'source'] as const,
  registers: [register],
});

// ==========================================
// Combat/Gameplay Metrics
// ==========================================

const combatActionsTotal = new Counter({
  name: 'armored_archer_combat_actions_total',
  help: 'Total number of combat actions',
  labelNames: ['action_type', 'result'] as const,
  registers: [register],
});

const combatDamageDealt = new Histogram({
  name: 'armored_archer_combat_damage_dealt',
  help: 'Damage dealt per action',
  labelNames: ['target_type'] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

const combatDuration = new Histogram({
  name: 'armored_archer_combat_duration_seconds',
  help: 'Duration of combat encounters',
  buckets: [5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

const pveStagesCompleted = new Counter({
  name: 'armored_archer_pve_stages_completed_total',
  help: 'Total number of PvE stages completed',
  labelNames: ['stage_difficulty', 'stars'] as const,
  registers: [register],
});

// ==========================================
// Progression Metrics
// ==========================================

const playerLevelUps = new Counter({
  name: 'armored_archer_player_level_ups_total',
  help: 'Total number of player level ups',
  registers: [register],
});

const gearUnlocks = new Counter({
  name: 'armored_archer_gear_unlocks_total',
  help: 'Total number of gear items unlocked',
  labelNames: ['rarity'] as const,
  registers: [register],
});

const seasonParticipation = new Counter({
  name: 'armored_archer_season_participation_total',
  help: 'Total season participations',
  labelNames: ['season_id'] as const,
  registers: [register],
});

// ==========================================
// Season Telemetry Metrics
// ==========================================

const seasonAvgEloGauge = new Gauge({
  name: 'armored_archer_season_avg_elo',
  help: 'Current average ELO across active season players',
  labelNames: ['season_id'] as const,
  registers: [register],
});

const seasonEloDriftGauge = new Gauge({
  name: 'armored_archer_season_elo_drift',
  help: 'Drift of average ELO from the base 1000, positive = inflation',
  labelNames: ['season_id'] as const,
  registers: [register],
});

const seasonRewardClaimsTotal = new Counter({
  name: 'armored_archer_season_reward_claims_total',
  help: 'Total season reward claims',
  labelNames: ['season_id', 'tier'] as const,
  registers: [register],
});

const seasonCurrencyInjectedTotal = new Counter({
  name: 'armored_archer_season_currency_injected_total',
  help: 'Total in-game currency injected via season rewards',
  labelNames: ['season_id', 'currency_type'] as const,
  registers: [register],
});

const seasonRankChangesTotal = new Counter({
  name: 'armored_archer_season_rank_changes_total',
  help: 'Total rank changes in current season',
  labelNames: ['season_id', 'is_punch_up'] as const,
  registers: [register],
});

const seasonRankChangeDelta = new Histogram({
  name: 'armored_archer_season_rank_change_delta',
  help: 'Distribution of rank change deltas per match',
  labelNames: ['season_id'] as const,
  buckets: [-60, -40, -32, -20, -10, 0, 10, 20, 32, 40, 60],
  registers: [register],
});

const seasonActivePlayersGauge = new Gauge({
  name: 'armored_archer_season_active_players',
  help: 'Number of players with leaderboard entries in current season',
  labelNames: ['season_id'] as const,
  registers: [register],
});

// ==========================================
// Analytics Event Metrics
// ==========================================

const analyticsEventsTotal = new Counter({
  name: 'armored_archer_analytics_events_total',
  help: 'Total number of analytics events',
  labelNames: ['event_category', 'event_name'] as const,
  registers: [register],
});

// ==========================================
// Performance Metrics
// ==========================================

const databaseQueryDuration = new Histogram({
  name: 'armored_archer_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

const cacheHitRatio = new Gauge({
  name: 'armored_archer_cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['cache_type'] as const,
  registers: [register],
});

// Register rate limiter callbacks
rateLimiter.setMetricsCallbacks(recordRateLimitViolation, updateActiveUsersCount);

export function registerRpcMetrics(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/metrics', rpcGetMetrics);
  initializer.registerRpc('armored_archer/n_plus_one_report', rpcGetNPlusOneReport);
}

// RPC handler for N+1 detection report
async function rpcGetNPlusOneReport(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  logger.info('N+1 report endpoint called by user: %s', ctx.userId);

  const report = getNPlusOneReport();
  return JSON.stringify(report, null, 2);
}

async function rpcGetMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Metrics endpoint called by user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.health_check, payload, 'metrics');
  if (!validation.success) {
    return createValidationErrorResponse('metrics', validation.error);
  }

  // Get base metrics in Prometheus text format
  const baseMetrics = await register.metrics();

  // Get deployment metrics
  const deploymentRegistry = getDeploymentRegistry();
  const deploymentMetrics = await deploymentRegistry.metrics();

  // Combine both metrics (deployment metrics have different metric names to avoid conflicts)
  return baseMetrics + '\n# Deployment metrics\n' + deploymentMetrics;
}

export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

export function wrapRpcWithMetrics(rpcName: string, handler: RpcHandler): RpcHandler {
  return async function (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): Promise<string> {
    const startTime = Date.now();
    const endTimer = rpcDurationSeconds.startTimer({ rpc: rpcName });

    try {
      const result = await handler(ctx, logger, nk, payload);
      rpcCallsTotal.inc({ rpc: rpcName, status: 'success' });
      recordRpcLatency(rpcName, Date.now() - startTime);
      return result;
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : 'unknown';
      rpcCallsTotal.inc({ rpc: rpcName, status: 'error' });
      rpcErrorsTotal.inc({ rpc: rpcName, error_type: errorType });
      recordRpcError(rpcName, errorType);
      throw error;
    } finally {
      endTimer();
    }
  };
}

export function registerRpcWithMetrics(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  const wrappedHandler = wrapRpcWithMetrics(rpcName, handler);
  initializer.registerRpc(rpcId, wrappedHandler);
}

export function registerRpcWithRateLimit(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  if (!config.rateLimit.enabled) {
    registerRpcWithMetrics(initializer, rpcId, rpcName, handler);
    return;
  }

  const endpointConfig = config.rateLimit.endpoints[rpcName];
  if (endpointConfig) {
    rateLimiter.setEndpointRateLimit(rpcName, endpointConfig);
  }

  const wrappedWithRateLimit = rateLimiter.createRateLimitedRpcHandler(rpcName, handler);
  const wrappedWithMetrics = wrapRpcWithMetrics(rpcName, wrappedWithRateLimit);

  initializer.registerRpc(rpcId, wrappedWithMetrics);
}

export function getMetricsRegistry(): Registry {
  return register;
}

export function recordRateLimitViolation(rpcName: string): void {
  rateLimitViolationsTotal.inc({ rpc: rpcName });
}

export function updateActiveUsersCount(count: number): void {
  rateLimitActiveUsers.set(count);
}

// ==========================================
// Player Metric Functions
// ==========================================

export function setActiveSessions(count: number): void {
  playerActiveSessions.set(count);
}

export function incrementNewRegistration(platform: string): void {
  playerNewRegistrations.inc({ platform });
}

export function recordLoginAttempt(success: boolean): void {
  playerLoginAttempts.inc({ status: success ? 'success' : 'failure' });
}

export function recordSessionDuration(durationSeconds: number): void {
  playerSessionDuration.observe(durationSeconds);
}

// ==========================================
// Match/Multiplayer Metric Functions
// ==========================================

export function incrementMatchCreated(matchType: string): void {
  matchesCreatedTotal.inc({ match_type: matchType });
}

export function incrementMatchCompleted(matchType: string, result: string): void {
  matchesCompletedTotal.inc({ match_type: matchType, result });
}

export function setMatchQueueSize(matchType: string, size: number): void {
  matchQueueSize.set({ match_type: matchType }, size);
}

export function recordMatchWaitTime(matchType: string, waitTimeSeconds: number): void {
  matchWaitTimeSeconds.observe({ match_type: matchType }, waitTimeSeconds);
}

export function recordMatchPlayersCount(matchType: string, count: number): void {
  matchPlayersCount.observe({ match_type: matchType }, count);
}

// ==========================================
// Economy/Store Metric Functions
// ==========================================

export function recordPurchase(productType: string, success: boolean): void {
  purchasesTotal.inc({ product_type: productType, status: success ? 'success' : 'failure' });
}

export function recordRevenue(amount: number, currency: string, productType: string): void {
  purchaseRevenue.inc({ currency, product_type: productType }, amount);
}

export function recordCurrencySpent(currencyType: string, reason: string, amount: number): void {
  currencySpent.inc({ currency_type: currencyType, reason }, amount);
}

export function recordCurrencyEarned(currencyType: string, source: string, amount: number): void {
  currencyEarned.inc({ currency_type: currencyType, source }, amount);
}

// ==========================================
// Combat/Gameplay Metric Functions
// ==========================================

export function recordCombatAction(actionType: string, result: string): void {
  combatActionsTotal.inc({ action_type: actionType, result });
}

export function recordDamageDealt(targetType: string, damage: number): void {
  combatDamageDealt.observe({ target_type: targetType }, damage);
}

export function recordCombatDuration(durationSeconds: number): void {
  combatDuration.observe(durationSeconds);
}

export function recordPveStageCompleted(difficulty: string, stars: number): void {
  pveStagesCompleted.inc({ stage_difficulty: difficulty, stars: String(stars) });
}

// ==========================================
// Progression Metric Functions
// ==========================================

export function incrementPlayerLevelUp(): void {
  playerLevelUps.inc();
}

export function incrementGearUnlock(rarity: string): void {
  gearUnlocks.inc({ rarity });
}

export function incrementSeasonParticipation(seasonId: string): void {
  seasonParticipation.inc({ season_id: seasonId });
}

// ==========================================
// Analytics Event Metric Functions
// ==========================================

export function recordAnalyticsEvent(eventCategory: string, eventName: string): void {
  analyticsEventsTotal.inc({ event_category: eventCategory, event_name: eventName });
}

// ==========================================
// Performance Metric Functions
// ==========================================

export function recordDatabaseQueryDuration(queryType: string, durationSeconds: number): void {
  databaseQueryDuration.observe({ query_type: queryType }, durationSeconds);
}

export function setCacheHitRatio(cacheType: string, ratio: number): void {
  cacheHitRatio.set({ cache_type: cacheType }, ratio);
}

// ==========================================
// Season Telemetry Metric Functions
// ==========================================

export function setSeasonAvgElo(seasonId: string, avgElo: number): void {
  seasonAvgEloGauge.set({ season_id: seasonId }, avgElo);
  seasonEloDriftGauge.set({ season_id: seasonId }, avgElo - 1000);
}

export function incrementSeasonRewardClaims(seasonId: string, tier: string): void {
  seasonRewardClaimsTotal.inc({ season_id: seasonId, tier });
}

export function recordSeasonCurrencyInjected(
  seasonId: string,
  currencyType: string,
  amount: number
): void {
  seasonCurrencyInjectedTotal.inc({ season_id: seasonId, currency_type: currencyType }, amount);
}

export function incrementSeasonRankChanges(seasonId: string, isPunchUp: boolean): void {
  seasonRankChangesTotal.inc({ season_id: seasonId, is_punch_up: String(isPunchUp) });
}

export function recordSeasonRankChangeDelta(seasonId: string, delta: number): void {
  seasonRankChangeDelta.observe({ season_id: seasonId }, delta);
}

export function setSeasonActivePlayers(seasonId: string, count: number): void {
  seasonActivePlayersGauge.set({ season_id: seasonId }, count);
}
