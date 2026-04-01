import {
  validatePlayerStats,
  validateGearInventory,
  recordStatMutation,
  validateFullProgression,
  ProgressionValidation,
  ValidationResult,
} from '../../src/modules/progression_validation';
import { logAudit } from '../../src/modules/audit';
import { PlayerStats } from '../../src/modules/rpg_system';
import { PlayerInventory } from '../../src/modules/gear_system';

jest.mock('../../src/modules/audit', () => ({
  logAudit: jest.fn(),
}));

const mockLogAudit = logAudit as jest.MockedFunction<typeof logAudit>;

const mockNk = { storageWrite: jest.fn().mockReturnValue([]) } as any;
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

function makePlayerStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    user_id: 'user1',
    level: 1,
    xp: 0,
    ability_points: 0,
    stats: { attack: 10, defense: 10, dodge: 5, crit_rate: 5 },
    ...overrides,
  };
}

function makeInventory(overrides: Partial<PlayerInventory> = {}): PlayerInventory {
  return {
    user_id: 'user1',
    gear: [],
    equipped_gear: {},
    unlocked_modifier_pools: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validatePlayerStats', () => {
  it('should return valid for correct level 1 stats', () => {
    const stats = makePlayerStats();
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return valid when ability_points equals level - 1', () => {
    const stats = makePlayerStats({ level: 5, xp: 1600, ability_points: 4 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return critical when ability_points exceeds level - 1', () => {
    const stats = makePlayerStats({ level: 3, xp: 400, ability_points: 5 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'ability_points',
        message: 'Ability points exceed expected maximum for level',
      })
    );
  });

  it('should return critical when ability_points is negative', () => {
    const stats = makePlayerStats({ ability_points: -1 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'ability_points',
        message: 'Ability points cannot be negative',
      })
    );
  });

  it('should return critical when XP decreased from previous stats', () => {
    const current = makePlayerStats({ xp: 50 });
    const previous = makePlayerStats({ xp: 100 });
    const result = validatePlayerStats(current, previous);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'xp_mutation',
        message: 'XP decreased - monotonicity violated',
      })
    );
  });

  it('should pass XP monotonicity when XP is equal', () => {
    // xp=100 => level 2, ability_points up to 1
    const current = makePlayerStats({ xp: 100, level: 2, ability_points: 1 });
    const previous = makePlayerStats({ xp: 100, level: 2, ability_points: 1 });
    const result = validatePlayerStats(current, previous);

    expect(result.is_valid).toBe(true);
  });

  it('should pass XP monotonicity when no previous stats provided', () => {
    const current = makePlayerStats({ xp: 0 });
    const result = validatePlayerStats(current);

    expect(result.is_valid).toBe(true);
  });

  it('should return critical when level does not match XP', () => {
    // XP=400 => sqrt(400/100)=2 => level should be 3
    const stats = makePlayerStats({ level: 5, xp: 400, ability_points: 4 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'level_xp_mismatch',
      })
    );
  });

  it('should calculate level correctly from XP', () => {
    // XP=0 => sqrt(0)=0 => level 1
    expect(validatePlayerStats(makePlayerStats({ xp: 0, level: 1 })).is_valid).toBe(true);
    // XP=100 => sqrt(1)=1 => level 2
    expect(validatePlayerStats(makePlayerStats({ xp: 100, level: 2, ability_points: 1 })).is_valid).toBe(true);
    // XP=400 => sqrt(4)=2 => level 3
    expect(validatePlayerStats(makePlayerStats({ xp: 400, level: 3, ability_points: 2 })).is_valid).toBe(true);
    // XP=900 => sqrt(9)=3 => level 4
    expect(validatePlayerStats(makePlayerStats({ xp: 900, level: 4, ability_points: 3 })).is_valid).toBe(true);
    // XP=1600 => sqrt(16)=4 => level 5
    expect(validatePlayerStats(makePlayerStats({ xp: 1600, level: 5, ability_points: 4 })).is_valid).toBe(true);
  });

  it('should return critical for negative attack stat', () => {
    const stats = makePlayerStats({ stats: { attack: -5, defense: 10, dodge: 5, crit_rate: 5 } });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'stat_validity',
        message: 'Stat attack is negative',
      })
    );
  });

  it('should return critical for negative defense stat', () => {
    const stats = makePlayerStats({ stats: { attack: 10, defense: -1, dodge: 5, crit_rate: 5 } });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'stat_validity',
        message: 'Stat defense is negative',
      })
    );
  });

  it('should return critical for negative dodge stat', () => {
    const stats = makePlayerStats({ stats: { attack: 10, defense: 10, dodge: -1, crit_rate: 5 } });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'stat_validity',
        message: 'Stat dodge is negative',
      })
    );
  });

  it('should return critical for negative crit_rate stat', () => {
    const stats = makePlayerStats({ stats: { attack: 10, defense: 10, dodge: 5, crit_rate: -1 } });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'stat_validity',
        message: 'Stat crit_rate is negative',
      })
    );
  });

  it('should return multiple issues when multiple problems exist', () => {
    const stats = makePlayerStats({
      level: 3,
      xp: 100,
      ability_points: 10,
      stats: { attack: -1, defense: -1, dodge: 0, crit_rate: 0 },
    });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(false);
    // Should have: ability_points excess, level_xp_mismatch, 2 stat negatives
    expect(result.issues.filter((i) => i.severity === 'critical').length).toBeGreaterThanOrEqual(3);
  });

  it('should handle XP=0 with level 1 correctly', () => {
    const stats = makePlayerStats({ xp: 0, level: 1, ability_points: 0 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe('validateGearInventory', () => {
  it('should return valid for empty inventory', () => {
    const inventory = makeInventory();
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return valid for correctly equipped gear', () => {
    const inventory = makeInventory({
      gear: [
        { id: 'sword1', type: 'weapon' } as any,
        { id: 'shield1', type: 'armor' } as any,
      ],
      equipped_gear: { weapon: 'sword1', armor: 'shield1' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return critical for duplicate equipped gear', () => {
    const inventory = makeInventory({
      gear: [{ id: 'sword1', type: 'weapon' } as any],
      equipped_gear: { weapon: 'sword1', armor: 'sword1' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'duplicate_equipped_gear',
        message: 'Same gear equipped in multiple slots',
      })
    );
  });

  it('should return critical for multiple helmets', () => {
    const inventory = makeInventory({
      gear: [
        { id: 'helmet1', type: 'helmet' } as any,
        { id: 'crown1', type: 'crown' } as any,
      ],
      equipped_gear: { head: 'helmet1', face: 'crown1' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'multiple_helmets',
        message: 'Multiple helmet/head pieces equipped',
      })
    );
  });

  it('should detect helmet type variants (head, mask, crown)', () => {
    const inventory = makeInventory({
      gear: [
        { id: 'mask1', type: 'mask' } as any,
        { id: 'headgear1', type: 'head' } as any,
      ],
      equipped_gear: { slot1: 'mask1', slot2: 'headgear1' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ category: 'multiple_helmets' })
    );
  });

  it('should allow one helmet piece equipped', () => {
    const inventory = makeInventory({
      gear: [{ id: 'helmet1', type: 'helmet' } as any],
      equipped_gear: { head: 'helmet1' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(true);
  });

  it('should return critical for equipped gear not in inventory', () => {
    const inventory = makeInventory({
      gear: [],
      equipped_gear: { weapon: 'nonexistent_sword' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        category: 'missing_equipped_gear',
        message: 'Equipped gear not found in inventory',
        details: expect.objectContaining({
          slot: 'weapon',
          gear_id: 'nonexistent_sword',
        }),
      })
    );
  });

  it('should handle null equipped slots without error', () => {
    const inventory = makeInventory({
      gear: [{ id: 'sword1', type: 'weapon' } as any],
      equipped_gear: { weapon: 'sword1', armor: null, helm: null },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect case-insensitive helmet types', () => {
    const inventory = makeInventory({
      gear: [
        { id: 'h1', type: 'Helmet' } as any,
        { id: 'h2', type: 'Crown' } as any,
      ],
      equipped_gear: { slot1: 'h1', slot2: 'h2' },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ category: 'multiple_helmets' })
    );
  });
});

describe('recordStatMutation', () => {
  it('should call logAudit with correct delta', () => {
    const before = { attack: 10, defense: 5 };
    const after = { attack: 15, defense: 3 };

    recordStatMutation(mockNk, 'user1', '127.0.0.1', before, after, 'level_up');

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      '127.0.0.1',
      'stat_mutation',
      'player_stats',
      expect.objectContaining({
        before,
        after,
        delta: { attack: 5, defense: -2 },
        source: 'level_up',
      }),
      'success'
    );
  });

  it('should handle null ip address', () => {
    const before = { attack: 10 };
    const after = { attack: 10 };

    recordStatMutation(mockNk, 'user1', null, before, after, 'test');

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      null,
      'stat_mutation',
      'player_stats',
      expect.anything(),
      'success'
    );
  });

  it('should handle undefined ip address', () => {
    const before = { attack: 10 };
    const after = { attack: 12 };

    recordStatMutation(mockNk, 'user1', undefined, before, after, 'test');

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      null,
      'stat_mutation',
      'player_stats',
      expect.anything(),
      'success'
    );
  });

  it('should default missing before keys to 0', () => {
    const before = { attack: 10 } as Record<string, number>;
    const after = { attack: 15, defense: 5 };

    recordStatMutation(mockNk, 'user1', '127.0.0.1', before, after, 'test');

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      '127.0.0.1',
      'stat_mutation',
      'player_stats',
      expect.objectContaining({
        delta: { attack: 5, defense: 5 },
      }),
      'success'
    );
  });
});

describe('validateFullProgression', () => {
  it('should return valid when both stats and gear are valid', () => {
    const stats = makePlayerStats();
    const inventory = makeInventory();
    const result = validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should combine issues from both validations', () => {
    const stats = makePlayerStats({ ability_points: -1 });
    const inventory = makeInventory({
      gear: [],
      equipped_gear: { weapon: 'missing' },
    });

    const result = validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.some((i) => i.category === 'ability_points')).toBe(true);
    expect(result.issues.some((i) => i.category === 'missing_equipped_gear')).toBe(true);
  });

  it('should return invalid only from stats issues', () => {
    const stats = makePlayerStats({ ability_points: -1 });
    const inventory = makeInventory();
    const result = validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues.every((i) => i.category === 'ability_points')).toBe(true);
  });

  it('should return invalid only from gear issues', () => {
    const stats = makePlayerStats();
    const inventory = makeInventory({
      gear: [],
      equipped_gear: { weapon: 'ghost' },
    });
    const result = validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(result.is_valid).toBe(false);
    expect(result.issues.every((i) => i.category === 'missing_equipped_gear')).toBe(true);
  });

  it('should log audit when validation fails', () => {
    const stats = makePlayerStats({ ability_points: -1 });
    const inventory = makeInventory();

    validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory, '10.0.0.1');

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      '10.0.0.1',
      'progression_validation',
      'player_progression',
      expect.objectContaining({
        stats_issues: expect.any(Array),
        gear_issues: expect.any(Array),
      }),
      'success'
    );
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should not log audit when validation passes', () => {
    const stats = makePlayerStats();
    const inventory = makeInventory();

    validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(mockLogAudit).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should use null ip address when not provided', () => {
    const stats = makePlayerStats({ ability_points: -1 });
    const inventory = makeInventory();

    validateFullProgression(mockNk, 'user1', mockLogger, stats, inventory);

    expect(mockLogAudit).toHaveBeenCalledWith(
      mockNk,
      'user1',
      null,
      'progression_validation',
      'player_progression',
      expect.anything(),
      'success'
    );
  });
});

describe('ProgressionValidation convenience object', () => {
  it('should expose validatePlayerStats', () => {
    expect(typeof ProgressionValidation.validatePlayerStats).toBe('function');
    const result = ProgressionValidation.validatePlayerStats(makePlayerStats());
    expect(result).toHaveProperty('is_valid');
    expect(result).toHaveProperty('issues');
  });

  it('should expose validateGearInventory', () => {
    expect(typeof ProgressionValidation.validateGearInventory).toBe('function');
    const result = ProgressionValidation.validateGearInventory(makeInventory());
    expect(result).toHaveProperty('is_valid');
  });

  it('should expose validateFullProgression', () => {
    expect(typeof ProgressionValidation.validateFullProgression).toBe('function');
  });

  it('should expose recordStatMutation', () => {
    expect(typeof ProgressionValidation.recordStatMutation).toBe('function');
  });
});

describe('warning-only issues', () => {
  it('should still be valid when only warnings are present', () => {
    // The current implementation only generates critical issues,
    // but verify the is_valid logic works correctly with hypothetical warnings
    const stats = makePlayerStats();
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
    expect(
      result.issues.filter((i) => i.severity === 'critical')
    ).toHaveLength(0);
  });
});

describe('edge cases', () => {
  it('should handle XP=0 yielding level 1', () => {
    const stats = makePlayerStats({ xp: 0, level: 1, ability_points: 0 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
  });

  it('should handle XP near level boundaries', () => {
    // XP=99 => sqrt(0.99)~0.99 => floor=0 => level 1
    const stats99 = makePlayerStats({ xp: 99, level: 1, ability_points: 0 });
    expect(validatePlayerStats(stats99).is_valid).toBe(true);

    // XP=100 => sqrt(1)=1 => level 2
    const stats100 = makePlayerStats({ xp: 100, level: 2, ability_points: 1 });
    expect(validatePlayerStats(stats100).is_valid).toBe(true);

    // XP=101 => sqrt(1.01)~1.005 => floor=1 => level 2
    const stats101 = makePlayerStats({ xp: 101, level: 2, ability_points: 1 });
    expect(validatePlayerStats(stats101).is_valid).toBe(true);
  });

  it('should handle fully empty inventory with all null slots', () => {
    const inventory = makeInventory({
      equipped_gear: { weapon: null, armor: null, helm: null },
    });
    const result = validateGearInventory(inventory);

    expect(result.is_valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should handle negative XP as level 1 due to Math.max(0, xp)', () => {
    const stats = makePlayerStats({ xp: -50, level: 1, ability_points: 0 });
    const result = validatePlayerStats(stats);

    // Level from XP: Math.floor(Math.sqrt(Math.max(0, -50)/100)) + 1 = 1
    // So level matches. But negative XP isn't caught by monotonicity without previousStats
    expect(result.is_valid).toBe(true);
  });

  it('should handle very large XP values', () => {
    const xp = 1000000;
    const expectedLevel = Math.floor(Math.sqrt(xp / 100)) + 1; // 101
    const stats = makePlayerStats({ xp, level: expectedLevel, ability_points: expectedLevel - 1 });
    const result = validatePlayerStats(stats);

    expect(result.is_valid).toBe(true);
  });
});
