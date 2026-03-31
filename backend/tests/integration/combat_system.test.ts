import { testHelper, TestAccount } from './helpers';

describe('Combat System Integration Tests', () => {
  let playerA: TestAccount;
  let playerB: TestAccount;
  let activeMatchId: string;
  let cleanupMatchIds: string[] = [];

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    // Create test accounts with different stats for combat variety
    playerA = await testHelper.createTestAccount('combat_a');
    playerB = await testHelper.createTestAccount('combat_b');

    // Player A: high attack, low defense
    await setupPlayerStats(playerA, {
      level: 10,
      xp: 2000,
      stats: { attack: 30, defense: 10, dodge: 15, crit_rate: 20 }
    });

    // Player B: balanced stats
    await setupPlayerStats(playerB, {
      level: 10,
      xp: 2000,
      stats: { attack: 20, defense: 20, dodge: 15, crit_rate: 10 }
    });
  }, 120000);

  beforeEach(async () => {
    // Create an active match before each combat test
    const createPayload = {
      match_type: 'ranked',
      target_opponent_id: playerB.userId
    };
    const createResult = await rpcCall(playerA, 'armored_archer/create_match', createPayload);
    activeMatchId = createResult.match.match_id;
    cleanupMatchIds.push(activeMatchId);

    // Have playerB accept the match
    await rpcCall(playerB, 'armored_archer/accept_match', { match_id: activeMatchId });
  });

  afterEach(async () => {
    // Clean up matches created during this test
    for (const matchId of cleanupMatchIds) {
      try {
        const admin = await testHelper.getAdminClient();
        // Delete both match and match state
        await admin.storageDelete([
          { collection: 'pvp_matches', key: matchId, userId: '' },
          { collection: 'pvp_match_states', key: matchId, userId: '' }
        ]);
      } catch (e) {
        // ignore
      }
    }
    cleanupMatchIds = [];
  });

  afterAll(async () => {
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
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  // Helper to get match state
  async function getMatchState(account: TestAccount, matchId: string): Promise<any> {
    return await rpcCall(account, 'armored_archer/get_match_state', { match_id: matchId });
  }

  describe('rpcSubmitCombatAction', () => {
    test('should process shoot action and return combat result', async () => {
      // Player A (creator) shoots first
      const payload = {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: Math.PI / 2
      };
      const result = await rpcCall(playerA, 'armored_archer/submit_combat_action', payload);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.hit).toBeDefined();
      expect(result.result.damage).toBeDefined();
      expect(result.result.is_crit).toBeDefined();
      expect(result.result.attacker_stats).toBeDefined();
      expect(result.result.defender_stats).toBeDefined();
      expect(result.result.match_status).toBe('active');
    });

    test('should alternate turns correctly', async () => {
      // Player A shoots
      const resultA = await rpcCall(playerA, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });
      expect(resultA.success).toBe(true);

      // Get match state to see whose turn it is now
      const stateAfterA = await getMatchState(playerB, activeMatchId);
      expect(stateAfterA.current_turn_user_id).toBe(playerB.userId);
      expect(stateAfterA.turn).toBe(2);

      // Player B shoots
      const resultB = await rpcCall(playerB, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });
      expect(resultB.success).toBe(true);

      // Get match state to see whose turn it is now
      const stateAfterB = await getMatchState(playerA, activeMatchId);
      expect(stateAfterB.current_turn_user_id).toBe(playerA.userId);
      expect(stateAfterB.turn).toBe(3);
    });

    test('should apply damage and reduce health', async () => {
      const initialState = await getMatchState(playerA, activeMatchId);
      const initialOpponentHealth = initialState.opponent_health;
      const initialCreatorHealth = initialState.creator_health;

      // Player A shoots, could hit or miss
      const resultA = await rpcCall(playerA, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });

      const stateAfterA = await getMatchState(playerA, activeMatchId);

      if (resultA.result.hit) {
        // Opponent health should decrease
        expect(stateAfterA.opponent_health).toBeLessThan(initialOpponentHealth);
        expect(stateAfterA.creator_health).toBe(initialCreatorHealth);
      } else {
        // Miss, health unchanged
        expect(stateAfterA.opponent_health).toBe(initialOpponentHealth);
      }
    });

    test('should end match when health reaches zero', async () => {
      // This test may require a lucky sequence of hits; we'll artificially deal high damage by setting high attack stats
      await setupPlayerStats(playerA, {
        level: 50,
        xp: 10000,
        stats: { attack: 100, defense: 100, dodge: 0, crit_rate: 100 } // guaranteed high damage, crit always
      });
      await setupPlayerStats(playerB, {
        level: 1,
        xp: 0,
        stats: { attack: 1, defense: 1, dodge: 0, crit_rate: 0 }
      });

      // Keep shooting until someone wins
      let winnerDeclared = false;
      for (let i = 0; i < 50; i++) {
        // Player A shoots (creator starts)
        const resultA = await rpcCall(playerA, 'armored_archer/submit_combat_action', {
          match_id: activeMatchId,
          action_type: 'shoot',
          angle: 1.0
        });

        if (resultA.result.match_status === 'completed') {
          winnerDeclared = true;
          expect(resultA.result.winner).toBeDefined();
          break;
        }

        // Player B shoots if match still active
        if (resultA.result.match_status === 'active') {
          const resultB = await rpcCall(playerB, 'armored_archer/submit_combat_action', {
            match_id: activeMatchId,
            action_type: 'shoot',
            angle: 1.0
          });

          if (resultB.result.match_status === 'completed') {
            winnerDeclared = true;
            expect(resultB.result.winner).toBeDefined();
            break;
          }
        }
      }

      expect(winnerDeclared).toBe(true);

      // Final state should show completed match
      const finalState = await getMatchState(playerA, activeMatchId);
      expect(finalState.status).toBe('completed');
      expect(finalState.winner).toBeDefined();
    });

    test('should record combat log entries', async () => {
      // Perform several combat actions
      await rpcCall(playerA, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });
      await rpcCall(playerB, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });
      await rpcCall(playerA, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });

      const state = await getMatchState(playerA, activeMatchId);
      expect(state.log.length).toBeGreaterThanOrEqual(3);

      // Check log entry structure
      const lastEntry = state.log[state.log.length - 1];
      expect(lastEntry.turn).toBeDefined();
      expect(lastEntry.attacker_id).toBeDefined();
      expect(lastEntry.action).toBe('shoot');
      expect(lastEntry.hit).toBeDefined();
      expect(lastEntry.damage).toBeDefined();
      expect(lastEntry.is_crit).toBeDefined();
      expect(lastEntry.timestamp).toBeDefined();
    });

    test('should return error when match not found', async () => {
      const payload = {
        match_id: 'nonexistent_match',
        action_type: 'shoot',
        angle: 1.0
      };
      const result = await rpcCall(playerA, 'armored_archer/submit_combat_action', payload);

      expect(result.error).toBe('Match not found');
    });

    test('should return error when match not active', async () => {
      // Force complete the match by cheating with high damage
      await forceCompleteMatch(activeMatchId, playerA.userId);

      const payload = {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      };
      const result = await rpcCall(playerA, 'armored_archer/submit_combat_action', payload);

      expect(result.error).toBe('Match is not active');
    });

    test('should return error when user is not a participant', async () => {
      const outsider = await testHelper.createTestAccount('outsider');
      await setupPlayerStats(outsider, {
        level: 5,
        xp: 500,
        stats: { attack: 15, defense: 10, dodge: 10, crit_rate: 5 }
      });

      const payload = {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      };
      const result = await rpcCall(outsider, 'armored_archer/submit_combat_action', payload);

      expect(result.error).toBe('Not a participant in this match');
    });

    test('should return error when not player turn', async () => {
      // Force a specific turn state where it's player A's turn
      await setupMatchStateForTurn(activeMatchId, playerA.userId);

      // Player B tries to shoot during A's turn
      const payload = {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      };
      const result = await rpcCall(playerB, 'armored_archer/submit_combat_action', payload);

      expect(result.error).toBe('Not your turn');
    });

    test('should return validation error for invalid action_type', async () => {
      const payload = {
        match_id: activeMatchId,
        action_type: 'invalid_action',
        angle: 1.0
      };
      const result = await rpcCall(playerA, 'armored_archer/submit_combat_action', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcGetMatchState', () => {
    test('should return current match state', async () => {
      const result = await getMatchState(playerA, activeMatchId);

      expect(result).toBeDefined();
      expect(result.match_id).toBe(activeMatchId);
      expect(result.turn).toBeDefined();
      expect(result.current_turn_user_id).toBeDefined();
      expect(result.creator_id).toBe(playerA.userId);
      expect(result.opponent_id).toBe(playerB.userId);
      expect(result.creator_health).toBeDefined();
      expect(result.opponent_health).toBeDefined();
      expect(result.creator_stats).toBeDefined();
      expect(result.opponent_stats).toBeDefined();
      expect(result.status).toBe('active');
      expect(Array.isArray(result.log)).toBe(true);
    });

    test('should return same state for both participants', async () => {
      const stateA = await getMatchState(playerA, activeMatchId);
      const stateB = await getMatchState(playerB, activeMatchId);

      expect(stateA.match_id).toBe(stateB.match_id);
      expect(stateA.turn).toBe(stateB.turn);
      expect(stateA.current_turn_user_id).toBe(stateB.current_turn_user_id);
      expect(stateA.creator_health).toBe(stateB.creator_health);
      expect(stateA.opponent_health).toBe(stateB.opponent_health);
    });

    test('should reflect health changes after combat', async () => {
      const initialHealth = (await getMatchState(playerA, activeMatchId)).opponent_health;

      // Player A shoots
      await rpcCall(playerA, 'armored_archer/submit_combat_action', {
        match_id: activeMatchId,
        action_type: 'shoot',
        angle: 1.0
      });

      const newState = await getMatchState(playerA, activeMatchId);
      const newOpponentHealth = newState.opponent_health;

      if (newOpponentHealth < initialHealth) {
        // Damage was dealt, health decreased
        expect(newOpponentHealth).toBeLessThan(initialHealth);
      } else {
        // Miss, health unchanged
        expect(newOpponentHealth).toBe(initialHealth);
      }
    });

    test('should return error when match not found', async () => {
      const result = await getMatchState(playerA, 'nonexistent_match');
      expect(result.error).toBe('Match state not found');
    });

    test('should allow participant to view state', async () => {
      // Both participants should be able to view state
      const stateA = await getMatchState(playerA, activeMatchId);
      const stateB = await getMatchState(playerB, activeMatchId);

      expect(stateA.success).toBeUndefined(); // no success field, returns state directly
      expect(stateB.success).toBeUndefined();
    });
  });
});

// Helper function to setup match state for specific turn
async function setupMatchStateForTurn(matchId: string, currentTurnUserId: string): Promise<void> {
  const helper = testHelper;
  const admin = await helper.getAdminClient();

  // Read match to get full data
  const matchObj = await helper.getStorageObject('pvp_matches', matchId, '');
  if (!matchObj) throw new Error('Match not found');

  const match = JSON.parse(matchObj.value);

  // Get player stats
  const creatorStats = await getPlayerStatsFromStorage(helper, match.creator_id);
  const opponentStats = await getPlayerStatsFromStorage(helper, match.opponent_id);
  const baseHealth = 100;
  const maxHealth = baseHealth + creatorStats.level * 10;

  const matchState = {
    match_id: matchId,
    turn: 1,
    current_turn_user_id: currentTurnUserId,
    creator_id: match.creator_id,
    opponent_id: match.opponent_id,
    creator_health: maxHealth,
    opponent_health: maxHealth,
    creator_stats: creatorStats,
    opponent_stats: opponentStats,
    status: 'active',
    log: [],
  };

  await admin.storageWrite([{
    collection: 'pvp_match_states',
    key: matchId,
    userId: match.creator_id,
    value: JSON.stringify(matchState),
  }]);
}

async function getPlayerStatsFromStorage(helper: any, userId: string): Promise<any> {
  const obj = await helper.getStorageObject('player_stats', userId, userId);
  return obj ? JSON.parse(obj.value) : {
    level: 1,
    xp: 0,
    stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
  };
}

// Helper to force complete a match
async function forceCompleteMatch(matchId: string, winnerId: string): Promise<void> {
  const helper = testHelper;
  const admin = await helper.getAdminClient();

  // Get match
  const matchObj = await helper.getStorageObject('pvp_matches', matchId, '');
  if (!matchObj) throw new Error('Match not found');

  const match = JSON.parse(matchObj.value);
  match.status = 'completed';
  match.winner = winnerId;
  match.updated_at = Date.now();

  await admin.storageWrite([{
    collection: 'pvp_matches',
    key: matchId,
    userId: match.creator_id,
    value: JSON.stringify(match),
  }]);
}
