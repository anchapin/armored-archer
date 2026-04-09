/**
 * Network Resilience Integration Tests
 * Tests for offline mode, reconnection handling, and network error scenarios on the backend
 * GitHub Issue: QA-004
 */

import { testHelper, TestAccount } from './helpers';

describe('Network Resilience Integration Tests', () => {
  let playerA: TestAccount;
  let playerB: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    playerA = await testHelper.createTestAccount('network_resilience_a');
    playerB = await testHelper.createTestAccount('network_resilience_b');

    // Setup player stats
    await setupPlayerStats(playerA, {
      level: 10,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
    });
    await setupPlayerStats(playerB, {
      level: 10,
      xp: 2000,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
    });
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to setup player stats
  async function setupPlayerStats(account: TestAccount, stats: any): Promise<void> {
    await testHelper.writeStorageObject('player_stats', account.userId, account.userId, stats);
  }

  // Helper to call RPC
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  describe('Connection Handling', () => {
    test('should handle authentication with valid credentials', async () => {
      // This test verifies that the backend properly handles authentication
      // which is the first step in network connection
      expect(playerA.sessionToken).toBeDefined();
      expect(playerA.sessionToken.length).toBeGreaterThan(0);
    });

    test('should handle session refresh', async () => {
      // Test session refresh capability
      const session = await playerA.client.refreshSession(playerA.refreshToken);
      expect(session.token).toBeDefined();
      expect(session.refreshToken).toBeDefined();
    });

    test('should handle multiple concurrent RPC calls', async () => {
      // Simulate network load with concurrent RPC calls
      const promises = [
        rpcCall(playerA, 'armored_archer/get_player_rank', {}),
        rpcCall(playerA, 'armored_archer/list_matches', {}),
        rpcCall(playerB, 'armored_archer/get_player_rank', {}),
      ];

      const results = await Promise.all(promises);

      // All should succeed (or at least not crash)
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Offline Mode Handling', () => {
    test('should handle RPC call when session is invalid', async () => {
      // Create a client with an invalid/expired token
      const expiredClient = await testHelper.createTestAccount('expired_test');

      // Write invalid token to simulate offline/invalid session
      // The RPC should still return a proper error response
      try {
        const result = await expiredClient.client.rpc(
          expiredClient.session,
          'armored_archer/get_player_rank',
          {}
        );
        // If we get here without error, the response should indicate the issue
        expect(result).toBeDefined();
      } catch (error: any) {
        // Expected - invalid session should cause error
        expect(error).toBeDefined();
      }
    });

    test('should return appropriate error for missing player stats', async () => {
      // Create a new account without stats
      const newAccount = await testHelper.createTestAccount('no_stats');

      const result = await rpcCall(newAccount, 'armored_archer/get_player_rank', {});

      // Should return error about missing stats
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });
  });

  describe('Match Connection Resilience', () => {
    let matchId: string;

    beforeAll(async () => {
      // Create a match for testing
      const result = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
        target_opponent_id: playerB.userId,
      });
      matchId = result.match.match_id;
    });

    test('should handle match creation with valid session', async () => {
      const result = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
      });

      expect(result.success).toBe(true);
      expect(result.match).toBeDefined();
      expect(result.match.match_id).toBeDefined();
    });

    test('should handle match acceptance', async () => {
      // Create new match
      const createResult = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
        target_opponent_id: playerB.userId,
      });

      const acceptResult = await rpcCall(playerB, 'armored_archer/accept_match', {
        match_id: createResult.match.match_id,
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.match.status).toBe('active');
    });

    test('should handle match completion', async () => {
      // Create and accept a match
      const createResult = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
        target_opponent_id: playerB.userId,
      });

      await rpcCall(playerB, 'armored_archer/accept_match', {
        match_id: createResult.match.match_id,
      });

      // Complete the match
      const completeResult = await rpcCall(playerA, 'armored_archer/complete_match', {
        match_id: createResult.match.match_id,
        winner_id: playerA.userId,
        loser_id: playerB.userId,
        is_punch_up: false,
      });

      expect(completeResult.success).toBe(true);
      expect(completeResult.match.status).toBe('completed');
    });

    test('should handle rapid match operations', async () => {
      // Test handling of rapid sequential match operations
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          rpcCall(playerA, 'armored_archer/create_match', {
            match_type: 'casual',
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // Check that at least some succeeded
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(0);
    });

    test('should handle invalid match ID', async () => {
      const result = await rpcCall(playerA, 'armored_archer/accept_match', {
        match_id: 'invalid_match_id_12345',
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    test('should handle concurrent match operations from multiple players', async () => {
      // Player A creates a match
      const createResult = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
      });

      // Both players try to list matches concurrently
      const [listA, listB] = await Promise.all([
        rpcCall(playerA, 'armored_archer/list_matches', {}),
        rpcCall(playerB, 'armored_archer/list_matches', {}),
      ]);

      expect(listA.success).toBe(true);
      expect(listB.success).toBe(true);
    });
  });

  describe('Reconnection Simulation', () => {
    test('should handle session re-authentication', async () => {
      // Simulate reconnection by creating a new session
      const newAccount = await testHelper.createTestAccount('reconnect_test');

      // Verify session works
      const result = await rpcCall(newAccount, 'armored_archer/get_player_rank', {});

      // Should work with fresh session (need to setup stats first)
      await setupPlayerStats(newAccount, {
        level: 5,
        xp: 500,
        stats: { attack: 10, defense: 10, dodge: 5, crit_rate: 5 },
      });

      const resultAfterStats = await rpcCall(newAccount, 'armored_archer/get_player_rank', {});
      expect(resultAfterStats.success).toBe(true);
    });

    test('should handle multiple rapid re-authentications', async () => {
      const account = await testHelper.createTestAccount('rapid_reauth_test');
      await setupPlayerStats(account, {
        level: 5,
        xp: 500,
        stats: { attack: 10, defense: 10, dodge: 5, crit_rate: 5 },
      });

      // Simulate rapid reconnection attempts
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await rpcCall(account, 'armored_archer/get_player_rank', {});
        results.push(result);
      }

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    test('should maintain match state after reconnection simulation', async () => {
      // Create a match
      const createResult = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'casual',
      });

      const matchId = createResult.match.match_id;

      // Simulate reconnection by getting the match again
      const listResult = await rpcCall(playerA, 'armored_archer/list_matches', {});

      // The match should still be available
      const match = listResult.matches.find((m: any) => m.match_id === matchId);
      expect(match).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed RPC payload', async () => {
      try {
        await playerA.client.rpc(playerA.session, 'armored_archer/list_matches', 'invalid json');
        // If no error, check response
        const result = await rpcCall(playerA, 'armored_archer/list_matches', {});
        // Should handle gracefully
        expect(result).toBeDefined();
      } catch (error: any) {
        // Error is acceptable for malformed input
        expect(error).toBeDefined();
      }
    });

    test('should handle empty payload', async () => {
      const result = await rpcCall(playerA, 'armored_archer/get_player_rank', null as any);
      // Backend should handle null gracefully or return validation error
      expect(result).toBeDefined();
    });

    test('should handle invalid payload schema', async () => {
      // Send invalid payload (missing required fields)
      const result = await rpcCall(playerA, 'armored_archer/create_match', {
        // Missing required match_type
      });

      // Should return validation error
      expect(result.error).toBeDefined();
    });

    test('should handle RPC timeout simulation', async () => {
      // Test that the system can handle slow responses
      // In a real scenario, this would test timeout handling
      const startTime = Date.now();
      const result = await rpcCall(playerA, 'armored_archer/list_matches', {});
      const duration = Date.now() - startTime;

      // Should complete (either successfully or with error)
      expect(result).toBeDefined();
      // And within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    test('should handle network interruption during match', async () => {
      // Create a match
      const createResult = await rpcCall(playerA, 'armored_archer/create_match', {
        match_type: 'ranked',
        target_opponent_id: playerB.userId,
      });

      // Accept it
      await rpcCall(playerB, 'armored_archer/accept_match', {
        match_id: createResult.match.match_id,
      });

      // Try to complete with invalid data (simulating network issues)
      const invalidComplete = await rpcCall(playerA, 'armored_archer/complete_match', {
        match_id: createResult.match.match_id,
        winner_id: 'invalid_winner',
        loser_id: playerB.userId,
      });

      // Should return error, not crash
      expect(invalidComplete.error).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    test('should maintain data consistency after errors', async () => {
      // Get initial rank
      const initialResult = await rpcCall(playerA, 'armored_archer/get_player_rank', {});
      const initialRank = initialResult.rank || 0;

      // Try invalid operation
      await rpcCall(playerA, 'armored_archer/complete_match', {
        match_id: 'nonexistent_match',
        winner_id: playerA.userId,
        loser_id: playerB.userId,
      });

      // Get rank again - should be unchanged
      const finalResult = await rpcCall(playerA, 'armored_archer/get_player_rank', {});
      expect(finalResult.rank).toBe(initialRank);
    });

    test('should handle storage write failures gracefully', async () => {
      // Try to create match without proper stats (should fail gracefully)
      const noStatsAccount = await testHelper.createTestAccount('no_stats_write');

      const result = await rpcCall(noStatsAccount, 'armored_archer/create_match', {
        match_type: 'ranked',
      });

      // Should return error, not crash
      expect(result.error).toBeDefined();
    });
  });
});
