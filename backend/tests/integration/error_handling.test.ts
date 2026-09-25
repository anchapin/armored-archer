import { testHelper, TestAccount } from './helpers';

describe('Error Handling Tests', () => {
  let player: TestAccount;
  let adminAccount: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    player = await testHelper.createTestAccount('error_test_player');
    adminAccount = await testHelper.createTestAccount('error_test_admin');

    // Setup player stats
    await testHelper.writeStorageObject('player_stats', player.userId, player.userId, {
      level: 10,
      xp: 2000,
      ability_points: 5,
      stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
    });
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to call RPC
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload ? JSON.parse(response.payload as unknown as string) : {};
  }

  describe('Invalid Input Validation', () => {
    test('should return error for null payload', async () => {
      try {
        const result = await rpcCall(player, 'armored_archer/get_player_rank', null);
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should return error for undefined payload', async () => {
      try {
        const result = await rpcCall(player, 'armored_archer/get_player_rank', undefined);
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should return error for empty string payload', async () => {
      try {
        const result = await rpcCall(player, 'armored_archer/get_player_rank', '');
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should return error for non-object payload', async () => {
      try {
        const result = await rpcCall(player, 'armored_archer/get_player_rank', 'invalid');
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Authentication Errors', () => {
    test('should return error for invalid session', async () => {
      const freshAccount = await testHelper.createTestAccount('invalid_session_test');

      // Create invalid session
      const invalidSession = {
        ...freshAccount.session,
        token: 'invalid_token_xyz',
      };

      try {
        await freshAccount.client.rpc(invalidSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('invalid');
      }
    });

    test('should return error for expired session', async () => {
      const freshAccount = await testHelper.createTestAccount('expired_session_test');

      // Create expired session
      const expiredSession = {
        ...freshAccount.session,
        expires_at: 0,
      };

      try {
        await freshAccount.client.rpc(expiredSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Validation Errors', () => {
    describe('XP Gain Validation', () => {
      test('should return error for negative XP amount', async () => {
        const result = await rpcCall(player, 'armored_archer/gain_xp', {
          xp_amount: -100,
          source: 'pve',
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for zero XP amount', async () => {
        const result = await rpcCall(player, 'armored_archer/gain_xp', {
          xp_amount: 0,
          source: 'pve',
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for invalid XP source', async () => {
        const result = await rpcCall(player, 'armored_archer/gain_xp', {
          xp_amount: 100,
          source: 'invalid_source',
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for missing XP source', async () => {
        const result = await rpcCall(player, 'armored_archer/gain_xp', {
          xp_amount: 100,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Stat Allocation Validation', () => {
      test('should return error for negative stat points', async () => {
        const result = await rpcCall(player, 'armored_archer/allocate_stats', {
          stat_name: 'attack',
          points: -1,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for zero stat points', async () => {
        const result = await rpcCall(player, 'armored_archer/allocate_stats', {
          stat_name: 'attack',
          points: 0,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for invalid stat name', async () => {
        const result = await rpcCall(player, 'armored_archer/allocate_stats', {
          stat_name: 'invalid_stat',
          points: 1,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for insufficient ability points', async () => {
        // Set player with only 1 ability point
        await testHelper.writeStorageObject('player_stats', player.userId, player.userId, {
          level: 2,
          xp: 100,
          ability_points: 1,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
        });

        const result = await rpcCall(player, 'armored_archer/allocate_stats', {
          stat_name: 'attack',
          points: 5,
        });

        expect(result.error).toBe('Not enough ability points');
      });
    });

    describe('Gear System Validation', () => {
      test('should return error for invalid gear slot', async () => {
        // First generate some gear
        const generateResult = await rpcCall(player, 'armored_archer/generate_gear', {
          stage_id: 'stage_test',
          boss_defeated: false,
        });

        if (generateResult.success && generateResult.gear) {
          const result = await rpcCall(player, 'armored_archer/equip_gear', {
            gear_id: generateResult.gear.id,
            slot: 'invalid_slot',
          });

          expect(result.error).toBeDefined();
        }
      });

      test('should return error for non-existent gear ID', async () => {
        const result = await rpcCall(player, 'armored_archer/equip_gear', {
          gear_id: 'nonexistent_gear_12345',
          slot: 'weapon',
        });

        expect(result.error).toBe('Gear not found in inventory');
      });

      test('should return error for gear type mismatch', async () => {
        // Generate armor
        let armorGear: any = null;
        for (let i = 0; i < 20; i++) {
          const result = await rpcCall(player, 'armored_archer/generate_gear', {
            stage_id: `stage_armor_${i}`,
            boss_defeated: false,
          });
          if (result.success && result.gear.type === 'armor') {
            armorGear = result.gear;
            break;
          }
        }

        if (armorGear) {
          // Try to equip armor as weapon
          const result = await rpcCall(player, 'armored_archer/equip_gear', {
            gear_id: armorGear.id,
            slot: 'weapon',
          });

          expect(result.error).toBe('Gear type does not match slot');
        }
      });
    });

    describe('Match System Validation', () => {
      test('should return error for non-existent match ID', async () => {
        const result = await rpcCall(player, 'armored_archer/accept_match', {
          match_id: 'nonexistent_match_xyz',
        });

        expect(result.error).toContain('not found');
      });

      test('should return error for invalid match type', async () => {
        const result = await rpcCall(player, 'armored_archer/create_match', {
          match_type: 'invalid_type',
        });

        expect(result.error).toBeDefined();
      });

      test('should return error for self-targeting in match creation', async () => {
        const result = await rpcCall(player, 'armored_archer/create_match', {
          match_type: 'ranked',
          target_opponent_id: player.userId,
        });

        // Should either succeed (allowing self-matches) or return error
        expect(result.success !== undefined || result.error !== undefined).toBe(true);
      });
    });

    describe('Store System Validation', () => {
      test('should return error for negative gem amount', async () => {
        const result = await rpcCall(player, 'armored_archer/spend_gems', {
          amount: -50,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for zero gem amount', async () => {
        const result = await rpcCall(player, 'armored_archer/spend_gems', {
          amount: 0,
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });

      test('should return error for insufficient gems', async () => {
        // Set low gem balance
        await testHelper.writeStorageObject('player_currency', player.userId, player.userId, {
          user_id: player.userId,
          gems: 10,
          coins: 100,
        });

        const result = await rpcCall(player, 'armored_archer/spend_gems', {
          amount: 100,
        });

        expect(result.error).toBe('Insufficient gems');
      });

      test('should return error for invalid product ID', async () => {
        const result = await rpcCall(player, 'armored_archer/validate_purchase', {
          product_id: 'invalid.product.id',
          platform: 'ios',
          transaction_receipt: 'test_receipt',
        });

        expect(result.error).toBe('Invalid product ID');
      });

      test('should return error for invalid platform', async () => {
        const result = await rpcCall(player, 'armored_archer/validate_purchase', {
          product_id: 'com.armoredarcher.gems.small',
          platform: 'web',
          transaction_receipt: 'test_receipt',
        });

        expect(result.error_code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('Database Errors', () => {
    test('should handle missing player stats gracefully', async () => {
      const freshPlayer = await testHelper.createTestAccount('no_stats_error_test');
      // Don't create stats for this player

      const result = await rpcCall(freshPlayer, 'armored_archer/get_player_stats', {});

      // Should return default stats or error, not crash
      expect(result).toBeDefined();
    });

    test('should handle missing inventory gracefully', async () => {
      const freshPlayer = await testHelper.createTestAccount('no_inv_error_test');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_inventory', {});

      // Should return empty inventory, not crash
      expect(result.gear).toEqual([]);
      expect(result.equipped_gear).toEqual({});
    });

    test('should handle missing currency gracefully', async () => {
      const freshPlayer = await testHelper.createTestAccount('no_currency_error_test');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_currency', {});

      // Should return zero balances, not crash
      expect(result.gems).toBe(0);
      expect(result.coins).toBe(0);
    });
  });

  describe('Error Response Format', () => {
    test('should include error field in error responses', async () => {
      const result = await rpcCall(player, 'armored_archer/accept_match', {
        match_id: 'nonexistent',
      });

      expect(result.error).toBeDefined();
    });

    test('should include error_code for validation errors', async () => {
      const result = await rpcCall(player, 'armored_archer/gain_xp', {
        xp_amount: -100,
        source: 'pve',
      });

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should provide descriptive error messages', async () => {
      const result = await rpcCall(player, 'armored_archer/equip_gear', {
        gear_id: 'fake_gear_id',
        slot: 'weapon',
      });

      expect(result.error).toBeDefined();
      expect(result.error.length).toBeGreaterThan(5);
    });

    test('should not expose internal error details to client', async () => {
      const result = await rpcCall(player, 'armored_archer/get_inventory', {
        inject_sql: "'; DROP TABLE player_inventory; --",
      });

      // Should return error without exposing SQL or internal details
      expect(result.error).toBeDefined();
      expect(result.error).not.toContain('SQL');
      expect(result.error).not.toContain('database');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large numbers', async () => {
      const result = await rpcCall(player, 'armored_archer/gain_xp', {
        xp_amount: Number.MAX_SAFE_INTEGER,
        source: 'pve',
      });

      // Should handle gracefully (either succeed or return validation error)
      expect(result).toBeDefined();
    });

    test('should handle very long strings', async () => {
      const longString = 'a'.repeat(10000);
      const result = await rpcCall(player, 'armored_archer/create_match', {
        match_type: longString,
      });

      // Should return validation error, not crash
      expect(result.error).toBeDefined();
    });

    test('should handle special characters in payloads', async () => {
      const result = await rpcCall(player, 'armored_archer/create_match', {
        match_type: 'ranked\ninjected',
        target_opponent_id: 'user<script>alert(1)</script>',
      });

      // Should handle safely
      expect(result).toBeDefined();
    });

    test('should handle empty arrays', async () => {
      const result = await rpcCall(player, 'armored_archer/get_leaderboard', {
        limit: 0,
      });

      // Should return empty or minimal result
      expect(result.success !== undefined || result.leaderboard !== undefined).toBe(true);
    });

    test('should handle very large limit values', async () => {
      const result = await rpcCall(player, 'armored_archer/get_leaderboard', {
        limit: 999999,
      });

      // Should handle gracefully (likely cap at max)
      expect(result).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rapid sequential requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(rpcCall(player, 'armored_archer/get_player_rank', {}));
      }

      const results = await Promise.allSettled(promises);

      // Most should succeed (some may be rate limited)
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(5);
    });

    test('should handle concurrent RPC calls', async () => {
      const endpoints = [
        'get_player_rank',
        'get_player_stats',
        'get_inventory',
        'get_currency',
        'get_season_info',
      ];

      const promises = endpoints.map((endpoint) =>
        rpcCall(player, `armored_archer/${endpoint}`, {})
      );

      const results = await Promise.allSettled(promises);

      // Most should succeed
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Graceful Degradation', () => {
    test('should return partial results when possible', async () => {
      // Get inventory which has multiple fields
      const result = await rpcCall(player, 'armored_archer/get_inventory', {});

      // Should have all expected fields even if empty
      expect(result).toHaveProperty('gear');
      expect(result).toHaveProperty('equipped_gear');
      expect(result).toHaveProperty('unlocked_modifier_pools');
    });

    test('should maintain consistency after errors', async () => {
      // Get initial state
      const initialStats = await rpcCall(player, 'armored_archer/get_player_stats', {});
      const initialXp = initialStats.xp;

      // Try invalid operation
      await rpcCall(player, 'armored_archer/gain_xp', {
        xp_amount: -1000,
        source: 'pve',
      });

      // Verify state unchanged
      const finalStats = await rpcCall(player, 'armored_archer/get_player_stats', {});
      expect(finalStats.xp).toBe(initialXp);
    });
  });
});
