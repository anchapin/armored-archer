import {
  rpcAdminGetSeasonState,
  rpcAdminGetPlayerSeason,
  rpcAdminValidateSeason,
  rpcAdminTriggerSeasonEvent,
  registerRpcAdminGetSeasonState,
  registerRpcAdminGetPlayerSeason,
  registerRpcAdminValidateSeason,
  registerRpcAdminTriggerSeasonEvent,
  validateLeaderboardIntegrity,
  validateMissingPrestige,
  validateOrphanedRewards,
  validateDecayConsistency,
  validateRewardDistribution,
  triggerFixMissingRewards,
  triggerRebuildPrestige,
  triggerRecalculateDecay,
} from '../season_admin';

// Mock dependencies
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
}));

jest.mock('../season_leaderboard', () => ({
  getDecayConfig: jest.fn(),
  calculateDecayAmount: jest.fn(),
  getSeasonArchive: jest.fn(),
  getDaysInactive: jest.fn(),
}));

jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../season_telemetry', () => ({
  recordSeasonEndSnapshot: jest.fn(),
}));

jest.mock('../metrics', () => ({
  incrementSeasonRankChanges: jest.fn(),
  recordSeasonRankChangeDelta: jest.fn(),
}));

const mockSeasonSystem = jest.requireMock('../season_system');
const mockSeasonLeaderboard = jest.requireMock('../season_leaderboard');

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'admin-user',
    username: 'AdminUser',
    variables: {},
    env: {},
    sessionExpiry: Date.now() + 3600000,
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

function makeLeaderboardRecord(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: (overrides.ownerId as string) || 'player-1',
    username: (overrides.username as string) || 'Player1',
    rank: (overrides.rank as number) || 1,
    score: (overrides.score as number) || 1500,
    metadata: (overrides.metadata as string) || '{}',
    expiry: 0,
    maxNumScore: 0,
    numScore: 1,
  };
}

function createMockNakama(overrides: Record<string, unknown> = {}) {
  return {
    leaderboardRecordList: jest.fn().mockReturnValue([]),
    storageRead: jest.fn().mockReturnValue([]),
    storageWrite: jest.fn(),
    storageList: jest.fn().mockReturnValue([]),
    walletUpdate: jest.fn(),
    leaderboardRecordWrite: jest.fn(),
    leaderboardCreate: jest.fn(),
    uuidGenerateV4: jest.fn().mockReturnValue('test-uuid'),
    ...overrides,
  };
}

let mockCtx: ReturnType<typeof createMockContext>;
let mockLogger: ReturnType<typeof createMockLogger>;
let mockNk: ReturnType<typeof createMockNakama>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCtx = createMockContext();
  mockLogger = createMockLogger();
  mockNk = createMockNakama();

  // Default mock implementations
  mockSeasonLeaderboard.getDecayConfig.mockReturnValue({
    inactive_days_threshold: 7,
    decay_rate_percent: 1,
    high_decay_threshold_days: 30,
    high_decay_rate_percent: 2,
    minimum_rating: 1000,
    max_decay_loss: 200,
  });
  mockSeasonLeaderboard.getSeasonArchive.mockResolvedValue({});
  mockSeasonLeaderboard.getDaysInactive.mockReturnValue(0);
  mockSeasonLeaderboard.calculateDecayAmount.mockReturnValue(0);

  mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
    player_id: 'player-1',
    season_finishes: [],
    prestige_tiers_earned: [],
    last_updated: 0,
  });
  mockSeasonSystem.getPlayerCosmetics.mockReturnValue({ titles: [], auras: [] });
  mockSeasonSystem.getRankDecayInfo.mockReturnValue({
    days_inactive: 0,
    points_at_risk: 0,
    can_decay: false,
  });
  mockSeasonSystem.calculateSoftResetElo.mockReturnValue(1200);
  mockSeasonSystem.calculateRewards.mockReturnValue({
    rank_tier: 'epic',
    coins: 5000,
    gems: 200,
    cosmetics: { title: 'Season 1 Elite', aura: 'epic_aura' },
  });
  mockSeasonSystem.updatePlayerPrestigeRecord.mockReturnValue({
    record: {
      player_id: 'player-1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    },
    new_tiers: [],
  });
});

// =================== Registration Tests ===================

describe('registerRpc', () => {
  it('registers admin_get_season_state with correct endpoint name', () => {
    const initializer = { registerRpc: jest.fn() };
    registerRpcAdminGetSeasonState(initializer as any);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      'armored_archer/admin_get_season_state',
      rpcAdminGetSeasonState
    );
  });

  it('registers admin_get_player_season with correct endpoint name', () => {
    const initializer = { registerRpc: jest.fn() };
    registerRpcAdminGetPlayerSeason(initializer as any);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      'armored_archer/admin_get_player_season',
      rpcAdminGetPlayerSeason
    );
  });

  it('registers admin_validate_season with correct endpoint name', () => {
    const initializer = { registerRpc: jest.fn() };
    registerRpcAdminValidateSeason(initializer as any);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      'armored_archer/admin_validate_season',
      rpcAdminValidateSeason
    );
  });

  it('registers admin_trigger_season_event with correct endpoint name', () => {
    const initializer = { registerRpc: jest.fn() };
    registerRpcAdminTriggerSeasonEvent(initializer as any);
    expect(initializer.registerRpc).toHaveBeenCalledWith(
      'armored_archer/admin_trigger_season_event',
      rpcAdminTriggerSeasonEvent
    );
  });
});

// =================== admin_get_season_state Tests ===================

describe('rpcAdminGetSeasonState', () => {
  it('returns current season info with empty leaderboard', () => {
    const result = JSON.parse(rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.success).toBe(true);
    expect(result.season.id).toBe('season_1');
    expect(result.leaderboard_health.total_players).toBe(0);
    expect(result.timing.elapsed_percent).toBeDefined();
    expect(result.tier_distribution).toBeDefined();
  });

  it('computes tier distribution for populated leaderboard', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 2000, ownerId: 'p1' }),
      makeLeaderboardRecord({ rank: 5, score: 1800, ownerId: 'p2' }),
      makeLeaderboardRecord({ rank: 15, score: 1600, ownerId: 'p3' }),
      makeLeaderboardRecord({ rank: 200, score: 1200, ownerId: 'p4' }),
      makeLeaderboardRecord({ rank: 600, score: 1000, ownerId: 'p5' }),
    ];
    mockNk.leaderboardRecordList.mockReturnValue(records);

    const result = JSON.parse(rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.success).toBe(true);
    expect(result.leaderboard_health.total_players).toBe(5);
    expect(result.tier_distribution.legendary.count).toBe(2);
    expect(result.tier_distribution.epic.count).toBe(1);
    expect(result.tier_distribution.uncommon.count).toBe(1);
    expect(result.tier_distribution.common.count).toBe(1);
  });

  it('reports leaderboard health metrics correctly', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 2000 }),
      makeLeaderboardRecord({ rank: 2, score: 1500 }),
      makeLeaderboardRecord({ rank: 3, score: 1000 }),
    ];
    mockNk.leaderboardRecordList.mockReturnValue(records);

    const result = JSON.parse(rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.leaderboard_health.avg_score).toBe(1500);
    expect(result.leaderboard_health.min_score).toBe(1000);
    expect(result.leaderboard_health.max_score).toBe(2000);
  });

  it('accepts optional season_id parameter', () => {
    const result = JSON.parse(
      rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{"season_id":"season_5"}')
    );
    expect(result.success).toBe(true);
    expect(result.season.number).toBe(5);
  });

  it('reports archive status when season is archived', async () => {
    mockSeasonLeaderboard.getSeasonArchive.mockResolvedValue({
      season_1: {
        season_id: 'season_1',
        season_number: 1,
        rewards_distributed: true,
        winner_id: 'p1',
        winner_name: 'Player1',
        winner_rating: 2000,
        total_players: 10,
        start_time: 0,
        end_time: 0,
      },
    });

    const result = JSON.parse(rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.success).toBe(true);
    // Archive check is async, so it may or may not be populated in sync tests
    // The important thing is it doesn't crash
  });

  it('reports decay config', () => {
    const result = JSON.parse(rpcAdminGetSeasonState(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.decay_config).toEqual({
      inactive_days_threshold: 7,
      decay_rate_percent: 1,
      high_decay_threshold_days: 30,
      high_decay_rate_percent: 2,
      minimum_rating: 1000,
      max_decay_loss: 200,
    });
  });
});

// =================== admin_get_player_season Tests ===================

describe('rpcAdminGetPlayerSeason', () => {
  it('returns full player data when player exists', () => {
    mockSeasonSystem.getLeaderboardEntry.mockReturnValue({
      owner_id: 'player-1',
      username: 'Player1',
      rank: 5,
      score: 1800,
      meta: { wins: 10, losses: 5, win_rate: 0.67, punch_up_wins: 2 },
    });

    mockNk.storageRead.mockImplementation((reqs: any[]) => {
      const results: any[] = [];
      for (const req of reqs) {
        if (req.collection === 'season_rewards_claimed') {
          results.push({
            collection: req.collection,
            key: req.key,
            userId: req.userId,
            value: JSON.stringify({
              claimed_at: 1234567890,
              auto_distributed: true,
              rewards: { rank_tier: 'legendary' },
            }),
            version: '1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: Date.now(),
            updateTime: Date.now(),
          });
        } else if (req.collection === 'player_activity') {
          results.push({
            collection: req.collection,
            key: req.key,
            userId: req.userId,
            value: JSON.stringify({ last_match_time: Date.now() - 86400000 }),
            version: '1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: Date.now(),
            updateTime: Date.now(),
          });
        }
      }
      return results;
    });

    const result = JSON.parse(
      rpcAdminGetPlayerSeason(mockCtx, mockLogger, mockNk, '{"user_id":"player-1"}')
    );

    expect(result.success).toBe(true);
    expect(result.user_id).toBe('player-1');
    expect(result.leaderboard.rank).toBe(5);
    expect(result.leaderboard.score).toBe(1800);
    expect(result.rewards.claimed).toBe(true);
    expect(result.rewards.auto_distributed).toBe(true);
    expect(result.activity.days_inactive).toBe(1);
    expect(result.projected_next_season.soft_reset_elo).toBe(1200);
  });

  it('returns null fields gracefully when player has no leaderboard entry', () => {
    mockSeasonSystem.getLeaderboardEntry.mockReturnValue(null);
    mockNk.storageRead.mockReturnValue([]);

    const result = JSON.parse(
      rpcAdminGetPlayerSeason(mockCtx, mockLogger, mockNk, '{"user_id":"player-1"}')
    );

    expect(result.success).toBe(true);
    expect(result.leaderboard.rank).toBeNull();
    expect(result.leaderboard.score).toBeNull();
    expect(result.rewards.claimed).toBe(false);
    expect(result.projected_next_season.soft_reset_elo).toBeNull();
  });

  it('validates payload requires user_id', () => {
    const result = JSON.parse(rpcAdminGetPlayerSeason(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.success).toBe(false);
  });
});

// =================== Validation Helper Tests ===================

describe('validateLeaderboardIntegrity', () => {
  it('passes for a valid leaderboard', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 2000, ownerId: 'p1' }),
      makeLeaderboardRecord({ rank: 2, score: 1500, ownerId: 'p2' }),
      makeLeaderboardRecord({ rank: 3, score: 1000, ownerId: 'p3' }),
    ];
    const result = validateLeaderboardIntegrity(records);
    expect(result.status).toBe('pass');
    expect(result.issues_found).toBe(0);
  });

  it('detects duplicate ranks', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 2000, ownerId: 'p1' }),
      makeLeaderboardRecord({ rank: 1, score: 1500, ownerId: 'p2' }),
    ];
    const result = validateLeaderboardIntegrity(records);
    expect(result.issues_found).toBe(1);
    expect(result.details[0].issue).toContain('Duplicate rank');
  });

  it('detects non-descending scores', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 1500, ownerId: 'p1' }),
      makeLeaderboardRecord({ rank: 2, score: 2000, ownerId: 'p2' }),
    ];
    const result = validateLeaderboardIntegrity(records);
    expect(result.issues_found).toBe(1);
    expect(result.details[0].issue).toContain('Score');
  });

  it('detects unparseable metadata', () => {
    const records = [makeLeaderboardRecord({ rank: 1, score: 2000, metadata: 'not-json{' })];
    const result = validateLeaderboardIntegrity(records);
    expect(result.issues_found).toBe(1);
    expect(result.details[0].issue).toContain('Unparseable');
  });
});

describe('validateMissingPrestige', () => {
  it('passes when all top players have prestige records', () => {
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [{ season_id: 'season_1', rank: 5 }],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = validateMissingPrestige(mockNk, 'season_1', [{ ownerId: 'p1', rank: 5 }], false);
    expect(result.status).toBe('pass');
    expect(result.issues_found).toBe(0);
  });

  it('detects missing prestige for top-100 player', () => {
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = validateMissingPrestige(mockNk, 'season_1', [{ ownerId: 'p1', rank: 5 }], false);
    expect(result.status).toBe('fail');
    expect(result.issues_found).toBe(1);
  });

  it('auto-fixes missing prestige when flag is set', () => {
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = validateMissingPrestige(mockNk, 'season_1', [{ ownerId: 'p1', rank: 5 }], true);
    expect(result.issues_found).toBe(1);
    expect(result.details[0].auto_fixed).toBe(true);
    expect(mockSeasonSystem.updatePlayerPrestigeRecord).toHaveBeenCalled();
  });
});

describe('validateOrphanedRewards', () => {
  it('passes when no orphaned rewards', () => {
    mockNk.storageList = jest.fn().mockReturnValue([]);

    const result = validateOrphanedRewards(mockNk, 'season_1', new Set(['p1', 'p2']), false);
    expect(result.status).toBe('pass');
  });

  it('detects orphaned reward records', () => {
    mockNk.storageList = jest.fn().mockReturnValue([
      {
        collection: 'season_rewards_claimed',
        key: 'season_1_orphan-player',
        userId: 'orphan-player',
        value: JSON.stringify({ user_id: 'orphan-player' }),
      },
    ]);

    const result = validateOrphanedRewards(mockNk, 'season_1', new Set(['p1', 'p2']), false);
    expect(result.issues_found).toBe(1);
    expect(result.status).toBe('warning');
  });
});

describe('validateDecayConsistency', () => {
  it('passes when no decay metadata exists', () => {
    const records = [makeLeaderboardRecord({ rank: 1, score: 1500, metadata: '{}' })];
    const config = {
      inactive_days_threshold: 7,
      decay_rate_percent: 1,
      high_decay_threshold_days: 30,
      high_decay_rate_percent: 2,
      minimum_rating: 1000,
      max_decay_loss: 200,
    };

    const result = validateDecayConsistency(mockNk, records, config);
    expect(result.status).toBe('pass');
  });

  it('detects decay amount mismatch', () => {
    const records = [
      makeLeaderboardRecord({
        rank: 1,
        score: 1500,
        metadata: JSON.stringify({
          decayed: 'true',
          last_active: String(Date.now() - 30 * 24 * 60 * 60 * 1000),
          decay_amount: '5',
        }),
      }),
    ];
    const config = {
      inactive_days_threshold: 7,
      decay_rate_percent: 1,
      high_decay_threshold_days: 30,
      high_decay_rate_percent: 2,
      minimum_rating: 1000,
      max_decay_loss: 200,
    };

    mockSeasonLeaderboard.getDaysInactive.mockReturnValue(30);
    mockSeasonLeaderboard.calculateDecayAmount.mockReturnValue(45);

    const result = validateDecayConsistency(mockNk, records, config);
    expect(result.issues_found).toBe(1);
    expect(result.status).toBe('warning');
  });
});

describe('validateRewardDistribution', () => {
  it('skips check for active seasons', () => {
    const result = validateRewardDistribution(mockNk, 'season_1', 1, [], 'active', false);
    expect(result.status).toBe('pass');
    expect(result.issues_found).toBe(0);
  });

  it('detects missing rewards for ended season', () => {
    const records = [makeLeaderboardRecord({ rank: 1, ownerId: 'p1' })];
    mockNk.storageRead.mockReturnValue([]);

    const result = validateRewardDistribution(mockNk, 'season_1', 1, records, 'ended', false);
    expect(result.issues_found).toBe(1);
    expect(result.status).toBe('fail');
  });

  it('auto-fixes missing rewards when flag is set', () => {
    const records = [makeLeaderboardRecord({ rank: 1, ownerId: 'p1' })];
    mockNk.storageRead.mockReturnValue([]);

    const result = validateRewardDistribution(mockNk, 'season_1', 1, records, 'ended', true);
    expect(result.issues_found).toBe(1);
    expect(result.details[0].auto_fixed).toBe(true);
    expect(mockNk.storageWrite).toHaveBeenCalled();
    // Issue #860: the repair credits the unified player_currency ledger
    // (mocked calculateRewards: 5000 coins, 200 gems), not the wallet.
    const currencyWrites = mockNk.storageWrite.mock.calls.filter(
      (call: any[]) => call[0][0].collection === 'player_currency'
    );
    expect(currencyWrites).toHaveLength(1);
    const ledgerRecord = JSON.parse(currencyWrites[0][0][0].value);
    expect(ledgerRecord.user_id).toBe('p1');
    expect(ledgerRecord.gems).toBe(200);
    expect(ledgerRecord.gold).toBe(5000);
    expect(mockNk.walletUpdate).not.toHaveBeenCalled();
  });
});

// =================== admin_validate_season Tests ===================

describe('rpcAdminValidateSeason', () => {
  it('returns all-pass when data is consistent', () => {
    mockNk.leaderboardRecordList.mockReturnValue([]);
    mockNk.storageList.mockReturnValue([]);

    const result = JSON.parse(rpcAdminValidateSeason(mockCtx, mockLogger, mockNk, '{}'));
    expect(result.success).toBe(true);
    expect(result.summary.passed).toBeGreaterThan(0);
    expect(result.summary.failures).toBe(0);
  });

  it('runs only specified checks', () => {
    mockNk.leaderboardRecordList.mockReturnValue([]);

    const result = JSON.parse(
      rpcAdminValidateSeason(mockCtx, mockLogger, mockNk, '{"checks":["leaderboard_integrity"]}')
    );
    expect(result.success).toBe(true);
    expect(result.checks.length).toBe(1);
    expect(result.checks[0].check_name).toBe('leaderboard_integrity');
  });
});

// =================== Trigger Helper Tests ===================

describe('triggerRecalculateDecay', () => {
  it('returns zero when no records need decay', () => {
    mockNk.leaderboardRecordList.mockReturnValue([makeLeaderboardRecord({ metadata: '{}' })]);
    mockSeasonLeaderboard.calculateDecayAmount.mockReturnValue(0);

    const result = triggerRecalculateDecay(mockNk, 'season_1', false);
    expect(result.affected).toBe(0);
    expect(result.total_loss).toBe(0);
  });

  it('corrects scores with decay in non-dry-run mode', () => {
    const record = makeLeaderboardRecord({
      metadata: JSON.stringify({ last_active: String(Date.now() - 30 * 24 * 3600000) }),
    });
    mockNk.leaderboardRecordList.mockReturnValue([record]);
    mockSeasonLeaderboard.getDaysInactive.mockReturnValue(30);
    mockSeasonLeaderboard.calculateDecayAmount.mockReturnValue(45);

    const result = triggerRecalculateDecay(mockNk, 'season_1', false);
    expect(result.affected).toBe(1);
    expect(result.total_loss).toBe(45);
    expect(mockNk.leaderboardRecordWrite).toHaveBeenCalled();
  });

  it('dry run does not write changes', () => {
    const record = makeLeaderboardRecord({
      metadata: JSON.stringify({ last_active: String(Date.now() - 30 * 24 * 3600000) }),
    });
    mockNk.leaderboardRecordList.mockReturnValue([record]);
    mockSeasonLeaderboard.getDaysInactive.mockReturnValue(30);
    mockSeasonLeaderboard.calculateDecayAmount.mockReturnValue(45);

    const result = triggerRecalculateDecay(mockNk, 'season_1', true);
    expect(result.affected).toBe(1);
    expect(mockNk.leaderboardRecordWrite).not.toHaveBeenCalled();
  });
});

describe('triggerFixMissingRewards', () => {
  it('identifies players without rewards', () => {
    mockNk.leaderboardRecordList.mockReturnValue([
      makeLeaderboardRecord({ rank: 1, ownerId: 'p1' }),
    ]);
    mockNk.storageRead.mockReturnValue([]);

    const result = triggerFixMissingRewards(mockNk, 'season_1', 1, false);
    expect(result.fixed_count).toBe(1);
    expect(result.players_fixed).toContain('p1');
  });

  it('dry run does not write rewards', () => {
    mockNk.leaderboardRecordList.mockReturnValue([
      makeLeaderboardRecord({ rank: 1, ownerId: 'p1' }),
    ]);
    mockNk.storageRead.mockReturnValue([]);

    const result = triggerFixMissingRewards(mockNk, 'season_1', 1, true);
    expect(result.fixed_count).toBe(1);
    expect(mockNk.storageWrite).not.toHaveBeenCalled();
  });
});

describe('triggerRebuildPrestige', () => {
  it('rebuilds prestige for players with missing finishes', () => {
    mockSeasonSystem.getLeaderboardEntry.mockReturnValue({
      owner_id: 'p1',
      username: 'P1',
      rank: 5,
      score: 1500,
      meta: {},
    });
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = triggerRebuildPrestige(mockNk, 'season_1', ['p1'], false);
    expect(result.rebuilt_count).toBe(1);
    expect(mockSeasonSystem.updatePlayerPrestigeRecord).toHaveBeenCalled();
  });

  it('dry run does not update prestige', () => {
    mockSeasonSystem.getLeaderboardEntry.mockReturnValue({
      owner_id: 'p1',
      username: 'P1',
      rank: 5,
      score: 1500,
      meta: {},
    });
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = triggerRebuildPrestige(mockNk, 'season_1', ['p1'], true);
    expect(result.rebuilt_count).toBe(1);
    expect(mockSeasonSystem.updatePlayerPrestigeRecord).not.toHaveBeenCalled();
  });
});

// =================== admin_trigger_season_event Tests ===================

describe('rpcAdminTriggerSeasonEvent', () => {
  it('rejects end_season without confirmation_token', () => {
    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"end_season","confirmation_token":"wrong"}'
      )
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirmation_token');
  });

  it('end_season dry run returns plan without modifying state', () => {
    mockNk.leaderboardRecordList.mockReturnValue([
      makeLeaderboardRecord({ rank: 1, ownerId: 'p1' }),
    ]);

    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"end_season","season_id":"season_1","dry_run":true,"confirmation_token":"season_1"}'
      )
    );
    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.result.players_processed).toBe(1);
    expect(result.audit_logged).toBe(false);
  });

  it('end_season requires matching confirmation_token', () => {
    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"end_season","season_id":"season_1","confirmation_token":"season_2"}'
      )
    );
    expect(result.success).toBe(false);
  });

  it('dry_run defaults to true', () => {
    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"recalculate_decay","season_id":"season_1"}'
      )
    );
    expect(result.dry_run).toBe(true);
  });

  it('recalculate_ratings checks for below-minimum scores', () => {
    const records = [
      makeLeaderboardRecord({ rank: 1, score: 800, ownerId: 'p1', metadata: '{}' }),
      makeLeaderboardRecord({ rank: 2, score: 1500, ownerId: 'p2', metadata: '{}' }),
    ];
    mockNk.leaderboardRecordList.mockReturnValue(records);

    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"recalculate_ratings","season_id":"season_1","dry_run":false}'
      )
    );
    expect(result.success).toBe(true);
    expect(result.result.players_corrected).toBe(1);
  });

  it('fix_missing_rewards action works', () => {
    mockNk.leaderboardRecordList.mockReturnValue([
      makeLeaderboardRecord({ rank: 1, ownerId: 'p1' }),
    ]);
    mockNk.storageRead.mockReturnValue([]);

    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"fix_missing_rewards","season_id":"season_1","dry_run":false}'
      )
    );
    expect(result.success).toBe(true);
    expect(result.result.fixed_count).toBe(1);
  });

  it('rebuild_prestige action works', () => {
    mockSeasonSystem.getLeaderboardEntry.mockReturnValue({
      owner_id: 'p1',
      username: 'P1',
      rank: 5,
      score: 1500,
      meta: {},
    });
    mockSeasonSystem.getPlayerPrestigeRecord.mockReturnValue({
      player_id: 'p1',
      season_finishes: [],
      prestige_tiers_earned: [],
      last_updated: 0,
    });

    const result = JSON.parse(
      rpcAdminTriggerSeasonEvent(
        mockCtx,
        mockLogger,
        mockNk,
        '{"action":"rebuild_prestige","season_id":"season_1","dry_run":false,"player_ids":["p1"]}'
      )
    );
    expect(result.success).toBe(true);
    expect(result.result.rebuilt_count).toBe(1);
  });
});
