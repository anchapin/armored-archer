/**
 * Admin authorization guard tests (issue #1075).
 *
 * Verifies that the shared fail-closed admin guard:
 * 1. rejects ordinary player sessions across ALL privileged RPC ids and
 *    audit-logs every rejection,
 * 2. rejects everyone when ADMIN_USER_IDS is unset or empty,
 * 3. passes through allowlisted admins for a representative set of RPCs
 *    (season_admin end_season, rollout_create_flag, rpcGetMetrics,
 *    admin_query_matches),
 * 4. never treats userId-less (server-key style) calls as admin.
 */

import { Runtime } from '../../types/nakama';
import { getAdminUserIds, isAdminUser, withAdminGuard } from '../admin_auth';
import {
  registerRpcAdminGetSeasonState,
  registerRpcAdminGetPlayerSeason,
  registerRpcAdminValidateSeason,
  registerRpcAdminTriggerSeasonEvent,
} from '../season_admin';
import { registerProgressiveRollout } from '../progressive_rollout';
import { registerRpcMetrics } from '../metrics';
import { registerRpcAdminQueryMatches } from '../matchmaker';
import {
  registerRpcGetMatchReplay,
  registerRpcListMatchReplays,
  registerRpcFlagMatchForQa,
  registerRpcAddDebugNotes,
  registerRpcReconstructMatchState,
} from '../match_replay';
import { registerDeploymentObservability } from '../deployment_observability';
import { registerErrorInsightRpcs } from '../error_insight_pipeline';

// ---- Mocks (mirror the owning modules' own test files) ----

jest.mock('../../config', () => ({
  config: {
    environment: 'development',
    metrics: {
      namespace: 'test',
      prefix: 'test',
      prometheusPort: 9100,
    },
    rateLimit: {
      enabled: false,
      endpoints: {},
    },
    nPlusOne: {
      enabled: false,
      metricsEnabled: false,
    },
    tracing: {
      enabled: false,
      serviceName: 'test',
      serviceVersion: '0.1.0',
      exporter: 'none',
      sampleRate: 0,
    },
    logger: {
      level: 'info',
      format: 'json',
      output: 'stdout',
      scrubLogs: false,
    },
  },
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logSystemEvent: jest.fn(),
}));

// Pass-through validation: JSON-parse the payload and hand it to the handler.
jest.mock('../validation', () => ({
  validatePayload: jest.fn((_schema: unknown, payload: string) => {
    try {
      const data = payload === '' ? {} : JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }
  }),
  ZodSchemas: {},
  createValidationErrorResponse: jest.fn((rpcName: string, error: string) =>
    JSON.stringify({ success: false, error })
  ),
}));

// season_admin + matchmaker dependency (same shape their own tests use).
jest.mock('../season_system', () => ({
  getCurrentSeason: jest.fn(() => ({
    season_id: 'season_1',
    season_number: 1,
    start_time: 1000000,
    end_time: 1000000 + 28 * 24 * 60 * 60 * 1000,
    status: 'active',
    duration_weeks: 4,
  })),
  getLeaderboardEntry: jest.fn(),
  getPlayerPrestigeRecord: jest.fn(),
  getPlayerCosmetics: jest.fn(),
  calculateSoftResetElo: jest.fn(),
  getRankDecayInfo: jest.fn(),
  calculateRewards: jest.fn(),
  updatePlayerPrestigeRecord: jest.fn(),
  grantPrestigeRewards: jest.fn(),
  addPlayerCosmetic: jest.fn(),
  applyEloUpdates: jest.fn(),
  getEloKFactors: jest.fn(() => ({ winnerK: 32, loserK: 32 })),
  recordPlayerActivity: jest.fn(),
}));

jest.mock('../season_leaderboard', () => ({
  getDecayConfig: jest.fn(),
  calculateDecayAmount: jest.fn(),
  getSeasonArchive: jest.fn(),
  getDaysInactive: jest.fn(),
}));

jest.mock('../season_telemetry', () => ({
  recordSeasonEndSnapshot: jest.fn(),
}));

jest.mock('../anti_cheat', () => ({
  isPlayerFlagged: jest.fn(),
  getFlagReason: jest.fn(),
  recordMatchResult: jest.fn(),
  getPlayerMatchHistory: jest.fn(),
}));

// NOTE: '../audit' stays REAL so the guard's logAudit integration
// (nk.storageWrite into the audit_logs collection) is exercised.

const ADMIN_ID = 'admin-user-1';
const PLAYER_ID = 'player-7';

/** Every privileged RPC id gated by the shared admin guard (issue #1075). */
const GATED_RPC_IDS = [
  'armored_archer/admin_get_season_state',
  'armored_archer/admin_get_player_season',
  'armored_archer/admin_validate_season',
  'armored_archer/admin_trigger_season_event',
  'armored_archer/rollout_create_flag',
  'armored_archer/rollout_update_flag',
  'armored_archer/rollout_list_flags',
  'armored_archer/rollout_advance',
  'armored_archer/rollout_rollback',
  'armored_archer/rollout_metrics',
  'armored_archer/rollout_health',
  'armored_archer/rollout_metrics_prometheus',
  'armored_archer/metrics',
  'armored_archer/n_plus_one_report',
  'armored_archer/admin_query_matches',
  'armored_archer/get_match_replay',
  'armored_archer/list_match_replays',
  'armored_archer/flag_match_for_qa',
  'armored_archer/add_debug_notes',
  'armored_archer/reconstruct_match_state',
  'armored_archer/deployment_record',
  'armored_archer/deployment_health',
  'armored_archer/deployment_history',
  'armored_archer/deployment_metrics',
  'armored_archer/error_insights_dashboard',
  'armored_archer/error_insights_summary',
  'armored_archer/error_insights_patterns',
  'armored_archer/error_insights_stats',
  'armored_archer/error_insights_dismiss',
];

function createMockContext(userId: string): Runtime.Context {
  return {
    userId,
    username: userId,
    variables: {},
    env: {},
    sessionExpiry: Date.now() + 3600000,
    ipAddress: '203.0.113.10',
  } as Runtime.Context;
}

function createMockNakama(): Runtime.Nakama {
  return {
    storageWrite: jest.fn(),
    storageList: jest.fn().mockReturnValue([]),
    dbQuery: jest.fn().mockReturnValue([]),
    leaderboardRecordList: jest.fn().mockReturnValue([]),
  } as unknown as Runtime.Nakama;
}

function createMockLogger(): Runtime.Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Runtime.Logger;
}

/** Register every gated RPC against a capturing initializer. */
function buildRegisteredHandlers(): Map<string, (...args: unknown[]) => unknown> {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const initializer = {
    registerRpc: jest.fn((id: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(id, fn);
    }),
  } as unknown as Runtime.Initializer;

  registerRpcAdminGetSeasonState(initializer);
  registerRpcAdminGetPlayerSeason(initializer);
  registerRpcAdminValidateSeason(initializer);
  registerRpcAdminTriggerSeasonEvent(initializer);
  registerProgressiveRollout(initializer);
  registerRpcMetrics(initializer);
  registerRpcAdminQueryMatches(initializer);
  registerRpcGetMatchReplay(initializer);
  registerRpcListMatchReplays(initializer);
  registerRpcFlagMatchForQa(initializer);
  registerRpcAddDebugNotes(initializer);
  registerRpcReconstructMatchState(initializer);
  registerDeploymentObservability(initializer);
  registerErrorInsightRpcs(initializer);

  return handlers;
}

/** Audit entries the real logAudit wrote into the mock nk storage sink. */
function deniedAuditEntries(
  nk: Runtime.Nakama,
  rpcId: string
): Array<{ user_id: string; resource: string; action: string }> {
  // logAudit invokes nk.storageWrite with a batch array; take each write.
  const writes = (nk.storageWrite as jest.Mock).mock.calls.flatMap(
    (call: unknown[]) =>
      (call[0] as Array<{ collection: string; value: string } | undefined>) ?? []
  );
  return writes
    .filter((write) => write.collection === 'audit_logs')
    .map((write) => JSON.parse(write.value))
    .filter(
      (entry) => entry.action === 'admin_rpc_access_denied' && entry.resource === rpcId
    );
}

const ORIGINAL_ADMIN_USER_IDS = process.env.ADMIN_USER_IDS;

afterAll(() => {
  if (ORIGINAL_ADMIN_USER_IDS === undefined) {
    delete process.env.ADMIN_USER_IDS;
  } else {
    process.env.ADMIN_USER_IDS = ORIGINAL_ADMIN_USER_IDS;
  }
});

// =================== Allowlist parsing ===================

describe('getAdminUserIds / isAdminUser', () => {
  afterEach(() => {
    delete process.env.ADMIN_USER_IDS;
  });

  it('unset ADMIN_USER_IDS yields an empty allowlist (fail-closed)', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(getAdminUserIds().size).toBe(0);
    expect(isAdminUser(ADMIN_ID)).toBe(false);
  });

  it('blank ADMIN_USER_IDS yields an empty allowlist', () => {
    process.env.ADMIN_USER_IDS = '   ';
    expect(getAdminUserIds().size).toBe(0);
    expect(isAdminUser(ADMIN_ID)).toBe(false);
  });

  it('parses comma-separated ids with whitespace and empty segments tolerated', () => {
    process.env.ADMIN_USER_IDS = ` ${ADMIN_ID} ,, other-admin `;
    expect(getAdminUserIds()).toEqual(new Set([ADMIN_ID, 'other-admin']));
    expect(isAdminUser(ADMIN_ID)).toBe(true);
    expect(isAdminUser('other-admin')).toBe(true);
    expect(isAdminUser(PLAYER_ID)).toBe(false);
  });

  it('never treats missing or empty userId as admin (server-key path)', () => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser('')).toBe(false);
  });
});

// =================== Guard unit behavior ===================

describe('withAdminGuard', () => {
  let mockNk: Runtime.Nakama;
  let mockLogger: Runtime.Logger;

  beforeEach(() => {
    mockNk = createMockNakama();
    mockLogger = createMockLogger();
    delete process.env.ADMIN_USER_IDS;
  });

  it('rejects a non-allowlisted caller without invoking the handler', async () => {
    const inner = jest.fn(() => JSON.stringify({ success: true, secret: 'ops-data' }));
    const guarded = withAdminGuard('armored_archer/test_rpc', inner);

    const result = JSON.parse(
      (await guarded(createMockContext(PLAYER_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result).toEqual({
      success: false,
      error: 'Not authorized',
      rpc: 'armored_archer/test_rpc',
    });
    expect(inner).not.toHaveBeenCalled();

    // Audit entry recorded against the caller.
    const entries = deniedAuditEntries(mockNk, 'armored_archer/test_rpc');
    expect(entries).toHaveLength(1);
    expect(entries[0].user_id).toBe(PLAYER_ID);

    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('invokes the handler and propagates its result for an allowlisted admin', async () => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    const inner = jest.fn(() => JSON.stringify({ success: true, data: 'ok' }));
    const guarded = withAdminGuard('armored_archer/test_rpc', inner);

    const result = JSON.parse(
      (await guarded(createMockContext(ADMIN_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result).toEqual({ success: true, data: 'ok' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(deniedAuditEntries(mockNk, 'armored_archer/test_rpc')).toHaveLength(0);
  });

  it('supports async handlers', async () => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    const inner = jest.fn(async () => JSON.stringify({ success: true }));
    const guarded = withAdminGuard('armored_archer/test_rpc', inner);

    const result = JSON.parse(
      (await guarded(createMockContext(ADMIN_ID), mockLogger, mockNk, '{}')) as string
    );
    expect(result.success).toBe(true);
  });

  it('still rejects (and does not throw) when the audit sink fails', async () => {
    (mockNk.storageWrite as jest.Mock).mockImplementation(() => {
      throw new Error('storage down');
    });
    const inner = jest.fn();
    const guarded = withAdminGuard('armored_archer/test_rpc', inner);

    const result = JSON.parse(
      (await guarded(createMockContext(PLAYER_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    expect(inner).not.toHaveBeenCalled();
  });
});

// =================== Fail-closed across every privileged RPC id ===================

describe('admin gate: ordinary player rejected + audit-logged on every privileged RPC', () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>;
  let mockNk: Runtime.Nakama;
  let mockLogger: Runtime.Logger;

  beforeEach(() => {
    delete process.env.ADMIN_USER_IDS;
    handlers = buildRegisteredHandlers();
    mockNk = createMockNakama();
    mockLogger = createMockLogger();
  });

  it('registers the expected privileged surface', () => {
    for (const id of GATED_RPC_IDS) {
      expect(handlers.has(id)).toBe(true);
    }
  });

  it.each(GATED_RPC_IDS)('rejects ordinary player session for %s', async (rpcId) => {
    const handler = handlers.get(rpcId)!;
    const result = JSON.parse(
      (await handler(createMockContext(PLAYER_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');

    const entries = deniedAuditEntries(mockNk, rpcId);
    expect(entries).toHaveLength(1);
    expect(entries[0].user_id).toBe(PLAYER_ID);
  });
});

describe('admin gate: empty ADMIN_USER_IDS rejects everyone (fail-closed)', () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>;
  let mockNk: Runtime.Nakama;
  let mockLogger: Runtime.Logger;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = '';
    handlers = buildRegisteredHandlers();
    mockNk = createMockNakama();
    mockLogger = createMockLogger();
  });

  it.each([
    'armored_archer/admin_trigger_season_event',
    'armored_archer/rollout_create_flag',
    'armored_archer/metrics',
    'armored_archer/admin_query_matches',
  ])('rejects even the would-be admin caller for %s', async (rpcId) => {
    const handler = handlers.get(rpcId)!;
    const result = JSON.parse(
      (await handler(createMockContext(ADMIN_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    expect(deniedAuditEntries(mockNk, rpcId)).toHaveLength(1);
  });
});

// =================== Allowlisted admin pass-through (representative RPCs) ===================

describe('admin gate: allowlisted admin reaches the real handler', () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>;
  let mockNk: Runtime.Nakama;
  let mockLogger: Runtime.Logger;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    handlers = buildRegisteredHandlers();
    mockNk = createMockNakama();
    mockLogger = createMockLogger();
  });

  it('admin_trigger_season_event end_season dry-run executes behind the gate', async () => {
    // The confirmation_token === season_id check alone was the old (guessable)
    // guard — the admin gate must now sit in front of it (issue #1075).
    (mockNk.leaderboardRecordList as jest.Mock).mockReturnValue([
      { rank: 1, ownerId: 'player-1', score: 1500, metadata: '{}', username: 'player-1' },
    ]);

    const handler = handlers.get('armored_archer/admin_trigger_season_event')!;
    const payload = JSON.stringify({
      action: 'end_season',
      season_id: 'season_1',
      dry_run: true,
      confirmation_token: 'season_1',
    });

    const result = JSON.parse(
      (await handler(createMockContext(ADMIN_ID), mockLogger, mockNk, payload)) as string
    );

    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.season_id).toBe('season_1');
    expect(deniedAuditEntries(mockNk, 'armored_archer/admin_trigger_season_event')).toHaveLength(
      0
    );
  });

  it('rollout_create_flag creates a feature flag behind the gate', async () => {
    const handler = handlers.get('armored_archer/rollout_create_flag')!;
    const payload = JSON.stringify({
      name: 'admin_gate_test_flag',
      description: 'created by an allowlisted admin',
      phases: [
        {
          phase: 'canary',
          percentage: 5,
          durationMinutes: 60,
          minHealthPercent: 95,
          maxErrorRatePercent: 2,
          maxLatencyMs: 100,
          sampleSize: 100,
          autoPromote: false,
          rollbackCriteria: { errorRateThreshold: 5, latencyThreshold: 250, healthCheckFails: 3 },
        },
      ],
    });

    const result = JSON.parse(
      (await handler(createMockContext(ADMIN_ID), mockLogger, mockNk, payload)) as string
    );

    expect(result.success).toBe(true);
    expect(result.featureFlag.name).toBe('admin_gate_test_flag');
  });

  it('rpcGetMetrics returns the combined metrics dump behind the gate', async () => {
    const handler = handlers.get('armored_archer/metrics')!;

    const result = (await handler(
      createMockContext(ADMIN_ID),
      mockLogger,
      mockNk,
      '{}'
    )) as string;

    expect(result).not.toContain('Not authorized');
    expect(result).toContain('# Deployment metrics');
  });

  it('admin_query_matches executes the match query behind the gate', async () => {
    (mockNk.dbQuery as jest.Mock)
      .mockReturnValueOnce([{ total: 0 }]) // COUNT query
      .mockReturnValueOnce([]); // rows query

    const handler = handlers.get('armored_archer/admin_query_matches')!;

    const result = JSON.parse(
      (await handler(createMockContext(ADMIN_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result.success).toBe(true);
    expect(result.matches).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('a caller that is allowlisted for one id is still rejected when removed from the list', async () => {
    const handler = handlers.get('armored_archer/rollout_create_flag')!;
    process.env.ADMIN_USER_IDS = 'somebody-else';

    const result = JSON.parse(
      (await handler(createMockContext(ADMIN_ID), mockLogger, mockNk, '{}')) as string
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
  });
});
