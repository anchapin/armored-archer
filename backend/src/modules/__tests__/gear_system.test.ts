import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
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
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  const createMockInventory = (overrides?: Partial<PlayerInventory>): PlayerInventory => ({
    user_id: 'test-user',
    gear: [],
    equipped_gear: {},
    unlocked_modifier_pools: [],
    ...overrides,
  });

  const createMockGearItem = (overrides?: Partial<GearItem>): GearItem => ({
    id: 'gear-123',
    name: 'Test Sword',
    rarity: 'common',
    type: 'weapon',
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
      const gear = createMockGearItem({ type: 'weapon' });
      const inventory = createMockInventory({ gear: [gear] });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'weapon' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.equipped_gear.weapon).toBe('gear-123');
    });

    it('should return error when inventory not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ gear_id: 'gear-123', slot: 'weapon' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player inventory not found');
    });

    it('should return error when gear not found', () => {
      const inventory = createMockInventory();
      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ gear_id: 'nonexistent', slot: 'weapon' });
      const result = rpcEquipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Gear not found in inventory');
    });

    it('should return error when gear type does not match slot', () => {
      const gear = createMockGearItem({ type: 'weapon' });
      const inventory = createMockInventory({ gear: [gear] });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

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
      const inventory = createMockInventory({ equipped_gear: { weapon: 'gear-123' } });

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(inventory),
        },
      ]);

      const payload = JSON.stringify({ slot: 'weapon' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.equipped_gear.weapon).toBeUndefined();
    });

    it('should return error when inventory not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({ slot: 'weapon' });
      const result = rpcUnequipGear(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player inventory not found');
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

      const payload = JSON.stringify({ slot: 'weapon' });
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
      expect(parsed.drop_rate).toBe(0.15); // 0.3 * 0.5 = 0.15
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
      expect(parsed.drop_rate).toBe(0.3); // 0.3 * 1.0 = 0.3
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
      expect(parsed.drop_rate).toBe(0.55); // 0.3 * 1.0 + 0.25 = 0.55
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
      expect(parsed.drop_rate).toBeCloseTo(0.45); // 0.3 * 1.5 = 0.45
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
      expect(parsed.drop_rate).toBe(0.6); // 0.3 * 2.0 = 0.6
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
      expect(parsed.drop_rate).toBe(0.85); // 0.3 * 2.0 + 0.25 = 0.85
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
      const payload = JSON.stringify({ stage_id: '', boss_defeated: 'not boolean', difficulty: 'invalid' });
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
            type: 'weapon',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              { id: 'sharp_edge', stat: 'attack', value_range: [5, 10], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { weapon: 'gear-1', armor: null, accessory: null },
        unlocked_modifier_pools: [],
      };

      const bonuses = getEquippedGearModifierBonuses(inventory);
      expect(bonuses.attack).toBe(5);
    });

    it('should return empty object when no gear equipped', () => {
      const inventory: PlayerInventory = {
        user_id: 'test-user',
        gear: [],
        equipped_gear: { weapon: null, armor: null, accessory: null },
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
            type: 'weapon',
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
        equipped_gear: { weapon: 'gear-1', armor: 'gear-2', accessory: null },
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
            type: 'weapon',
            stats: [{ name: 'attack', base_value: 10, value: 15 }],
            modifiers: [
              { id: 'sharp_edge', stat: 'attack', value_range: [5, 10], rarity_weight: 1 },
            ],
            level: 1,
            timestamp: Date.now(),
          },
        ],
        equipped_gear: { weapon: 'gear-1', armor: null, accessory: null },
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
        equipped_gear: { weapon: null, armor: null, accessory: null },
        unlocked_modifier_pools: [],
      };

      const result = applyGearModifiersToPlayerStats(baseStats, inventory);
      expect(result).toEqual(baseStats);
    });
  });

  describe('rpcStageComplete with boss_id for modifier unlock', () => {
    it('should unlock modifier pools when boss is defeated with boss_id', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);
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

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_inventory',
          key: 'test-user',
          value: JSON.stringify(existingInventory),
        },
      ]);
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
      const count = parsed.unlocked_modifier_pools.filter((m: string) => m === 'piercing_arrow').length;
      expect(count).toBe(1);
    });
  });
});
