import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcGenerateGear,
  rpcEquipGear,
  rpcUnequipGear,
  rpcGetInventory,
  rpcUnlockModifierPool,
  PlayerInventory,
  GearItem,
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
});
