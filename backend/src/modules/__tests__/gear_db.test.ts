/**
 * Tests for gear database operations related to boss defeats and modifier pools.
 */

import { createMockLogger, createMockContext, createMockNakama, testStorage } from '../../__mocks__/nakama';
import {
  recordBossDefeatInDB,
  getDefeatedBossesFromDB,
  getBossDefeatCount,
  unlockModifierPoolInDB,
  getUnlockedModifierPoolsFromDB,
  isModifierPoolUnlocked,
} from '../gear_db';
import { Runtime } from '../../types/nakama';

describe('gear_db boss defeat tracking', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    testStorage.clear(); // Clear test storage between tests
  });

  describe('recordBossDefeatInDB', () => {
    it('should record first boss defeat', () => {
      const result = recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');

      expect(result.success).toBe(true);
      expect(result.defeat_count).toBe(1);
      expect(result.first_defeat).toBe(true);
    });

    it('should increment defeat count on subsequent defeats', () => {
      // First defeat
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_fire');

      // Second defeat
      const result = recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_fire');

      expect(result.success).toBe(true);
      expect(result.defeat_count).toBe(2);
      expect(result.first_defeat).toBe(false);
    });

    it('should track different bosses separately', () => {
      const result1 = recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');
      const result2 = recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_fire');
      const result3 = recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');

      expect(result1.defeat_count).toBe(1);
      expect(result2.defeat_count).toBe(1);
      expect(result3.defeat_count).toBe(2);
    });
  });

  describe('getDefeatedBossesFromDB', () => {
    it('should return empty array when no bosses defeated', () => {
      const defeated = getDefeatedBossesFromDB(mockNk, mockCtx.userId);

      expect(defeated).toEqual([]);
    });

    it('should return list of defeated bosses', () => {
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_fire');

      const defeated = getDefeatedBossesFromDB(mockNk, mockCtx.userId);

      expect(defeated).toContain('boss_wind');
      expect(defeated).toContain('boss_fire');
    });
  });

  describe('getBossDefeatCount', () => {
    it('should return 0 for never defeated boss', () => {
      const count = getBossDefeatCount(mockNk, mockCtx.userId, 'boss_wind');

      expect(count).toBe(0);
    });

    it('should return correct defeat count', () => {
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');
      recordBossDefeatInDB(mockNk, mockCtx.userId, 'boss_wind');

      const count = getBossDefeatCount(mockNk, mockCtx.userId, 'boss_wind');

      expect(count).toBe(3);
    });
  });
});

describe('gear_db modifier pool tracking', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    testStorage.clear(); // Clear test storage between tests
  });

  describe('unlockModifierPoolInDB', () => {
    it('should unlock modifier pool for the first time', () => {
      const result = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');

      expect(result.success).toBe(true);
      expect(result.newly_unlocked).toBe(true);
    });

    it('should not duplicate already unlocked modifier pool', () => {
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');

      const result = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');

      expect(result.success).toBe(true);
      expect(result.newly_unlocked).toBe(false);
    });

    it('should track multiple modifier pools', () => {
      const result1 = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');
      const result2 = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'wind_fury', 'boss_defeat', 'boss_wind');

      expect(result1.newly_unlocked).toBe(true);
      expect(result2.newly_unlocked).toBe(true);

      const pools = getUnlockedModifierPoolsFromDB(mockNk, mockCtx.userId);
      expect(pools).toContain('piercing_arrow');
      expect(pools).toContain('wind_fury');
    });

    it('should support different unlock reasons', () => {
      const result1 = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'vitality_boost', 'enemy_defeat');
      const result2 = unlockModifierPoolInDB(mockNk, mockCtx.userId, 'fortification', 'purchase');

      expect(result1.newly_unlocked).toBe(true);
      expect(result2.newly_unlocked).toBe(true);
    });
  });

  describe('getUnlockedModifierPoolsFromDB', () => {
    it('should return empty array when no modifiers unlocked', () => {
      const pools = getUnlockedModifierPoolsFromDB(mockNk, mockCtx.userId);

      expect(pools).toEqual([]);
    });

    it('should return all unlocked modifier pools', () => {
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'wind_fury', 'boss_defeat', 'boss_wind');
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'fire_arrow', 'boss_defeat', 'boss_fire');

      const pools = getUnlockedModifierPoolsFromDB(mockNk, mockCtx.userId);

      expect(pools).toContain('piercing_arrow');
      expect(pools).toContain('wind_fury');
      expect(pools).toContain('fire_arrow');
    });
  });

  describe('isModifierPoolUnlocked', () => {
    it('should return false for locked modifier', () => {
      const isUnlocked = isModifierPoolUnlocked(mockNk, mockCtx.userId, 'piercing_arrow');

      expect(isUnlocked).toBe(false);
    });

    it('should return true for unlocked modifier', () => {
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');

      const isUnlocked = isModifierPoolUnlocked(mockNk, mockCtx.userId, 'piercing_arrow');

      expect(isUnlocked).toBe(true);
    });

    it('should return false for different user', () => {
      unlockModifierPoolInDB(mockNk, mockCtx.userId, 'piercing_arrow', 'boss_defeat', 'boss_wind');

      const isUnlocked = isModifierPoolUnlocked(mockNk, 'other-user', 'piercing_arrow');

      expect(isUnlocked).toBe(false);
    });
  });
});
