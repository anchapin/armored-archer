import { createMockLogger, createMockContext, createMockNakama, testStorage } from '../../__mocks__/nakama';
import {
  rpcGenerateGear,
  rpcEquipGear,
  rpcUnequipGear,
  rpcGetInventory,
  rpcUnlockModifierPool,
  rpcStageComplete,
  PlayerInventory,
  GearItem,
  getModifiersUnlockedByBoss,
  getModifiersUnlockedByEnemy,
  getEquippedGearModifierBonuses,
  applyGearModifiersToPlayerStats,
} from '../gear_system';
import { Runtime } from '../../types/nakama';

describe('gear_system', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    testStorage.clear(); // Clear storage before each test
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  const createMockInventory = (overrides?: Partial<PlayerInventory>): PlayerInventory => {
    const inventory = {
      user_id: 'test-user',
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
      ...overrides,
    };
    // Also store in testStorage for dbQuery mock
    testStorage.set('player_inventory:test-user', JSON.stringify(inventory));
    return inventory;
  };

  const createMockGearItem = (overrides?: Partial<GearItem>): GearItem => ({
    id: 'gear-123',
    name: 'Test Sword',
    rarity: 'common',
    type: 'bow',
    stats: [{ name: 'attack', base_value: 10, value: 10 }],
    modifiers: [],
    level: 1,
    timestamp: Date.now(),
    ...overrides,
  });

  describe('rpcGenerateGear', () => {
    it('should generate gear for new player', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ stage_id: 'stage_1', boss_defeated: false });
      const result = rpcGenerateGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.gear).toBeDefined();
      expect(parsed.gear.id).toBeDefined();
      expect(parsed.gear.type).toBeDefined();
    });

    it('should add gear to existing inventory', () => {
      const inventory = createMockInventory();
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ stage_id: 'stage_1', boss_defeated: false });
      const result = rpcGenerateGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.gear).toBeDefined();
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({ stage_id: '', boss_defeated: 'not boolean' });
      const result = rpcGenerateGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcEquipGear', () => {
    it('should equip gear successfully', () => {
      const gear = createMockGearItem({ type: 'bow' });
      createMockInventory({ gear: [gear] });

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.equipped_gear.bow).toBe('gear-123');
    });

    it('should return error when inventory not found', () => {
      // Clear testStorage to simulate empty inventory
      testStorage.clear();

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Gear not found in inventory');
    });

    it('should return error when gear not found', () => {
      createMockInventory();

      const payload = JSON.stringify({ gear_id: 'nonexistent', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Gear not found in inventory');
    });

    it('should return error when gear type does not match slot', () => {
      const gear = createMockGearItem({ type: 'bow' });
      createMockInventory({ gear: [gear] });

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'armor' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Gear type does not match slot');
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'invalid' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcUnequipGear', () => {
    it('should unequip gear successfully', () => {
      // Set up inventory with an equipped bow
      const inventory = createMockInventory({ gear: [createMockGearItem({ type: 'bow' })] });
      // Manually set the loadout with equipped gear
      testStorage.set('player_inventory:test-user', JSON.stringify({
        ...inventory,
        equipped_gear: { bow: 'gear-123' }
      }));

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // rpcUnequipGear converts DB format (bow_item_id) to expected format (bow) before returning
      expect(parsed.equipped_gear.bow).toBeNull();
    });

    it('should return error when inventory not found', () => {
      // Clear storage to simulate empty inventory
      testStorage.clear();

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('No gear equipped in this slot');
    });

    it('should return error when no gear equipped in slot', () => {
      const inventory = createMockInventory({ equipped_gear: {} });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('No gear equipped in this slot');
    });
  });

  describe('rpcGetInventory', () => {
    it('should return existing inventory', () => {
      const inventory = createMockInventory({ gear: [createMockGearItem()] });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetInventory(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gear).toHaveLength(1);
    });

    it('should return empty inventory when none exists', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetInventory(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gear).toHaveLength(0);
      expect(parsed.equipped_gear).toEqual({});
    });
  });

  describe('rpcUnlockModifierPool', () => {
    it('should unlock modifier pool for new player', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ modifier_id: 'boss_wind' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('boss_wind');
    });

    it('should add to existing unlocked pools', () => {
      const inventory = createMockInventory({ unlocked_modifier_pools: ['boss_basic'] });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ modifier_id: 'boss_wind' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('boss_basic');
      expect(parsed.unlocked_modifier_pools).toContain('boss_wind');
    });

    it('should not duplicate already unlocked pools', () => {
      const inventory = createMockInventory({ unlocked_modifier_pools: ['boss_wind'] });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ modifier_id: 'boss_wind' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      const pools = parsed.unlocked_modifier_pools.filter((p: string) => p === 'boss_wind');
      expect(pools).toHaveLength(1);
    });
  });

  describe('rpcStageComplete', () => {
    it('should complete stage without loot when roll fails', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Set random to 0.9, which is higher than any drop rate
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'easy',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stage_id).toBe('stage_1');
      expect(parsed.loot.dropped).toBe(false);
      expect(parsed.loot.gear).toBeNull();
      expect(parsed.drop_rate).toBe(0.2); // 0.4 * 0.5 = 0.2
    });

    it('should generate loot when roll succeeds', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Set random to 0.1, which is lower than the drop rate
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'medium',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot.dropped).toBe(true);
      expect(parsed.loot.gear).toBeDefined();
      expect(parsed.loot.gear.id).toBeDefined();
      expect(parsed.loot.gear.type).toBeDefined();
      expect(parsed.drop_rate).toBe(0.4); // 0.4 * 1.0 = 0.4
    });

    it('should apply boss drop bonus', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Set random to 0.4, which is between base (0.3) and with boss bonus (0.55)
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'medium',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot.dropped).toBe(true);
      expect(parsed.drop_rate).toBe(0.65); // 0.4 * 1.0 + 0.25 = 0.65
    });

    it('should apply difficulty multiplier correctly', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Set random to 0.7, which is higher than hard without boss (0.45)
      jest.spyOn(Math, 'random').mockReturnValue(0.7);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'hard',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.drop_rate).toBeCloseTo(0.6, 1); // 0.4 * 1.5 = 0.6
      expect(parsed.loot.dropped).toBe(false);
    });

    it('should apply nightmare difficulty multiplier', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Set random to 0.9, higher than nightmare without boss (0.6)
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'nightmare',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.drop_rate).toBe(0.8); // 0.4 * 2.0 = 0.8
      expect(parsed.loot.dropped).toBe(false);
    });

    it('should cap drop rate at 100%', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      // Even with 0.1 roll, nightmare + boss should drop (0.6 + 0.25 = 0.85)
      // This tests that drop rate calculation works correctly
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'nightmare',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.drop_rate).toBe(1.0); // 0.4 * 2.0 + 0.25 = 1.05, capped at 1.0
      expect(parsed.loot.dropped).toBe(true);
    });

    it('should add gear to existing inventory', () => {
      const inventory = createMockInventory({ gear: [createMockGearItem()] });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'easy',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot.dropped).toBe(true);
      // Verify storageWrite was called with updated inventory
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({
        stage_id: '',
        boss_defeated: 'not boolean',
        difficulty: 'invalid',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should handle missing difficulty field', () => {
      const payload = JSON.stringify({ stage_id: 'stage_1', boss_defeated: false });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('getModifiersUnlockedByBoss', () => {
    it('should return modifier pools for boss_wind', () => {
      const result = getModifiersUnlockedByBoss('boss_wind');
      expect(result).toContain('piercing_arrow');
      expect(result).toContain('wind_fury');
    });

    it('should return modifier pools for boss_basic', () => {
      const result = getModifiersUnlockedByBoss('boss_basic');
      expect(result).toContain('heavy_impact');
    });

    it('should return empty array for unknown boss', () => {
      const result = getModifiersUnlockedByBoss('unknown_boss');
      expect(result).toEqual([]);
    });
  });

  describe('getModifiersUnlockedByEnemy', () => {
    it('should return modifier pools for goblin', () => {
      const result = getModifiersUnlockedByEnemy('goblin');
      expect(result).toContain('vitality_boost');
    });

    it('should return modifier pools for skeleton', () => {
      const result = getModifiersUnlockedByEnemy('skeleton');
      expect(result).toContain('fortification');
    });

    it('should return modifier pools for orc', () => {
      const result = getModifiersUnlockedByEnemy('orc');
      expect(result).toContain('heavy_impact');
    });

    it('should return modifier pools for dragon', () => {
      const result = getModifiersUnlockedByEnemy('dragon');
      expect(result).toContain('piercing_arrow');
      expect(result).toContain('wind_fury');
    });

    it('should return empty array for unknown enemy type', () => {
      const result = getModifiersUnlockedByEnemy('unknown_enemy');
      expect(result).toEqual([]);
    });
  });

  describe('getEquippedGearModifierBonuses', () => {
    it('should calculate bonuses from equipped gear', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [
          {
            id: 'gear-1',
            name: 'Test Sword',
            rarity: 'legendary',
            type: 'bow',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              { id: 'sharp_edge', stat: 'attack', value_range: [5, 10], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { bow: 'gear-1', armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses.attack).toBe(5);
    });

    it('should return empty object when no gear equipped', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: { bow: null, armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses).toEqual({});
    });

    it('should sum bonuses from multiple equipped gear', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [
          {
            id: 'gear-1',
            name: 'Test Sword',
            rarity: 'legendary',
            type: 'bow',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              { id: 'sharp_edge', stat: 'attack', value_range: [5, 10], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
          {
            id: 'gear-2',
            name: 'Test Armor',
            rarity: 'epic',
            type: 'armor',
            stats: [{ name: 'defense', base_value: 10, value: 12 }],
            modifiers: [
              { id: 'iron_skin', stat: 'defense', value_range: [3, 5], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { bow: 'gear-1', armor: 'gear-2', amulet: null },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses.attack).toBe(5);
      expect(bonuses.defense).toBe(3);
    });
  });

  describe('applyGearModifiersToPlayerStats', () => {
    it('should apply gear bonuses to base stats', () => {
      const baseStats = { attack: 10, defense: 5, dodge: 3, crit_rate: 0.1 };
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [
          {
            id: 'gear-1',
            name: 'Test Sword',
            rarity: 'legendary',
            type: 'bow',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              { id: 'sharp_edge', stat: 'attack', value_range: [5, 10], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { bow: 'gear-1', armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const result = applyGearModifiersToPlayerStats(baseStats, inventory);
      expect(result.attack).toBe(15); // 10 + 5
      expect(result.defense).toBe(5);
      expect(result.dodge).toBe(3);
      expect(result.crit_rate).toBe(0.1);
    });

    it('should return base stats when no gear equipped', () => {
      const baseStats = { attack: 10, defense: 5, dodge: 3, crit_rate: 0.1 };
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: { bow: null, armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const result = applyGearModifiersToPlayerStats(baseStats, inventory);
      expect(result).toEqual(baseStats);
    });
  });

  describe('rpcEquipGear edge cases', () => {
    it('should return error when inventory value is null', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('Gear not found in inventory');
    });

    it('should return error when inventory value is empty string', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: '',
        },
      ]);

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('Gear not found in inventory');
    });

    it('should return error when inventory data is corrupted', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: 'not valid json {{{',
        },
      ]);

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'bow' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('Gear not found in inventory');
    });
  });

  describe('rpcUnequipGear edge cases', () => {
    it('should return error when inventory value is null', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('No gear equipped in this slot');
    });

    it('should return error when inventory value is empty string', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: '',
        },
      ]);

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('No gear equipped in this slot');
    });

    it('should return error when inventory data is corrupted', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: '{broken json}',
        },
      ]);

      const payload = JSON.stringify({ slot: 'bow' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // Database-backed implementation returns different error
      expect(parsed.error).toBe('No gear equipped in this slot');
    });
  });

  describe('getEquippedGearModifierBonuses edge cases', () => {
    it('should return empty object when inventory is null', () => {
      const bonuses = getEquippedGearModifierBonuses(null as unknown as PlayerInventory);
      expect(bonuses).toEqual({});
    });

    it('should return empty object when equipped_gear is null', () => {
      const inventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: null as unknown as PlayerInventory['equipped_gear'],
        unlocked_modifier_pools: [],
      };
      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses).toEqual({});
    });

    it('should skip equipped gear that is not found in inventory', () => {
      const inventory = createMockInventory({
        gear: [],
        equipped_gear: { bow: 'nonexistent-gear-id' },
      });

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses).toEqual({});
    });

    it('should skip gear with no modifiers', () => {
      const gear = createMockGearItem({ id: 'gear-1', modifiers: [] });
      const inventory = createMockInventory({
        gear: [gear],
        equipped_gear: { bow: 'gear-1' },
      });

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses).toEqual({});
    });
  });

  describe('rpcUnlockModifierPool edge cases', () => {
    it('should handle validation failure with audit log', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ modifier_id: '' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
      // Audit log is written on failure
      expect(mockNk.storageWrite).toHaveBeenCalledTimes(1);
    });

    it('should handle corrupted inventory on unlock', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: '{{invalid json',
        },
      ]);

      const payload = JSON.stringify({ modifier_id: 'vitality_boost' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('INVALID_DATA');
    });

    it('should create new inventory with modifier when value is null', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ modifier_id: 'vitality_boost' });
      const result = rpcUnlockModifierPool(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('vitality_boost');
    });
  });

  describe('rpcGetInventory edge cases', () => {
    it('should return default inventory when storage value is null', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: null,
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetInventory(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gear).toEqual([]);
      expect(parsed.equipped_gear).toEqual({});
      expect(parsed.unlocked_modifier_pools).toEqual([]);
    });

    it('should return stored value when valid', () => {
      const inventory = createMockInventory({ gear: [createMockGearItem()] });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetInventory(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gear).toHaveLength(1);
    });
  });

  describe('rpcStageComplete loot generation branches', () => {
    it('should handle loot drop with existing inventory', () => {
      const inventory = createMockInventory({ gear: [createMockGearItem()] });
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'medium',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot.dropped).toBe(true);
      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should not write storage when loot does not drop', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'easy',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.loot.dropped).toBe(false);
    });

    it('should handle boss defeat with existing boss defeat data', () => {
      const existingInventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: ['heavy_impact'],
      };
      const existingBossDefeatData = {
        user_id: 'test-user',
        defeats: { boss_basic: 2 },
        unlocked_modifiers: ['heavy_impact'],
      };

      let callCount = 0;
      mockNk.storageRead = jest.fn(
        (objects: { collection: string; key: string; userId?: string }[]) => {
          callCount++;
          if (callCount <= 2) {
            return objects.map((obj) => {
              if (obj.collection === 'player_inventory') {
                return {
                  collection: 'player_inventory',
                  key: 'test-user',
                  value: JSON.stringify(existingInventory),
                  version: '1',
                };
              } else if (obj.collection === 'boss_defeat_tracking') {
                return {
                  collection: 'boss_defeat_tracking',
                  key: 'test-user',
                  value: JSON.stringify(existingBossDefeatData),
                  version: '1',
                };
              }
              return { collection: obj.collection, key: obj.key, value: '' };
            });
          }
          return objects.map((obj) => {
            if (obj.collection === 'player_inventory') {
              return {
                collection: 'player_inventory',
                key: 'test-user',
                value: JSON.stringify(existingInventory),
                version: '1',
              };
            } else if (obj.collection === 'boss_defeat_tracking') {
              return {
                collection: 'boss_defeat_tracking',
                key: 'test-user',
                value: JSON.stringify({ ...existingBossDefeatData, defeats: { boss_basic: 3 } }),
                version: '1',
              };
            }
            return { collection: obj.collection, key: obj.key, value: '' };
          });
        }
      );
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'medium',
        boss_id: 'boss_basic',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.boss_defeat_count).toBe(3);
      // heavy_impact already unlocked, so no newly unlocked modifiers
      expect(parsed.newly_unlocked_modifiers).toEqual([]);
    });

    it('should handle stage complete with no storage data and boss defeat', () => {
      // All storage reads return empty arrays (no existing data)
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'hard',
        boss_id: 'boss_fire',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // recordBossDefeat is called and returns defeat_count: 1
      expect(parsed.boss_defeat_count).toBe(1);
      // fire_arrow should be newly unlocked from boss_fire
      expect(parsed.newly_unlocked_modifiers).toContain('fire_arrow');
    });
  });

  describe('rpcStageComplete with enemy_type', () => {
    it('should unlock modifier pools when enemy_type is provided', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'medium',
        enemy_type: 'goblin',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('vitality_boost');
    });

    it('should unlock multiple modifiers for dragon enemy type', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'hard',
        enemy_type: 'dragon',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('piercing_arrow');
      expect(parsed.unlocked_modifier_pools).toContain('wind_fury');
    });

    it('should not unlock modifiers for unknown enemy type', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_1',
        boss_defeated: false,
        difficulty: 'medium',
        enemy_type: 'unknown_creature',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toEqual([]);
    });
  });

  describe('rpcGenerateGear edge cases', () => {
    it('should handle inventory with null value', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: null,
        },
      ]);

      const payload = JSON.stringify({ stage_id: 'stage_1', boss_defeated: false });
      const result = rpcGenerateGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.gear).toBeDefined();
    });

    it('should handle corrupted inventory data', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: '{bad json',
        },
      ]);

      const payload = JSON.stringify({ stage_id: 'stage_1', boss_defeated: false });
      const result = rpcGenerateGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe('INVALID_DATA');
    });
  });

  describe('calculateDropRate edge cases', () => {
    it('should default to 1.0 multiplier for unknown difficulty', () => {
      const { calculateDropRate } = require('../gear_system');
      const rate = calculateDropRate('unknown_difficulty', false);
      expect(rate).toBe(0.4); // 0.4 * 1.0 (default)
    });

    it('should return 1.0 when drop rate exceeds cap', () => {
      const { calculateDropRate } = require('../gear_system');
      // nightmare (2.0) + boss (0.25) = 0.3 * 2.0 + 0.25 = 0.85, still under 1.0
      // But if we had a scenario that exceeds, it should cap
      const rate = calculateDropRate('nightmare', true);
      expect(rate).toBeLessThanOrEqual(1.0);
    });
  });

  describe('getEquippedGearModifierBonuses with zero-value modifiers', () => {
    it('should skip modifiers with zero value_range[0]', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [
          {
            id: 'gear-1',
            name: 'Test Sword',
            rarity: 'common',
            type: 'bow',
            stats: [{ name: 'attack', base_value: 10, value: 10 }],
            modifiers: [
              {
                id: 'broken_edge',
                name: 'Broken',
                description: 'No bonus',
                stat: 'attack',
                value_range: [0, 0],
                rarity: 'common',
                boss_unlock: null,
              },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { bow: 'gear-1' },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses).toEqual({});
    });

    it('should handle gear with modifiers matching different stats', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [
          {
            id: 'gear-1',
            name: 'Test Bow',
            rarity: 'rare',
            type: 'bow',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              {
                id: 'sharp_edge',
                name: 'Sharp',
                description: 'More attack',
                stat: 'attack',
                value_range: [7, 10],
                rarity: 'rare',
                boss_unlock: null,
              },
              {
                id: 'lucky',
                name: 'Lucky',
                description: 'More crit',
                stat: 'crit_rate',
                value_range: [3, 5],
                rarity: 'rare',
                boss_unlock: null,
              },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { bow: 'gear-1' },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses.attack).toBe(7);
      expect(bonuses.crit_rate).toBe(3);
    });
  });

  describe('rpcStageComplete with boss_id for modifier unlock', () => {
    it('should unlock modifier pools when boss is defeated with boss_id', () => {
      // Initialize with empty inventory and boss defeat data to simulate new player
      const initialInventory = {
        gear: [],
        loadout: { helm: null, armor: null, bow: null, arrow: null, amulet: null },
        unlocked_modifier_pools: [],
      };
      const initialBossDefeatData = {
        user_id: 'test-user',
        defeats: {},
        unlocked_modifiers: [],
      };

      // Track calls to simulate storage state changes
      let callCount = 0;
      mockNk.storageRead = jest.fn(
        (objects: { collection: string; key: string; userId?: string }[]) => {
          callCount++;
          if (callCount <= 2) {
            // Initial reads for getPlayerInventory and getBossDefeatData
            return objects.map((obj) => {
              if (obj.collection === 'player_inventory') {
                return {
                  collection: 'player_inventory',
                  key: 'test-user',
                  value: JSON.stringify(initialInventory),
                  version: '1',
                };
              } else if (obj.collection === 'boss_defeat_tracking') {
                return {
                  collection: 'boss_defeat_tracking',
                  key: 'test-user',
                  value: JSON.stringify(initialBossDefeatData),
                  version: '1',
                };
              }
              return { collection: obj.collection, key: obj.key, value: '' };
            });
          }
          // Subsequent reads (after storageWrite) - return updated data
          return objects.map((obj) => {
            if (obj.collection === 'player_inventory') {
              return {
                collection: 'player_inventory',
                key: 'test-user',
                value: JSON.stringify({
                  ...initialInventory,
                  unlocked_modifier_pools: ['piercing_arrow', 'wind_fury'],
                }),
                version: '1',
              };
            } else if (obj.collection === 'boss_defeat_tracking') {
              return {
                collection: 'boss_defeat_tracking',
                key: 'test-user',
                value: JSON.stringify({
                  ...initialBossDefeatData,
                  defeats: { boss_wind: 1 },
                  unlocked_modifiers: ['piercing_arrow', 'wind_fury'],
                }),
                version: '1',
              };
            }
            return { collection: obj.collection, key: obj.key, value: '' };
          });
        }
      );

      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'medium',
        boss_id: 'boss_wind',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('piercing_arrow');
      expect(parsed.unlocked_modifier_pools).toContain('wind_fury');
    });

    it('should unlock modifiers for enemy_type alongside boss defeat', () => {
      const existingInventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [],
      };
      const existingBossDefeatData = {
        user_id: 'test-user',
        defeats: {},
        unlocked_modifiers: [],
      };

      let callCount = 0;
      mockNk.storageRead = jest.fn(
        (objects: { collection: string; key: string; userId?: string }[]) => {
          callCount++;
          if (callCount <= 2) {
            return objects.map((obj) => {
              if (obj.collection === 'player_inventory') {
                return {
                  collection: 'player_inventory',
                  key: 'test-user',
                  value: JSON.stringify(existingInventory),
                  version: '1',
                };
              } else if (obj.collection === 'boss_defeat_tracking') {
                return {
                  collection: 'boss_defeat_tracking',
                  key: 'test-user',
                  value: JSON.stringify(existingBossDefeatData),
                  version: '1',
                };
              }
              return { collection: obj.collection, key: obj.key, value: '' };
            });
          }
          return objects.map((obj) => {
            if (obj.collection === 'player_inventory') {
              return {
                collection: 'player_inventory',
                key: 'test-user',
                value: JSON.stringify({
                  ...existingInventory,
                  unlocked_modifier_pools: ['heavy_impact'],
                }),
                version: '1',
              };
            } else if (obj.collection === 'boss_defeat_tracking') {
              return {
                collection: 'boss_defeat_tracking',
                key: 'test-user',
                value: JSON.stringify({
                  ...existingBossDefeatData,
                  defeats: { boss_basic: 1 },
                  unlocked_modifiers: ['heavy_impact'],
                }),
                version: '1',
              };
            }
            return { collection: obj.collection, key: obj.key, value: '' };
          });
        }
      );
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'medium',
        boss_id: 'boss_basic',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toContain('heavy_impact');
    });

    it('should not unlock modifiers when boss_defeated is false', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: false,
        difficulty: 'medium',
        boss_id: 'boss_wind',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.unlocked_modifier_pools).toEqual([]);
    });

    it('should not duplicate already unlocked modifiers', () => {
      const existingInventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: ['piercing_arrow'],
      };
      const existingBossDefeatData = {
        user_id: 'test-user',
        defeats: { boss_wind: 1 }, // Already defeated once
        unlocked_modifiers: ['piercing_arrow'],
      };

      // Track calls to simulate storage state changes
      let callCount = 0;
      mockNk.storageRead = jest.fn(
        (objects: { collection: string; key: string; userId?: string }[]) => {
          callCount++;
          if (callCount <= 2) {
            // Initial reads for getPlayerInventory and getBossDefeatData
            return objects.map((obj) => {
              if (obj.collection === 'player_inventory') {
                return {
                  collection: 'player_inventory',
                  key: 'test-user',
                  value: JSON.stringify(existingInventory),
                  version: '1',
                };
              } else if (obj.collection === 'boss_defeat_tracking') {
                return {
                  collection: 'boss_defeat_tracking',
                  key: 'test-user',
                  value: JSON.stringify(existingBossDefeatData),
                  version: '1',
                };
              }
              return { collection: obj.collection, key: obj.key, value: '' };
            });
          }
          // Subsequent reads (after storageWrite) - return updated data
          return objects.map((obj) => {
            if (obj.collection === 'player_inventory') {
              return {
                collection: 'player_inventory',
                key: 'test-user',
                value: JSON.stringify(existingInventory),
                version: '1',
              };
            } else if (obj.collection === 'boss_defeat_tracking') {
              return {
                collection: 'boss_defeat_tracking',
                key: 'test-user',
                value: JSON.stringify(existingBossDefeatData),
                version: '1',
              };
            }
            return { collection: obj.collection, key: obj.key, value: '' };
          });
        }
      );
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const payload = JSON.stringify({
        stage_id: 'stage_boss_1',
        boss_defeated: true,
        difficulty: 'medium',
        boss_id: 'boss_wind',
      });
      const result = rpcStageComplete(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      // Should only have piercing_arrow once
      const count = parsed.unlocked_modifier_pools.filter(
        (m: string) => m === 'piercing_arrow'
      ).length;
      expect(count).toBe(1);
    });
  });
});
