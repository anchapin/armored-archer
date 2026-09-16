import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { config } from '../config';
import { Runtime } from '../types/nakama';
import * as rateLimiter from '../utils/rateLimiter';
import { withAdminGuard, setAdminGuardMetricsCallbacks } from './admin_auth';
import { getDeploymentRegistry } from './deployment_observability';
import { initializeNPlusOneDetectionWithMetrics, getNPlusOneReport } from './n_plus_one_detection';
import { getHealthRegistry } from './health_monitor';
import { getRolloutRegistry } from './progressive_rollout';
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
// PvP Settlement Outcome Metrics (issue #1143)
// ==========================================

const settlementOutcomesTotal = new Counter({
  name: 'armored_archer_settlement_outcomes_total',
  help:
    'Total PvP match settlements by outcome (ADR-0002 server-declared settlement; ' +
    'issue #1078 exactly-once claim-then-apply pipeline)',
  labelNames: ['result'] as const,
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
// Punch-Up Loss Watch Metrics (LC-T3)
// ==========================================

const punchUpLossesTotal = new Counter({
  name: 'armored_archer_punch_up_losses_total',
  help: 'Total settled punch-up underdog losses (amplified 2x-K deduction)',
  labelNames: ['season_id'] as const,
  registers: [register],
});

const punchUpWatchFlagsTotal = new Counter({
  name: 'armored_archer_punch_up_watch_flags_total',
  help:
    'LC-T3 punch-up wager abuse watch flags raised, by detection reason ' +
    '(pair_farming / loss_frequency)',
  labelNames: ['reason'] as const,
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
// Funnel Analytics Metrics
// ==========================================

const funnelPlayersTotal = new Gauge({
  name: 'armored_archer_funnel_players_total',
  help: 'Total unique players reaching each funnel step',
  labelNames: ['step'] as const,
  registers: [register],
});

const funnelConversionRate = new Gauge({
  name: 'armored_archer_funnel_conversion_rate',
  help: 'Conversion rate between consecutive funnel steps (0-1)',
  labelNames: ['from_step', 'to_step'] as const,
  registers: [register],
});

const funnelDropoffTotal = new Gauge({
  name: 'armored_archer_funnel_dropoff_total',
  help: 'Number of players who dropped off at each funnel step',
  labelNames: ['step'] as const,
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

// ==========================================
// Admin Guard Metrics (issue #1141, ADR-0006)
// ==========================================

const adminRpcAccessDeniedTotal = new Counter({
  name: 'armored_archer_admin_rpc_access_denied_total',
  help:
    'Total admin RPC calls rejected by the withAdminGuard allowlist gate, ' +
    'by rpc_id and reason (caller_not_in_admin_allowlist / caller_id_missing)',
  labelNames: ['rpc_id', 'reason'] as const,
  registers: [register],
});

const adminAllowlistSize = new Gauge({
  name: 'armored_archer_admin_allowlist_size',
  help:
    'Number of entries in the ADMIN_USER_IDS allowlist; 0 means every admin ' +
    'RPC rejects every caller (fail-closed per ADR-0006)',
  registers: [register],
});

// Register rate limiter callbacks
rateLimiter.setMetricsCallbacks(recordRateLimitViolation, updateActiveUsersCount);

// Register admin-guard metric sinks (issue #1141). The guard module cannot
// import this one directly — metrics.ts already imports admin_auth for
// withAdminGuard — so, like the rate limiter above, the sinks are injected
// from this side to close the loop without an import cycle.
setAdminGuardMetricsCallbacks(incrementAdminRpcAccessDenied, setAdminAllowlistSize);

// Operational telemetry endpoints — full Prometheus/deployment dumps must
// not be harvestable by players. The guard wraps the handler itself (not the
// registration call site in index.ts) so it survives the metrics exposure
// rework (issue #1074).
export function registerRpcMetrics(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/metrics',
    withAdminGuard('armored_archer/metrics', rpcGetMetrics)
  );
  initializer.registerRpc(
    'armored_archer/n_plus_one_report',
    withAdminGuard('armored_archer/n_plus_one_report', rpcGetNPlusOneReport)
  );

  // Prometheus scrape exposition (issue #1074) — see the "Prometheus Scrape
  // Endpoints" section below for why these are intentionally NOT wrapped in
  // withAdminGuard.
  initializer.registerRpc('armored_archer/prometheus_metrics', rpcScrapeAppMetrics);
  initializer.registerRpc('armored_archer/prometheus_deployment', rpcScrapeDeploymentMetrics);
  initializer.registerRpc('armored_archer/prometheus_health', rpcScrapeHealthMetrics);
  initializer.registerRpc('armored_archer/prometheus_rollout', rpcScrapeRolloutMetrics);
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

// ==========================================
// Prometheus Scrape Endpoints (issue #1074)
// ==========================================

// The admin-guarded RPCs above cannot serve Prometheus scrapes:
//   1. Prometheus holds no user session token, and the admin allowlist is
//      fail-closed for user-less calls (http-key invocations carry no
//      userId), so every scrape would be rejected.
//   2. Nakama wraps RPC results in a JSON envelope ({"payload": "..."})
//      that Prometheus cannot parse as exposition format.
//
// backend/prometheus.yml therefore scrapes the `armored_archer/prometheus_*`
// RPCs with `?unwrap&http_key=<runtime http key>` query parameters:
//   - Nakama authenticates server-to-server /v2/rpc calls with the runtime
//     HTTP key (`runtime.http_key`, default "defaulthttpkey"). Unlike the
//     server key, it does NOT ship inside client binaries, so players cannot
//     harvest these dumps — the same stance the admin guard enforces.
//   - With `unwrap`, Nakama returns the handler string verbatim with a
//     text/plain content type — i.e. valid Prometheus text exposition.
//
// Scrape requests arrive as HTTP GET with an empty body, so the handlers
// consume no input (nothing to validate) and only read aggregate, non-PII
// telemetry from their in-process registries.

async function rpcScrapeAppMetrics(
  _ctx: Runtime.Context,
  _logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  return register.metrics();
}

async function rpcScrapeDeploymentMetrics(
  _ctx: Runtime.Context,
  _logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  return getDeploymentRegistry().metrics();
}

async function rpcScrapeHealthMetrics(
  _ctx: Runtime.Context,
  _logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  return getHealthRegistry().metrics();
}

async function rpcScrapeRolloutMetrics(
  _ctx: Runtime.Context,
  _logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  return getRolloutRegistry().metrics();
}

export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

export function wrapRpcWithMetrics(rpcName: string, handler: RpcHandler): RpcHandler {
  // SYNC on purpose: Nakama 3.21's goja runtime has no promise-job
  // scheduler, so an async handler returns a pending Promise that Nakama
  // rejects ('Runtime function returned invalid data'). The wrap adds no
  // awaits — keep the registered handler synchronous (issue #1135).
  return function (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): string {
    const startTime = Date.now();
    const endTimer = rpcDurationSeconds.startTimer({ rpc: rpcName });

    try {
      const result = handler(ctx, logger, nk, payload);
      if (typeof result !== 'string') {
        // Nakama's goja runtime cannot resolve Promises (no job scheduler);
        // a non-string here would surface as an opaque 500 downstream.
        throw new Error(
          `RPC ${rpcName} returned a non-string result; async handlers are ` +
            'unsupported by the Nakama JS runtime (issue #1135)'
        );
      }
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

/**
 * Settlement outcome values for `recordSettlementOutcome` (issue #1143), the
 * PromQL view of the `complete_match` audit channels (ADR-0002):
 * - `success` — every effect applied (or a terminal draw settled cleanly)
 * - `degraded` — post-claim effects threw; the match stays settled and
 *   partially-applied grants need manual reconciliation (audit channel
 *   `settlement_degraded`)
 * - `claim_failed` — the versioned settled-marker write failed; nothing was
 *   applied and a client retry is safe (audit channel
 *   `settlement_claim_failed`)
 * - `persist_failed` — the unconditional draw-settlement persist threw;
 *   nothing was applied and the error propagates to the caller
 */
export type SettlementOutcomeResult = 'success' | 'degraded' | 'claim_failed' | 'persist_failed';

export function recordSettlementOutcome(result: SettlementOutcomeResult): void {
  settlementOutcomesTotal.inc({ result });
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

export function setFunnelPlayers(step: string, count: number): void {
  funnelPlayersTotal.set({ step }, count);
}

export function setFunnelConversionRate(fromStep: string, toStep: string, rate: number): void {
  funnelConversionRate.set({ from_step: fromStep, to_step: toStep }, rate);
}

export function setFunnelDropoff(step: string, count: number): void {
  funnelDropoffTotal.set({ step }, count);
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

/**
 * Increments the settled punch-up underdog loss counter (LC-T3 watch input).
 *
 * @param seasonId - Current season ID
 */
export function incrementPunchUpLoss(seasonId: string): void {
  punchUpLossesTotal.inc({ season_id: seasonId });
}

/**
 * Increments the punch-up wager abuse watch flag counter (LC-T3).
 *
 * @param reason - Detection reason that raised the flag
 */
export function incrementPunchUpWatchFlag(reason: string): void {
  punchUpWatchFlagsTotal.inc({ reason });
}

export function setSeasonActivePlayers(seasonId: string, count: number): void {
  seasonActivePlayersGauge.set({ season_id: seasonId }, count);
}

// ==========================================
// Admin Guard Metric Functions (issue #1141)
// ==========================================

/**
 * Increments the admin-guard rejection counter (wired into the guard via
 * `setAdminGuardMetricsCallbacks`; see ADR-0006).
 *
 * @param rpcId - Full RPC id that was rejected (e.g. 'armored_archer/metrics')
 * @param reason - 'caller_not_in_admin_allowlist' | 'caller_id_missing'
 */
export function incrementAdminRpcAccessDenied(rpcId: string, reason: string): void {
  adminRpcAccessDeniedTotal.inc({ rpc_id: rpcId, reason });
}

/**
 * Sets the admin allowlist size gauge. Emitted every time the allowlist is
 * (re)resolved, so `AdminAllowlistEmpty` can distinguish "configured empty"
 * (0) from "not yet resolved" (series absent).
 *
 * @param count - Number of entries in the resolved allowlist
 */
export function setAdminAllowlistSize(count: number): void {
  adminAllowlistSize.set(count);
}

// ==========================================
// Webhook Ledger Metrics (issue #1140)
// ==========================================
// Observability surface for the RevenueCat webhook RPC and its durable
// event ledger (issue #1067). Declarations and helpers live together at
// the end of this file on purpose: runbooks pin line-number citations to
// metrics.ts (see scripts/audit-runbook-citations.sh), so appending here
// keeps every pre-existing citation stable.

const webhookEventsTotal = new Counter({
  name: 'armored_archer_webhook_events_total',
  help:
    'RevenueCat webhook events through the durable ledger (issue #1067), ' +
    'by event_type and outcome (processed / unhandled / failed / duplicate / ' +
    'rejected_not_configured / rejected_invalid_signature / ' +
    'rejected_invalid_payload / rejected_missing_user / rejected_missing_event_id)',
  labelNames: ['event_type', 'outcome'] as const,
  registers: [register],
});

const webhookProcessingSeconds = new Histogram({
  name: 'armored_archer_webhook_processing_seconds',
  help:
    'Seconds spent applying a RevenueCat webhook event (handler start ' +
    'through outcome recording) by event_type; duplicate replays return ' +
    'the recorded outcome and are not timed',
  labelNames: ['event_type'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const webhookPendingAwards = new Gauge({
  name: 'armored_archer_webhook_pending_awards',
  help:
    'Queued cap-overflow paid awards per user in the ' +
    'revenuecat_pending_awards ledger (issue #1067); set on every queue ' +
    'write, 0 once the queue is fully drained',
  labelNames: ['user_id'] as const,
  registers: [register],
});

const webhookRedisErrorsTotal = new Counter({
  name: 'armored_archer_webhook_redis_errors_total',
  help:
    'Redis failures on the webhook ledger dedup fast path by operation ' +
    '(dedup_lookup / outcome_record); each error degrades dedup to the ' +
    'slower durable-storage path (correctness is preserved)',
  labelNames: ['operation'] as const,
  registers: [register],
});

const webhookConfigured = new Gauge({
  name: 'armored_archer_webhook_configured',
  help:
    '1 when REVENUECAT_WEBHOOK_SECRET is configured, 0 when the webhook ' +
    'RPC is fail-closed and rejecting every event (liveness probe for the ' +
    'WebhookNotConfigured alert; set at RPC registration and per webhook call)',
  registers: [register],
});

/**
 * Increments the webhook event counter for the durable ledger (issue #1140).
 *
 * @param eventType - Normalized RevenueCat event type ('unknown' pre-parse)
 * @param outcome - Terminal outcome of the event (see counter help)
 */
export function recordWebhookEvent(eventType: string, outcome: string): void {
  webhookEventsTotal.inc({ event_type: eventType, outcome });
}

/**
 * Observes the processing time of a fully-applied webhook event.
 *
 * @param eventType - Normalized RevenueCat event type
 * @param seconds - Wall-clock seconds from handler start to outcome recording
 */
export function recordWebhookProcessingTime(eventType: string, seconds: number): void {
  webhookProcessingSeconds.observe({ event_type: eventType }, seconds);
}

/**
 * Sets the queued-award gauge for a user after a pending-award queue write.
 *
 * @param userId - Player whose pending-award queue was persisted
 * @param count - Award entries remaining in the queue after the write
 */
export function setWebhookPendingAwards(userId: string, count: number): void {
  webhookPendingAwards.set({ user_id: userId }, count);
}

/**
 * Increments the Redis-failure counter on the webhook dedup fast path.
 *
 * @param operation - 'dedup_lookup' | 'outcome_record'
 */
export function incrementWebhookRedisError(operation: string): void {
  webhookRedisErrorsTotal.inc({ operation });
}

/**
 * Sets the webhook-configured liveness gauge (1 = secret present, 0 =
 * fail-closed). Set at RPC registration (startup probe) and on every
 * webhook call so WebhookNotConfigured tracks live configuration.
 *
 * @param configured - Whether REVENUECAT_WEBHOOK_SECRET is set
 */
export function setWebhookConfigured(configured: boolean): void {
  webhookConfigured.set(configured ? 1 : 0);
}

// ==========================================
// Stage-Progression Telemetry (issue #1139)
// ==========================================

const stageCompleteTotal = new Counter({
  name: 'armored_archer_stage_complete_total',
  help:
    'Terminal outcomes of the consolidated stage_complete RPC (#1069): ' +
    "success | duplicate (rejected by the claim-first dedup marker) | " +
    'clamped (out-of-range stars/score were silently bounded — cheat signal, ' +
    'processing continued with safe values) | validation_failed',
  labelNames: ['outcome'] as const,
  registers: [register],
});

const stageClaimSeconds = new Histogram({
  name: 'armored_archer_stage_completion_claim_seconds',
  help:
    'Wall-clock seconds of the claim segment of the stage_complete RPC: ' +
    'the dedup check (storage read) through the versioned claim write. ' +
    'Observed on both the fresh and the duplicate-rejected path (issue #1139).',
  registers: [register],
});

const stageClaimsTotal = new Counter({
  name: 'armored_archer_stage_completion_claims_total',
  help:
    'Claim-marker outcomes for the stage_complete RPC (#1069/#1139): ' +
    'fresh (no prior claim) | replay_rejected (prior claim inside the ' +
    'cooldown window — request rejected as DUPLICATE_COMPLETION) | ' +
    'cooldown_active (prior claim existed at/after cooldown expiry, so the ' +
    'completion proceeded through a versioned claim overwrite)',
  labelNames: ['result'] as const,
  registers: [register],
});

/** Terminal outcomes for {@link recordStageCompleteOutcome} (issue #1139). */
export type StageCompleteOutcome = 'success' | 'duplicate' | 'clamped' | 'validation_failed';

/** Claim-marker results for {@link recordStageClaim} (issue #1139). */
export type StageClaimResult = 'fresh' | 'replay_rejected' | 'cooldown_active';

/**
 * Records the terminal outcome of a stage_complete RPC invocation.
 *
 * @param outcome - 'success' | 'duplicate' | 'clamped' | 'validation_failed'
 */
export function recordStageCompleteOutcome(outcome: StageCompleteOutcome): void {
  stageCompleteTotal.inc({ outcome });
}

/**
 * Records the claim-marker outcome of a stage_complete RPC invocation.
 *
 * @param result - 'fresh' | 'replay_rejected' | 'cooldown_active'
 */
export function recordStageClaim(result: StageClaimResult): void {
  stageClaimsTotal.inc({ result });
}

/**
 * Observes the claim-segment duration of a stage_complete RPC invocation.
 *
 * @param seconds - Wall-clock seconds from dedup-check start to claim resolution
 */
export function observeStageClaimSeconds(seconds: number): void {
  stageClaimSeconds.observe(seconds);
}
