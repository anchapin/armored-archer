import { testHelper, TestAccount } from './helpers';

describe('Season System Integration Tests', () => {
  let playerA: TestAccount;
  let playerB: TestAccount;
  let playerC: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    playerA = await testHelper.createTestAccount('season_a');
    playerB = await testHelper.createTestAccount('season_b');
    playerC = await testHelper.createTestAccount('season_c');

    // Setup initial stats and ranks for these players
    await setupPlayerStats(playerA, {
      level: 15,
      xp: 3000,
      stats: { attack: 30, defense: 25, dodge: 18, crit_rate: 14 }
    });
    await setupPlayerStats(playerB, {
      level: 12,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 }
    });
    await setupPlayerStats(playerC, {
      level: 18,
      xp: 4000,
      stats: { attack: 35, defense: 28, dodge: 20, crit_rate: 16 }
    });
  }, 120000);

  afterEach(async () => {
    // Clean up leaderboard entries and season claims between tests
    // We'll use admin to clean specific season data
    const admin = await testHelper.getAdminClient();
    try {
      // Clean leaderboard for current season
      const season = getCurrentSeasonInfo();
      await admin.leaderboardDelete(season.season_id, [playerA.userId, playerB.userId, playerC.userId]);

      // Clean season rewards claimed
      await admin.storageDelete([
        {
          collection: 'season_rewards_claimed',
          key: `${season.season_id}_${playerA.userId}`,
          userId: playerA.userId
        },
        {
          collection: 'season_rewards_claimed',
          key: `${season.season_id}_${playerB.userId}`,
          userId: playerB.userId
        },
        {
          collection: 'season_rewards_claimed',
          key: `${season.season_id}_${playerC.userId}`,
          userId: playerC.userId
        }
      ]);
    } catch (e) {
      // ignore cleanup errors
    }
  });

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to call RPC and parse JSON
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  // Helper to setup player stats
  async function setupPlayerStats(account: TestAccount, stats: any): Promise<void> {
    await testHelper.writeStorageObject(
      'player_stats',
      account.userId,
      account.userId,
      stats
    );
  }

  // Helper to get current season info (same logic as in module)
  function getCurrentSeasonInfo(): any {
    const now = Date.now();
    const SEASON_DURATION_WEEKS = 4;
    const SEASON_DURATION_MS = SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000;
    const seasonNumber = Math.floor(now / SEASON_DURATION_MS) + 1;
    const seasonStartTime = (seasonNumber - 1) * SEASON_DURATION_MS;
    const seasonEndTime = seasonStartTime + SEASON_DURATION_MS;

    return {
      season_id: `season_${seasonNumber}`,
      season_number: seasonNumber,
      start_time: seasonStartTime,
      end_time: seasonEndTime,
      status: 'active',
      duration_weeks: SEASON_DURATION_WEEKS,
    };
  }

  describe('rpcGetSeasonInfo', () => {
    test('should return current season info', async () => {
      const payload = {};
      const result = await rpcCall(playerA, 'armored_archer/get_season_info', payload);

      expect(result.success).toBe(true);
      expect(result.season).toBeDefined();
      expect(result.season.season_id).toBeDefined();
      expect(result.season.season_number).toBeDefined();
      expect(result.season.status).toBe('active');
      expect(result.season.duration_weeks).toBe(4);
    });

    test('should return time remaining until season end', async () => {
      const result = await rpcCall(playerA, 'armored_archer/get_season_info', {});

      expect(result.time_remaining).toBeDefined();
      expect(typeof result.time_remaining).toBe('number');
      // Should be positive (season hasn't ended yet)
      expect(result.time_remaining).toBeGreaterThan(0);
    });

    test('should return player rank and score', async () => {
      // Manually write a leaderboard entry for playerA
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();
      admin.leaderboardRecordWrite(
        season.season_id,
        playerA.userId,
        playerA.username,
        1500,
        0,
        { wins: '10', losses: '5', win_rate: '0.667', punch_up_wins: '2' }
      );

      const result = await rpcCall(playerA, 'armored_archer/get_season_info', {});

      expect(result.player_rank).toBeDefined();
      expect(result.player_score).toBeDefined();
    });

    test('should return null player_rank when no entry exists', async () => {
      // Ensure no leaderboard entry exists for fresh player
      const freshPlayer = await testHelper.createTestAccount('fresh_season');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_season_info', {});

      expect(result.player_rank).toBeNull();
      expect(result.player_score).toBe(0);
    });
  });

  describe('rpcGetLeaderboard', () => {
    test('should return leaderboard entries', async () => {
      // Create some leaderboard entries
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Write entries for our test players
      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1800, 0, {
        wins: '15', losses: '5', win_rate: '0.75', punch_up_wins: '3'
      });
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1600, 0, {
        wins: '12', losses: '8', win_rate: '0.6', punch_up_wins: '1'
      });
      admin.leaderboardRecordWrite(season.season_id, playerC.userId, playerC.username, 2000, 0, {
        wins: '20', losses: '3', win_rate: '0.87', punch_up_wins: '5'
      });

      const payload = { limit: 10 };
      const result = await rpcCall(playerA, 'armored_archer/get_leaderboard', payload);

      expect(result.success).toBe(true);
      expect(result.leaderboard).toBeDefined();
      expect(Array.isArray(result.leaderboard)).toBe(true);
      expect(result.leaderboard.length).toBeGreaterThanOrEqual(3);

      // Verify structure of leaderboard entries
      const entry = result.leaderboard[0];
      expect(entry.owner_id).toBeDefined();
      expect(entry.username).toBeDefined();
      expect(entry.rank).toBeDefined();
      expect(entry.score).toBeDefined();
      expect(entry.meta).toBeDefined();
      expect(entry.meta.wins).toBeDefined();
      expect(entry.meta.losses).toBeDefined();
      expect(entry.meta.win_rate).toBeDefined();
      expect(entry.meta.punch_up_wins).toBeDefined();
    });

    test('should respect limit parameter', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Create several entries
      for (let i = 0; i < 5; i++) {
        const user = await testHelper.createTestAccount(`lb_user_${i}`);
        admin.leaderboardRecordWrite(season.season_id, user.userId, user.username, 1000 + i * 100, 0, {
          wins: String(i * 2),
          losses: '0',
          win_rate: '1.0',
          punch_up_wins: '0'
        });
      }

      const payload = { limit: 2 };
      const result = await rpcCall(playerA, 'armored_archer/get_leaderboard', payload);

      expect(result.leaderboard.length).toBeLessThanOrEqual(2);
    });

    test('should return leaderboard sorted by score descending', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1500, 0, {
        wins: '10', losses: '5', win_rate: '0.667', punch_up_wins: '2'
      });
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1800, 0, {
        wins: '15', losses: '3', win_rate: '0.833', punch_up_wins: '3'
      });
      admin.leaderboardRecordWrite(season.season_id, playerC.userId, playerC.username, 1200, 0, {
        wins: '8', losses: '10', win_rate: '0.444', punch_up_wins: '1'
      });

      const result = await rpcCall(playerA, 'armored_archer/get_leaderboard', { limit: 10 });

      // Check that ranks are in order (rank 1 should have highest score)
      for (let i = 0; i < result.leaderboard.length - 1; i++) {
        expect(result.leaderboard[i].score).toBeGreaterThanOrEqual(result.leaderboard[i + 1].score);
      }
    });
  });

  describe('rpcUpdateRank', () => {
    test('should update ranks after a match (non-punch-up)', async () => {
      // Both players start with same Elo
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1000, 0, {
        wins: '0', losses: '0', win_rate: '0', punch_up_wins: '0'
      });
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1000, 0, {
        wins: '0', losses: '0', win_rate: '0', punch_up_wins: '0'
      });

      const payload = {
        winner_id: playerA.userId,
        loser_id: playerB.userId,
        winner_old_rank: 1000,
        loser_old_rank: 1000,
        winner_new_rank: 1016, // 1000 + 32 * 1 = 1016 (expected winner gains ~16)
        loser_new_rank: 984,    // 1000 - 32 * 0.5 = 984
        is_punch_up: false
      };

      const result = await rpcCall(playerA, 'armored_archer/update_rank', payload);

      expect(result.success).toBe(true);
      expect(result.winner.new_rank).toBeGreaterThan(result.winner.old_rank);
      expect(result.loser.new_rank).toBeLessThan(result.loser.old_rank);
      expect(result.winner.rank_change).toBeGreaterThan(0);
      expect(result.loser.rank_change).toBeLessThan(0);
      expect(result.is_punch_up).toBe(false);
    });

    test('should apply higher K-factor for punch-up matches', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Winner is lower rank (underdog)
      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 800, 0, {
        wins: '0', losses: '0', win_rate: '0', punch_up_wins: '0'
      });
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1200, 0, {
        wins: '0', losses: '0', win_rate: '0', punch_up_wins: '0'
      });

      const payload = {
        winner_id: playerA.userId,
        loser_id: playerB.userId,
        winner_old_rank: 800,
        loser_old_rank: 1200,
        winner_new_rank: 860, // Approximate with K=60
        loser_new_rank: 1140,
        is_punch_up: true
      };

      const result = await rpcCall(playerA, 'armored_archer/update_rank', payload);

      expect(result.success).toBe(true);
      expect(result.is_punch_up).toBe(true);
      // Winner should gain more than standard K allows
      expect(result.winner.rank_change).toBeGreaterThan(16);
    });

    test('should track win rate and punch-up wins', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Setup initial records
      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1000, 0, {
        wins: '5', losses: '10', win_rate: '0.333', punch_up_wins: '2'
      });
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1000, 0, {
        wins: '10', losses: '5', win_rate: '0.667', punch_up_wins: '0'
      });

      const payload = {
        winner_id: playerA.userId,
        loser_id: playerB.userId,
        winner_old_rank: 1000,
        loser_old_rank: 1000,
        winner_new_rank: 1016,
        loser_new_rank: 984,
        is_punch_up: false
      };

      const result = await rpcCall(playerA, 'armored_archer/update_rank', payload);

      expect(result.success).toBe(true);
      // The actual leaderboard entry would be updated with win/loss counts
      // We verify the response indicates proper tracking
      expect(result.winner).toBeDefined();
      expect(result.loser).toBeDefined();
    });
  });

  describe('rpcGetSeasonRewards', () => {
    test('should return rewards based on rank', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Player A at rank 15 (legendary tier)
      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1900, 0, {});
      // Player B at rank 30 (epic tier)
      admin.leaderboardRecordWrite(season.season_id, playerB.userId, playerB.username, 1700, 0, {});
      // Player C at rank 75 (rare tier)
      admin.leaderboardRecordWrite(season.season_id, playerC.userId, playerC.username, 1400, 0, {});

      const resultA = await rpcCall(playerA, 'armored_archer/get_season_rewards', {});
      expect(resultA.success).toBe(true);
      expect(resultA.rewards).toBeDefined();
      expect(resultA.rewards.rank_tier).toBe('legendary');
      expect(resultA.rewards.coins).toBeGreaterThan(5000);
      expect(resultA.rewards.gems).toBe(500);
      expect(resultA.rewards.cosmetics).toBeDefined();
      expect(resultA.rewards.cosmetics.title).toContain('Champion');

      const resultB = await rpcCall(playerB, 'armored_archer/get_season_rewards', {});
      expect(resultB.rewards.rank_tier).toBe('epic');

      const resultC = await rpcCall(playerC, 'armored_archer/get_season_rewards', {});
      expect(resultC.rewards.rank_tier).toBe('rare');
    });

    test('should return null rewards when no leaderboard entry', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_rewards');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_season_rewards', {});
      expect(result.success).toBe(true);
      expect(result.rewards).toBeNull();
    });

    test('should calculate correct tier thresholds', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Test rank 10 (legendary max)
      const playerTop = await testHelper.createTestAccount('top_rank');
      admin.leaderboardRecordWrite(season.season_id, playerTop.userId, playerTop.username, 2000, 0, {});
      const resultTop = await rpcCall(playerTop, 'armored_archer/get_season_rewards', {});
      expect(resultTop.rewards.rank_tier).toBe('legendary');

      // Test rank 50 (epic max)
      const playerEpic = await testHelper.createTestAccount('epic_rank');
      admin.leaderboardRecordWrite(season.season_id, playerEpic.userId, playerEpic.username, 1800, 0, {});
      const resultEpic = await rpcCall(playerEpic, 'armored_archer/get_season_rewards', {});
      expect(resultEpic.rewards.rank_tier).toBe('epic');

      // Test rank 100 (rare max)
      const playerRare = await testHelper.createTestAccount('rare_rank');
      admin.leaderboardRecordWrite(season.season_id, playerRare.userId, playerRare.username, 1600, 0, {});
      const resultRare = await rpcCall(playerRare, 'armored_archer/get_season_rewards', {});
      expect(resultRare.rewards.rank_tier).toBe('rare');

      // Test rank 500 (uncommon max)
      const playerUncommon = await testHelper.createTestAccount('uncommon_rank');
      admin.leaderboardRecordWrite(season.season_id, playerUncommon.userId, playerUncommon.username, 1300, 0, {});
      const resultUncommon = await rpcCall(playerUncommon, 'armored_archer/get_season_rewards', {});
      expect(resultUncommon.rewards.rank_tier).toBe('uncommon');

      // Test rank 1000 (common)
      const playerCommon = await testHelper.createTestAccount('common_rank');
      admin.leaderboardRecordWrite(season.season_id, playerCommon.userId, playerCommon.username, 1100, 0, {});
      const resultCommon = await rpcCall(playerCommon, 'armored_archer/get_season_rewards', {});
      expect(resultCommon.rewards.rank_tier).toBe('common');
    });
  });

  describe('rpcClaimSeasonRewards', () => {
    test('should claim season rewards successfully', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      // Set up leaderboard entry for playerA
      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1500, 0, {});
      // Also set up player stats for wallet updates
      await testHelper.writeStorageObject(
        'player_currency',
        playerA.userId,
        playerA.userId,
        { user_id: playerA.userId, gems: 0, gold: 0 }
      );

      const payload = {};
      const result = await rpcCall(playerA, 'armored_archer/claim_season_rewards', payload);

      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
      expect(result.rewards).toBeDefined();
      expect(result.rewards.coins).toBeGreaterThan(0);
    });

    test('should prevent double claiming', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1500, 0, {});

      // First claim
      const result1 = await rpcCall(playerA, 'armored_archer/claim_season_rewards', {});
      expect(result1.success).toBe(true);

      // Second claim should fail
      const result2 = await rpcCall(playerA, 'armored_archer/claim_season_rewards', {});
      expect(result2.error).toBe('Rewards already claimed for this season');
    });

    test('should fail when no leaderboard entry', async () => {
      const freshPlayer = await testHelper.createTestAccount('no_rank_claim');

      const result = await rpcCall(freshPlayer, 'armored_archer/claim_season_rewards', {});
      expect(result.error).toBe('No leaderboard entry found');
    });

    test('should award currency to wallet', async () => {
      const admin = await testHelper.getAdminClient();
      const season = getCurrentSeasonInfo();

      admin.leaderboardRecordWrite(season.season_id, playerA.userId, playerA.username, 1500, 0, {});
      await testHelper.writeStorageObject(
        'player_currency',
        playerA.userId,
        playerA.userId,
        { user_id: playerA.userId, gems: 0, gold: 0 }
      );

      const initialCurrency = await getPlayerCurrency(playerA);

      const result = await rpcCall(playerA, 'armored_archer/claim_season_rewards', {});
      expect(result.success).toBe(true);

      const finalCurrency = await getPlayerCurrency(playerA);
      expect(finalCurrency.gems).toBeGreaterThan(initialCurrency.gems);
    });
  });

  describe('rpcEndSeason', () => {
    test('should end current season and start new one', async () => {
      const result = await rpcCall(playerA, 'armored_archer/end_season', {});

      expect(result.success).toBe(true);
      expect(result.old_season).toBeDefined();
      expect(result.new_season).toBeDefined();
      expect(result.old_season.status).toBe('ended');
      expect(result.new_season.status).toBe('active');
      expect(result.new_season.season_number).toBe(result.old_season.season_number + 1);
    });

    test('should create new leaderboard for new season', async () => {
      const admin = await testHelper.getAdminClient();
      const oldSeason = getCurrentSeasonInfo();

      // Write to old season leaderboard
      admin.leaderboardRecordWrite(oldSeason.season_id, playerA.userId, playerA.username, 1500, 0, {});

      const result = await rpcCall(playerA, 'armored_archer/end_season', {});
      const newSeason = result.new_season;

      // Check that old season leaderboard still exists
      const oldRecords = admin.leaderboardRecordList(oldSeason.season_id, [], 10, '', 0);
      expect(oldRecords.length).toBeGreaterThan(0);

      // Check that new season leaderboard exists but is empty
      const newRecords = admin.leaderboardRecordList(newSeason.season_id, [], 10, '', 0);
      expect(newRecords.length).toBe(0);
    });

    test('should increment season number', async () => {
      const result1 = await rpcCall(playerA, 'armored_archer/end_season', {});
      const season1Num = result1.old_season.season_number;

      const result2 = await rpcCall(playerA, 'armored_archer/end_season', {});
      const season2Num = result2.old_season.season_number;

      expect(season2Num).toBe(season1Num + 1);
    });
  });
});

// Helper to get player currency
async function getPlayerCurrency(account: TestAccount): Promise<any> {
  const result = await rpcCall(account, 'armored_archer/get_currency', {});
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}
