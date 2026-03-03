import { testHelper, TestAccount } from './helpers';

describe('Matchmaker Integration Tests', () => {
  let playerA: TestAccount;
  let playerB: TestAccount;
  let playerC: TestAccount;
  let createdMatchIds: string[] = [];

  beforeAll(async () => {
    // Initialize test environment and clean any previous data
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    // Create test accounts with consistent stats
    playerA = await testHelper.createTestAccount('matcher_a');
    playerB = await testHelper.createTestAccount('matcher_b');
    playerC = await testHelper.createTestAccount('matcher_c');

    // Setup player stats for each
    await setupPlayerStats(playerA, {
      level: 10,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 }
    });
    await setupPlayerStats(playerB, {
      level: 10,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 }
    });
    await setupPlayerStats(playerC, {
      level: 10,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 }
    });
  }, 120000);

  afterEach(async () => {
    // Clean up matches created during this test
    for (const matchId of createdMatchIds) {
      try {
        // We cannot directly delete matches via client unless we have admin rights
        // Use admin to delete storage objects for these matches
        const admin = await testHelper.getAdminClient();
        await admin.storageDelete([{
          collection: 'pvp_matches',
          key: matchId,
          userId: '' // delete regardless of userId
        }]);
      } catch (e) {
        // ignore cleanup errors
      }
    }
    createdMatchIds = [];
  });

  afterAll(async () => {
    // Clean up all test data and disconnect
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to setup player stats
  async function setupPlayerStats(account: TestAccount, stats: any): Promise<void> {
    await testHelper.writeStorageObject(
      'player_stats',
      account.userId,
      account.userId,
      stats
    );
  }

  // Helper to call RPC and parse JSON
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(rpcId, JSON.stringify(payload));
    return JSON.parse(response);
  }

  // Helper to create a match and track its ID for cleanup
  async function createMatch(account: TestAccount, payload: any): Promise<any> {
    const result = await rpcCall(account, 'armored_archer/create_match', payload);
    if (result.success && result.match) {
      createdMatchIds.push(result.match.match_id);
    }
    return result;
  }

  describe('rpcCreateMatch', () => {
    test('should create a match with target opponent', async () => {
      const payload = {
        match_type: 'ranked',
        target_opponent_id: playerB.userId
      };
      const result = await createMatch(playerA, payload);

      expect(result.success).toBe(true);
      expect(result.match).toBeDefined();
      expect(result.match.creator_id).toBe(playerA.userId);
      expect(result.match.opponent_id).toBe(playerB.userId);
      expect(result.match.status).toBe('pending');
      expect(result.match.match_type).toBe('ranked');
      expect(result.match.is_punch_up).toBe(false);
    });

    test('should create match with punch-up when allowed', async () => {
      // Lower playerC's level to create rank gap
      await setupPlayerStats(playerC, {
        level: 5,
        xp: 500,
        stats: { attack: 15, defense: 10, dodge: 8, crit_rate: 6 }
      });

      const payload = {
        match_type: 'ranked',
        target_opponent_id: playerC.userId,
        is_punch_up: true
      };
      const result = await createMatch(playerA, payload);

      expect(result.success).toBe(true);
      expect(result.match.is_punch_up).toBe(true);
    });

    test('should return error when target player not found', async () => {
      const payload = {
        match_type: 'ranked',
        target_opponent_id: 'non-existent-user'
      };
      const result = await rpcCall(playerA, 'armored_archer/create_match', payload);

      expect(result.error).toBe("Target player not found");
    });

    test('should return error when rank difference too large without punch-up', async () => {
      // Set playerC to high level
      await setupPlayerStats(playerC, {
        level: 20,
        xp: 5000,
        stats: { attack: 40, defense: 35, dodge: 25, crit_rate: 20 }
      });

      const payload = {
        match_type: 'ranked',
        target_opponent_id: playerC.userId
      };
      const result = await rpcCall(playerA, 'armored_archer/create_match', payload);

      expect(result.error).toBe("Rank difference too large for direct challenge");
    });

    test('should create open match when no target specified', async () => {
      const payload = {
        match_type: 'casual'
      };
      const result = await createMatch(playerA, payload);

      expect(result.success).toBe(true);
      expect(result.match.opponent_id).toBe("");
      expect(result.match.status).toBe('pending');
      expect(result.match.match_type).toBe('casual');
    });

    test('should return error when player stats not found', async () => {
      const lonelyPlayer = await testHelper.createTestAccount('lonely');
      // No stats written

      const payload = {
        match_type: 'ranked'
      };
      const result = await rpcCall(lonelyPlayer, 'armored_archer/create_match', payload);

      expect(result.error).toBe("Player stats not found");
    });
  });

  describe('rpcAcceptMatch', () => {
    let matchId: string;

    beforeAll(async () => {
      // Create a match where playerA invites playerB
      const createPayload = {
        match_type: 'ranked',
        target_opponent_id: playerB.userId
      };
      const createResult = await createMatch(playerA, createPayload);
      matchId = createResult.match.match_id;
    });

    test('should accept pending match successfully', async () => {
      const payload = { match_id: matchId };
      const result = await rpcCall(playerB, 'armored_archer/accept_match', payload);

      expect(result.success).toBe(true);
      expect(result.match.status).toBe('active');
      expect(result.match.opponent_id).toBe(playerB.userId);
      // Verify opponent rank was calculated (should be >0)
      expect(result.match.opponent_rank).toBeGreaterThan(0);
    });

    test('should return error when match not found', async () => {
      const payload = { match_id: 'nonexistent' };
      const result = await rpcCall(playerB, 'armored_archer/accept_match', payload);

      expect(result.error).toBe("Match not found");
    });

    test('should return error when user is the creator', async () => {
      const payload = { match_id: matchId };
      const result = await rpcCall(playerA, 'armored_archer/accept_match', payload);

      expect(result.error).toBe("Cannot accept your own match");
    });

    test('should return error when match is not pending', async () => {
      // Accept the match first to make it active
      await rpcCall(playerB, 'armored_archer/accept_match', { match_id: matchId });

      // Now try to accept again with another user
      const payload = { match_id: matchId };
      const result = await rpcCall(playerC, 'armored_archer/accept_match', payload);

      expect(result.error).toBe("Match is no longer available");
    });

    test('should return error when player stats not found', async () => {
      const freshAccount = await testHelper.createTestAccount('fresh_acceptor');
      await setupPlayerStats(freshAccount, {
        level: 5,
        xp: 100,
        stats: { attack: 10, defense: 10, dodge: 5, crit_rate: 5 }
      });

      // Delete the stats we just wrote to simulate missing
      await testHelper.deleteStorageObject('player_stats', freshAccount.userId, freshAccount.userId);

      const createPayload = {
        match_type: 'ranked',
        target_opponent_id: freshAccount.userId
      };
      const createResult = await createMatch(playerA, createPayload);
      const acceptPayload = { match_id: createResult.match.match_id };
      const result = await rpcCall(freshAccount, 'armored_archer/accept_match', acceptPayload);

      expect(result.error).toBe("Player stats not found");
    });
  });

  describe('rpcListMatches', () => {
    beforeAll(async () => {
      // Create matches for listing
      // Match 1: pending ranked by a third user
      await createMatchForUser('list_other1', playerA.userId, { match_type: 'ranked' });
      // Match 2: pending casual by another third user
      await createMatchForUser('list_other2', playerA.userId, { match_type: 'casual' });
      // Match 3: playerA's own match (should be excluded from list)
      await createMatch(playerA, { match_type: 'ranked' });
    });

    test('should list pending matches excluding own', async () => {
      const payload = {};
      const result = await rpcCall(playerA, 'armored_archer/list_matches', payload);

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
      // Ensure none of the listed matches are created by playerA
      const ownMatches = result.matches.filter((m: any) => m.creator_id === playerA.userId);
      expect(ownMatches.length).toBe(0);
      expect(result.player_rank).toBeDefined();
      expect(result.total).toBeDefined();
    });

    test('should filter by match_type', async () => {
      const payload = { match_type: 'ranked' };
      const result = await rpcCall(playerA, 'armored_archer/list_matches', payload);

      expect(result.matches.every((m: any) => m.match_type === 'ranked')).toBe(true);
    });

    test('should filter by min_rank and max_rank', async () => {
      const payload = { min_rank: 0, max_rank: 1000 };
      const result = await rpcCall(playerA, 'armored_archer/list_matches', payload);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.matches)).toBe(true);
    });

    test('should apply limit correctly', async () => {
      const payload = { limit: 1 };
      const result = await rpcCall(playerA, 'armored_archer/list_matches', payload);
      expect(result.matches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('rpcGetPlayerRank', () => {
    test('should return player rank, level, and xp', async () => {
      const payload = {};
      const result = await rpcCall(playerA, 'armored_archer/get_player_rank', payload);

      expect(result.success).toBe(true);
      expect(result.rank).toBeDefined();
      expect(typeof result.rank).toBe('number');
      expect(result.level).toBe(10);
      expect(result.xp).toBe(2000);
    });

    test('should return error when player stats not found', async () => {
      const freshPlayer = await testHelper.createTestAccount('norank');
      // No stats set
      const payload = {};
      const result = await rpcCall(freshPlayer, 'armored_archer/get_player_rank', payload);

      expect(result.error).toBe("Player stats not found");
    });
  });
});

// Helper function to create a match as a specific user (used in beforeAll)
async function createMatchForUser(prefix: string, targetOpponentId: string, overrides: any = {}): Promise<any> {
  const helper = testHelper;
  const user = await helper.createTestAccount(prefix);
  await helper.writeStorageObject(
    'player_stats',
    user.userId,
    user.userId,
    { level: 10, xp: 2000, stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 } }
  );

  const payload = {
    match_type: 'ranked',
    target_opponent_id: targetOpponentId,
    ...overrides
  };
  // Note: we need to track created match for cleanup; but we can't easily from here.
  // Since this is used in beforeAll, the main afterEach cleanup only tracks matches from playerA,B,C.
  // We'll rely on cleanAllTestData afterAll to wipe all storage, so these matches are fine.
  const result = await user.client.rpc('armored_archer/create_match', JSON.stringify(payload));
  return JSON.parse(result);
}
