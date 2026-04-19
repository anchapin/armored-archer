import { createMockLogger, createMockContext, createMockNakama, testStorage } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';

jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../validation', () => {
  const actual = jest.requireActual('../validation');
  return {
    ...actual,
    validatePayload: (...args: any[]) => actual.validatePayload(...args),
  };
});

jest.mock('../balance_analytics', () => ({
  recordStageAttempt: jest.fn(),
  recordDrop: jest.fn(),
}));

jest.mock('../gear_db', () => ({
  insertGearItem: jest.fn((_nk: any, _userId: string, item: any) => item),
  getPlayerGearFromDB: jest.fn((_nk: any, userId: string) => {
    const key = `player_inventory:${userId}`;
    const data = testStorage.get(key);
    return data ? JSON.parse(data) : [];
  }),
  getPlayerLoadoutFromDB: jest.fn().mockReturnValue({}),
  equipItemInDB: jest.fn(),
  unequipItemInDB: jest.fn(),
  getFullInventoryFromDB: jest.fn().mockReturnValue({ gear: [], loadout: {} }),
  recordBossDefeatInDB: jest.fn(),
  getDefeatedBossesFromDB: jest.fn().mockReturnValue([]),
  getBossDefeatCount: jest.fn().mockReturnValue(0),
  unlockModifierPoolInDB: jest.fn(),
  getUnlockedModifierPoolsFromDB: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/cache', () => ({
  getCacheManager: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
}));

import { rpcGainXP } from '../rpg_system';

describe('PvE stage flow', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  it('should award XP and track progression on stage completion', () => {
    // Seed player stats
    const playerStats = {
      user_id: 'test-user',
      level: 1,
      xp: 0,
      ability_points: 0,
      stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
    };
    testStorage.set('player_stats:test-user', JSON.stringify(playerStats));

    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const key = `${obj.collection}:${obj.key}`;
          const val = testStorage.get(key);
          if (!val) return null;
          return { collection: obj.collection, key: obj.key, value: val };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        testStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });

    // Gain XP from stage completion
    const result = rpcGainXP(
      mockCtx, mockLogger, mockNk,
      JSON.stringify({ xp_amount: 100, source: 'pve' })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.xp_gained).toBe(100);
    expect(parsed.player_stats.xp).toBe(100);
  });

  it('should accumulate XP across multiple stage completions', () => {
    const playerStats = {
      user_id: 'test-user',
      level: 1,
      xp: 0,
      ability_points: 0,
      stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
    };
    testStorage.set('player_stats:test-user', JSON.stringify(playerStats));

    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const key = `${obj.collection}:${obj.key}`;
          const val = testStorage.get(key);
          if (!val) return null;
          return { collection: obj.collection, key: obj.key, value: val };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        testStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });

    // Three consecutive stage completions
    let totalXp = 0;
    for (let i = 0; i < 3; i++) {
      const result = rpcGainXP(
        mockCtx, mockLogger, mockNk,
        JSON.stringify({ xp_amount: 150, source: 'pve' })
      );
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      totalXp += 150;
    }

    // Verify accumulated XP
    const finalStats = JSON.parse(testStorage.get('player_stats:test-user')!);
    expect(finalStats.xp).toBe(totalXp);
  });
});
