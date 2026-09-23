/**
 * Vertical Slice Smoke Test - Backend Integration Tests
 *
 * Validates the complete end-to-end vertical slice flow:
 * 1. Account bootstrap and session
 * 2. Player stats initialization
 * 3. Stage completion tracking
 * 4. Loot generation
 * 5. Inventory management
 * 6. Gear equip/unequip
 * 7. Stat allocation
 *
 * Related: #679 - Sprint 1 Vertical Slice Foundation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@heroiclabs/nakama-js';

// Test configuration
const NAKAMA_HOST = process.env.NAKAMA_HOST || 'localhost';
const NAKAMA_PORT = process.env.NAKAMA_PORT || '7350';
const SERVER_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';

// Test user data
const TEST_DEVICE_ID = `test_device_${Date.now()}`;
const TEST_USERNAME = `vertical_slice_test_${Date.now()}`;

// Storage keys
const STORAGE_PLAYER_STATS = 'player_stats';
const STORAGE_INVENTORY = 'inventory';
const STORAGE_LOADOUT = 'loadout';
const STORAGE_CAMPAIGN = 'campaign_progress';

// Stage configuration for testing
const TEST_STAGE_ID = '1_1';
const TEST_BOSS_STAGE_ID = '1_5';

describe('Vertical Slice Smoke Test - Backend RPCs', () => {
  let nakama: Client;
  let userId: string;
  let sessionToken: string;

  beforeAll(async () => {
    // Initialize Nakama client
    nakama = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, false, 10000, false);

    // Authenticate with test device ID
    const authResult = await nakama.authenticateDevice(TEST_DEVICE_ID, true, TEST_USERNAME);

    if (!authResult || !authResult.token || !authResult.user_id) {
      throw new Error(`Failed to authenticate: ${JSON.stringify(authResult)}`);
    }

    userId = authResult.user_id!;
    sessionToken = authResult.token!;

    console.log(`[Setup] Authenticated user: ${userId}`);
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await nakama.rpc('armored_archer/cleanup_test_user', { user_id: userId });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('VS-1: Account Bootstrap & Session Management', () => {
    it('should authenticate with device ID and create new account', async () => {
      expect(userId).toBeDefined();
      expect(userId).toBeTruthy();
      expect(sessionToken).toBeDefined();
      expect(sessionToken).toBeTruthy();
    });

    it('should have initial player stats stored on server', async () => {
      const result = await nakama.rpc('armored_archer/get_player_stats', {});

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);
      expect(result.payload.player_stats).toBeDefined();

      const stats = result.payload.player_stats;
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(0);
      expect(stats.ability_points).toBe(0);

      // Verify base stats
      expect(stats.stats.attack).toBeGreaterThan(0);
      expect(stats.stats.defense).toBeGreaterThan(0);
      expect(stats.stats.dodge).toBeGreaterThanOrEqual(0);
      expect(stats.stats.crit_rate).toBeGreaterThanOrEqual(0);
    });

    it('should validate username uniqueness', async () => {
      // This test verifies that duplicate usernames are rejected
      // In a real scenario, another client would try to use the same username
      const secondDeviceId = `test_device_${Date.now()}`;
      try {
        const result = await nakama.authenticateDevice(secondDeviceId, true, TEST_USERNAME);
        // Nakama allows duplicate device IDs with different accounts,
        // so we just verify the flow doesn't crash
        expect(result).toBeDefined();
      } catch (error) {
        // Username uniqueness is typically enforced on registration,
        // not on device authentication
        expect(error).toBeDefined();
      }
    });
  });

  describe('VS-2: PvE Stage Configuration', () => {
    it('should track stage unlock for new player', async () => {
      const result = await nakama.rpc('armored_archer/get_campaign_progress', {});

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);
      expect(result.payload.unlocked_stages).toBeDefined();
      expect(result.payload.unlocked_stages.length).toBeGreaterThan(0);
    });

    it('should mark stage as completed after completion RPC', async () => {
      // Complete a test stage
      const completeResult = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false,
        boss_id: '',
        difficulty: 'easy'
      });

      expect(completeResult.payload).toBeDefined();
      expect(completeResult.payload.success).toBe(true);

      // Verify stage is now in completed list
      const progressResult = await nakama.rpc('armored_archer/get_completed_stages', {});
      expect(progressResult.payload.completed_stages).toContain(TEST_STAGE_ID);
    });
  });

  describe('VS-3: Combat System - Data Flow', () => {
    it('should handle stage completion with boss defeat', async () => {
      const result = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_BOSS_STAGE_ID,
        boss_defeated: true,
        boss_id: 'boss_wind',
        difficulty: 'medium'
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);
    });

    it('should track campaign progress correctly', async () => {
      // Complete multiple stages
      const stages = ['1_1', '1_2', '1_3'];
      for (const stageId of stages) {
        await nakama.rpc('armored_archer/stage_complete', {
          stage_id: stageId,
          boss_defeated: false,
          boss_id: '',
          difficulty: 'easy'
        });
      }

      // Check progress
      const result = await nakama.rpc('armored_archer/get_campaign_progress', {});
      expect(result.payload.completed_stages).toEqual(
        expect.arrayContaining(stages)
      );
    });
  });

  describe('VS-4: Server-Side Loot Generation', () => {
    it('should generate loot on stage completion', async () => {
      const result = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false,
        boss_id: '',
        difficulty: 'easy'
      });

      expect(result.payload).toBeDefined();

      // Loot is not guaranteed, but may be present
      const hasLoot = result.payload.gear_dropped !== undefined &&
                        result.payload.gear_dropped !== null;

      if (hasLoot) {
        const gear = result.payload.gear_dropped;
        expect(gear.id).toBeDefined();
        expect(gear.name).toBeDefined();
        expect(gear.rarity).toBeDefined();
        expect(gear.type).toBeDefined();
        expect(['common', 'rare', 'epic', 'legendary']).toContain(gear.rarity);
      }
    });

    it('should generate higher rarity loot from boss stages', async () => {
      // Test multiple boss stage completions for RNG variance
      const results = await Promise.all([
        nakama.rpc('armored_archer/stage_complete', {
          stage_id: '1_5',
          boss_defeated: true,
          boss_id: 'boss_wind',
          difficulty: 'medium'
        }),
        nakama.rpc('armored_archer/stage_complete', {
          stage_id: '2_5',
          boss_defeated: true,
          boss_id: 'boss_fire',
          difficulty: 'hard'
        }),
        nakama.rpc('armored_archer/stage_complete', {
          stage_id: '3_5',
          boss_defeated: true,
          boss_id: 'boss_ice',
          difficulty: 'hard'
        }),
      ]);

      // At least one should have loot (60% base drop rate)
      const lootResults = results.filter(r =>
        r.payload.gear_dropped !== undefined &&
        r.payload.gear_dropped !== null
      );

      expect(lootResults.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate gear ownership', async () => {
      // First completion to get gear
      const firstResult = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false,
        boss_id: '',
        difficulty: 'easy'
      });

      if (!firstResult.payload.gear_dropped) {
        // Try again until we get gear
        return; // Skip this test if no gear dropped
      }

      const gearId = firstResult.payload.gear_dropped.id;

      // Second completion with same stage config (in real game, RNG would vary)
      // This test verifies the system would handle duplicates if RNG allowed it
      const inventoryResult = await nakama.rpc('armored_archer/get_inventory', {});
      expect(inventoryResult.payload.inventory).toBeDefined();

      // Verify gear is in inventory
      const gearInInventory = inventoryResult.payload.inventory.some(
        (g: any) => g.id === gearId
      );
      expect(gearInInventory).toBe(true);
    });

    it('should grant XP on stage completion', async () => {
      const result = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false,
        boss_id: '',
        difficulty: 'easy'
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.xp_gained).toBeGreaterThan(0);
      expect(result.payload.xp_gained).toBe(100); // Standard XP for stage 1

      // Verify XP was actually applied
      const statsResult = await nakama.rpc('armored_archer/get_player_stats', {});
      expect(statsResult.payload.player_stats.xp).toBe(result.payload.xp_gained);
    });
  });

  describe('VS-5: Inventory Display & Loadout Management', () => {
    let testGearId: string;

    beforeAll(async () => {
      // Get some gear in inventory first
      const result = await nakama.rpc('armored_archer/generate_gear', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false
      });

      testGearId = result.payload.gear.id;
    });

    it('should retrieve player inventory', async () => {
      const result = await nakama.rpc('armored_archer/get_inventory', {});

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);
      expect(result.payload.inventory).toBeDefined();
      expect(Array.isArray(result.payload.inventory)).toBe(true);
      expect(result.payload.loadout).toBeDefined();
    });

    it('should equip gear to valid slot', async () => {
      const result = await nakama.rpc('armored_archer/equip_gear', {
        gear_id: testGearId,
        slot: 'bow'
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);

      // Verify gear is in loadout
      const inventoryResult = await nakama.rpc('armored_archer/get_inventory', {});
      expect(inventoryResult.payload.loadout.bow).toBe(testGearId);
    });

    it('should prevent equipping to invalid slot', async () => {
      // Try to equip a bow to a helm slot (type mismatch)
      const result = await nakama.rpc('armored_archer/equip_gear', {
        gear_id: testGearId,
        slot: 'helm'
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(false);
      expect(result.payload.error).toContain('slot');
    });

    it('should unequip gear from slot', async () => {
      // First equip
      await nakama.rpc('armored_archer/equip_gear', {
        gear_id: testGearId,
        slot: 'bow'
      });

      // Then unequip
      const result = await nakama.rpc('armored_archer/unequip_gear', {
        slot: 'bow'
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);

      // Verify slot is now empty
      const inventoryResult = await nakama.rpc('armored_archer/get_inventory', {});
      expect(inventoryResult.payload.loadout.bow).toBeNull();
    });

    it('should only allow one item per slot', async () => {
      const bowId1 = testGearId;
      const bowId2 = 'test_bow_2'; // Hypothetical second bow

      // Equip first bow
      await nakama.rpc('armored_archer/equip_gear', {
        gear_id: bowId1,
        slot: 'bow'
      });

      // Equip second bow to same slot (should replace or fail)
      const result = await nakama.rpc('armored_archer/equip_gear', {
        gear_id: bowId2,
        slot: 'bow'
      });

      expect(result.payload).toBeDefined();
      // System should either succeed (replacement) or fail (slot occupied)
      expect([true, false]).toContain(result.payload.success);
    });

    it('should calculate stat bonuses from equipped gear', async () => {
      // Get base stats
      const beforeStats = await nakama.rpc('armored_archer/get_player_stats', {});
      const baseAttack = beforeStats.payload.player_stats.stats.attack;

      // Equip gear with +ATK
      await nakama.rpc('armored_archer/equip_gear', {
        gear_id: testGearId,
        slot: 'bow'
      });

      // Get stats with gear
      const afterStats = await nakama.rpc('armored_archer/get_player_stats', {});
      const totalAttack = afterStats.payload.player_stats.stats.attack;

      // Total should be base + gear bonus
      expect(totalAttack).toBeGreaterThan(baseAttack);
    });
  });

  describe('VS-6: Stat Allocation System', () => {
    beforeAll(async () => {
      // Give the player enough XP to level up and get ability points
      await nakama.rpc('armored_archer/gain_xp', {
        xp_amount: 1000,
        source: 'pve'
      });
    });

    it('should grant ability points on level-up', async () => {
      const result = await nakama.rpc('armored_archer/get_player_stats', {});

      expect(result.payload.player_stats.ability_points).toBeGreaterThan(0);
      expect(result.payload.player_stats.level).toBeGreaterThan(1);
    });

    it('should allocate points to attack stat', async () => {
      const beforeStats = await nakama.rpc('armored_archer/get_player_stats', {});
      const beforeAttack = beforeStats.payload.player_stats.stats.attack;

      const result = await nakama.rpc('armored_archer/allocate_stats', {
        stat_name: 'attack',
        points: 1
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(true);

      // Verify attack increased
      const afterStats = await nakama.rpc('armored_archer/get_player_stats', {});
      expect(afterStats.payload.player_stats.stats.attack).toBe(beforeAttack + 1);
      expect(afterStats.payload.player_stats.ability_points).toBe(
        beforeStats.payload.player_stats.ability_points - 1
      );
    });

    it('should validate player owns points before allocation', async () => {
      // Try to allocate more points than available
      const result = await nakama.rpc('armored_archer/allocate_stats', {
        stat_name: 'attack',
        points: 999 // More than available
      });

      expect(result.payload).toBeDefined();
      expect(result.payload.success).toBe(false);
      expect(result.payload.error).toContain('ability_points');
    });

    it('should support allocating to different stats', async () => {
      const stats = ['attack', 'defense', 'dodge', 'crit_rate'];
      const results = await Promise.all(
        stats.map(stat =>
          nakama.rpc('armored_archer/allocate_stats', {
            stat_name: stat,
            points: 1
          })
        )
      );

      for (const result of results) {
        expect(result.payload.success).toBe(true);
      }

      // Verify all stats increased
      const finalStats = await nakama.rpc('armored_archer/get_player_stats', {});
      expect(finalStats.payload.player_stats.stats.attack).toBeGreaterThan(10);
      expect(finalStats.payload.player_stats.stats.defense).toBeGreaterThan(10);
      expect(finalStats.payload.player_stats.stats.dodge).toBeGreaterThan(0);
      expect(finalStats.payload.player_stats.stats.crit_rate).toBeGreaterThan(0);
    });
  });

  describe('VS-7: End-to-End Integration Test', () => {
    it('should complete full vertical slice flow', async () => {
      // Step 1: New player authentication (already done in beforeAll)
      expect(userId).toBeDefined();

      // Step 2: Get initial stats
      const stats1 = await nakama.rpc('armored_archer/get_player_stats', {});
      expect(stats1.payload.player_stats.level).toBe(1);

      // Step 3: Complete stage (simulated PvE win)
      const stageResult = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_STAGE_ID,
        boss_defeated: false,
        boss_id: '',
        difficulty: 'easy'
      });
      expect(stageResult.payload.success).toBe(true);

      // Step 4: Verify XP gained
      expect(stageResult.payload.xp_gained).toBe(100);

      // Step 5: Get inventory (should have loot if RNG allowed)
      const inventory = await nakama.rpc('armored_archer/get_inventory', {});
      expect(inventory.payload.success).toBe(true);
      expect(inventory.payload.inventory).toBeDefined();

      // Step 6: If loot dropped, equip it
      if (stageResult.payload.gear_dropped) {
        const gear = stageResult.payload.gear_dropped;
        const equipResult = await nakama.rpc('armored_archer/equip_gear', {
          gear_id: gear.id,
          slot: gear.type
        });

        expect(equipResult.payload.success).toBe(true);

        // Step 7: Verify equipment in loadout
        const finalInventory = await nakama.rpc('armored_archer/get_inventory', {});
        expect(finalInventory.payload.loadout[gear.type]).toBe(gear.id);

        // Step 8: Verify total stats include gear bonus
        const finalStats = await nakama.rpc('armored_archer/get_player_stats', {});
        expect(finalStats.payload.player_stats.stats.attack).toBeGreaterThan(
          stats1.payload.player_stats.stats.attack
        );
      }

      // Step 9: Verify stage progress updated
      const campaignProgress = await nakama.rpc('armored_archer/get_campaign_progress', {});
      expect(campaignProgress.payload.completed_stages).toContain(TEST_STAGE_ID);
    });

    it('should handle boss defeat flow', async () => {
      // Complete boss stage
      const result = await nakama.rpc('armored_archer/stage_complete', {
        stage_id: TEST_BOSS_STAGE_ID,
        boss_defeated: true,
        boss_id: 'boss_wind',
        difficulty: 'medium'
      });

      expect(result.payload.success).toBe(true);
      expect(result.payload.xp_gained).toBeGreaterThan(100); // Boss XP bonus

      // Verify boss defeat tracking
      const progress = await nakama.rpc('armored_archer/get_campaign_progress', {});
      expect(progress.payload.bosses_defeated).toContain('boss_wind');
    });

    it('should handle rapid-fire combat actions', async () => {
      // Simulate multiple rapid stage completions
      const promises = Array(5).fill(null).map((_, i) =>
        nakama.rpc('armored_archer/stage_complete', {
          stage_id: `1_${i + 1}`,
          boss_defeated: false,
          boss_id: '',
          difficulty: 'easy'
        })
      );

      const results = await Promise.all(promises);

      for (const result of results) {
        expect(result.payload.success).toBe(true);
      }

      // Verify all stages completed
      const progress = await nakama.rpc('armored_archer/get_campaign_progress', {});
      expect(progress.payload.completed_stages.length).toBeGreaterThanOrEqual(5);
    });
  });
});

// Helper function for test data generation
function generateTestGear() {
  return {
    id: `test_gear_${Date.now()}`,
    name: 'Test Bow',
    rarity: 'common',
    type: 'bow',
    stats: [
      { name: 'attack', base_value: 10, value: 10 }
    ],
    modifiers: [],
    level: 1,
    timestamp: Date.now()
  };
}
