import { testHelper, TestAccount } from './helpers';

describe('RPG System Integration Tests', () => {
  let player: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    player = await testHelper.createTestAccount('rpg_player');
  }, 120000);

  afterEach(async () => {
    // Reset player stats to baseline after each test
    await testHelper.writeStorageObject(
      'player_stats',
      player.userId,
      player.userId,
      {
        level: 1,
        xp: 0,
        ability_points: 0,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
      }
    );
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

  // Helper to get player stats
  async function getPlayerStats(account: TestAccount): Promise<any> {
    const result = await rpcCall(account, 'armored_archer/get_player_stats', {});
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  describe('rpcGainXP', () => {
    test('should gain XP and update stats', async () => {
      const payload = { xp_amount: 100, source: 'pve' };
      const result = await rpcCall(player, 'armored_archer/gain_xp', payload);

      expect(result.success).toBe(true);
      expect(result.xp_gained).toBe(100);
      expect(result.levels_gained).toBe(0); // Not enough to level up yet

      const stats = await getPlayerStats(player);
      expect(stats.xp).toBe(100);
      expect(stats.level).toBe(1);
    });

    test('should level up when XP exceeds threshold', async () => {
      // Gain enough XP to reach level 2 (requires 100 XP)
      const payload = { xp_amount: 150, source: 'pve' };
      const result = await rpcCall(player, 'armored_archer/gain_xp', payload);

      expect(result.success).toBe(true);
      expect(result.levels_gained).toBe(1);

      const stats = await getPlayerStats(player);
      expect(stats.level).toBe(2);
      expect(stats.ability_points).toBe(1); // 1 ability point per level up
      expect(stats.xp).toBe(50); // 150 - 100 = 50 remaining
    });

    test('should accumulate XP across multiple gains', async () => {
      // First gain
      await rpcCall(player, 'armored_archer/gain_xp', { xp_amount: 50, source: 'pve' });
      // Second gain
      await rpcCall(player, 'armored_archer/gain_xp', { xp_amount: 60, source: 'pve' });

      const stats = await getPlayerStats(player);
      expect(stats.xp).toBe(110);
      expect(stats.level).toBe(2);
      expect(stats.ability_points).toBe(1);
    });

    test('should handle multiple level ups in single gain', async () => {
      // Gain enough XP to jump multiple levels (level 1 -> 5 requires 100 + 150 + 225 + 337 = 812 XP)
      const payload = { xp_amount: 900, source: 'pve' };
      const result = await rpcCall(player, 'armored_archer/gain_xp', payload);

      expect(result.success).toBe(true);
      expect(result.levels_gained).toBe(4); // Level 1 -> 5

      const stats = await getPlayerStats(player);
      expect(stats.level).toBe(5);
      expect(stats.ability_points).toBe(4); // 4 points, one per level
    });

    test('should accept both pve and pvp XP sources', async () => {
      const pveResult = await rpcCall(player, 'armored_archer/gain_xp', { xp_amount: 50, source: 'pve' });
      expect(pveResult.success).toBe(true);

      const pvpResult = await rpcCall(player, 'armored_archer/gain_xp', { xp_amount: 50, source: 'pvp' });
      expect(pvpResult.success).toBe(true);

      const stats = await getPlayerStats(player);
      expect(stats.xp).toBe(100);
    });

    test('should create new player stats if none exist', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_rpg');

      const payload = { xp_amount: 100, source: 'pve' };
      const result = await rpcCall(freshPlayer, 'armored_archer/gain_xp', payload);

      expect(result.success).toBe(true);
      expect(result.player_stats.level).toBe(1);
      expect(result.player_stats.xp).toBe(100);

      const stats = await getPlayerStats(freshPlayer);
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(100);
    });

    test('should return error for invalid source', async () => {
      const payload = { xp_amount: 100, source: 'invalid' };
      const result = await rpcCall(player, 'armored_archer/gain_xp', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should return error for negative XP', async () => {
      const payload = { xp_amount: -50, source: 'pve' };
      const result = await rpcCall(player, 'armored_archer/gain_xp', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcAllocateStats', () => {
    beforeEach(async () => {
      // Give player some XP to level up and gain ability points
      await rpcCall(player, 'armored_archer/gain_xp', { xp_amount: 500, source: 'pve' });
    });

    test('should allocate ability points to stats', async () => {
      const initialStats = await getPlayerStats(player);
      expect(initialStats.ability_points).toBeGreaterThan(0);

      const payload = { stat_name: 'attack', points: 2 };
      const result = await rpcCall(player, 'armored_archer/allocate_stats', payload);

      expect(result.success).toBe(true);
      expect(result.player_stats.stats.attack).toBe(initialStats.stats.attack + 2);
      expect(result.player_stats.ability_points).toBe(initialStats.ability_points - 2);
    });

    test('should allow allocating to different stats', async () => {
      const allocations = [
        { stat_name: 'attack', points: 1 },
        { stat_name: 'defense', points: 1 },
        { stat_name: 'dodge', points: 1 },
        { stat_name: 'crit_rate', points: 1 },
      ];

      let currentStats = await getPlayerStats(player);
      const startingAbilityPoints = currentStats.ability_points;

      for (const alloc of allocations) {
        const result = await rpcCall(player, 'armored_archer/allocate_stats', alloc);
        expect(result.success).toBe(true);
        currentStats = result.player_stats;
      }

      expect(currentStats.stats.attack).toBe(11); // base 10 + 1
      expect(currentStats.stats.defense).toBe(11); // base 10 + 1
      expect(currentStats.stats.dodge).toBe(11); // base 10 + 1
      expect(currentStats.stats.crit_rate).toBe(6); // base 5 + 1
      expect(currentStats.ability_points).toBe(startingAbilityPoints - 4);
    });

    test('should fail when not enough ability points', async () => {
      // Reset to minimal ability points
      await testHelper.writeStorageObject(
        'player_stats',
        player.userId,
        player.userId,
        {
          level: 2,
          xp: 100,
          ability_points: 1,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
        }
      );

      const payload = { stat_name: 'attack', points: 2 };
      const result = await rpcCall(player, 'armored_archer/allocate_stats', payload);

      expect(result.error).toBe('Not enough ability points');
    });

    test('should fail for invalid stat name', async () => {
      const payload = { stat_name: 'invalid_stat', points: 1 };
      const result = await rpcCall(player, 'armored_archer/allocate_stats', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should fail for negative points', async () => {
      const payload = { stat_name: 'attack', points: -1 };
      const result = await rpcCall(player, 'armored_archer/allocate_stats', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should fail when player stats not found', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_alloc');

      const payload = { stat_name: 'attack', points: 1 };
      const result = await rpcCall(freshPlayer, 'armored_archer/allocate_stats', payload);

      expect(result.error).toBe('Player stats not found');
    });

    test('should persist stat allocation across sessions', async () => {
      // Allocate points
      const allocatePayload = { stat_name: 'attack', points: 3 };
      const allocateResult = await rpcCall(player, 'armored_archer/allocate_stats', allocatePayload);
      expect(allocateResult.success).toBe(true);
      expect(allocateResult.player_stats.stats.attack).toBe(13); // base 10 + 3

      // Create a new client for same user to verify persistence
      const newAccount = await testHelper.createTestAccount('rpg_player_2');
      // We can't use same userId easily with createTestAccount, but we can directly read storage
      const storageObj = await testHelper.getStorageObject('player_stats', player.userId, player.userId);
      expect(storageObj).not.toBeNull();
      const storedStats = JSON.parse(storageObj!.value);
      expect(storedStats.stats.attack).toBe(13);
    });
  });

  describe('rpcGetPlayerStats', () => {
    test('should return player stats', async () => {
      await testHelper.writeStorageObject(
        'player_stats',
        player.userId,
        player.userId,
        {
          level: 15,
          xp: 2500,
          ability_points: 3,
          stats: { attack: 35, defense: 25, dodge: 20, crit_rate: 15 }
        }
      );

      const result = await rpcCall(player, 'armored_archer/get_player_stats', {});

      expect(result.level).toBe(15);
      expect(result.xp).toBe(2500);
      expect(result.ability_points).toBe(3);
      expect(result.stats.attack).toBe(35);
      expect(result.stats.defense).toBe(25);
      expect(result.stats.dodge).toBe(20);
      expect(result.stats.crit_rate).toBe(15);
    });

    test('should return default stats for new player', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_stats');

      // Don't set any stats
      const result = await rpcCall(freshPlayer, 'armored_archer/get_player_stats', {});

      expect(result.level).toBe(1);
      expect(result.xp).toBe(0);
      expect(result.ability_points).toBe(0);
      expect(result.stats.attack).toBe(10);
      expect(result.stats.defense).toBe(10);
      expect(result.stats.dodge).toBe(10);
      expect(result.stats.crit_rate).toBe(5);
    });

    test('should return error for malformed stats', async () => {
      // Write malformed data
      await testHelper.writeStorageObject(
        'player_stats',
        player.userId,
        player.userId,
        'invalid json data'
      );

      const result = await rpcCall(player, 'armored_archer/get_player_stats', {});

      expect(result.error).toBeDefined();
      // When parsing fails, it returns the default stats (empty object parsing)
      // This depends on implementation; the actual behavior may vary
    });
  });
});
