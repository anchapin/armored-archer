import {
  initializeAuditLogging,
  recordViolation,
  getUserViolationSummary,
  getTopViolators,
  generateAuditReport,
  isUserSuspended,
  clearUserFlag,
  suspendUser,
  getAuditStats,
  resetAuditState,
  ViolationType,
} from '../anti_cheat_audit';

const mockNk = { storageWrite: jest.fn().mockReturnValue([]) } as any;
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

beforeEach(() => {
  resetAuditState();
  jest.clearAllMocks();
  initializeAuditLogging({}, mockNk, mockLogger);
});

describe('initializeAuditLogging', () => {
  it('sets config and logs initialization', () => {
    initializeAuditLogging(
      { highRiskThreshold: 30, suspensionThreshold: 10 },
      mockNk,
      mockLogger
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit logging system initialized with config: %O',
      expect.objectContaining({
        highRiskThreshold: 30,
        suspensionThreshold: 10,
      })
    );
  });

  it('merges partial config with defaults', () => {
    initializeAuditLogging({ suspensionThreshold: 25 }, mockNk, mockLogger);

    recordViolation('user1', 'clock_skew');
    expect(isUserSuspended('user1')).toBe(false);
  });
});

describe('recordViolation', () => {
  it('creates a new profile for a new user', () => {
    recordViolation('user1', 'clock_skew');

    const profile = getUserViolationSummary('user1');
    expect(profile).not.toBeNull();
    expect(profile!.userId).toBe('user1');
    expect(profile!.violations).toHaveLength(1);
    expect(profile!.violationCount).toBe(1);
    expect(profile!.isSuspended).toBe(false);
  });

  it('accumulates risk score correctly', () => {
    recordViolation('user1', 'clock_skew');
    recordViolation('user1', 'out_of_turn');

    const profile = getUserViolationSummary('user1');
    expect(profile!.riskScore).toBe(11);
    expect(profile!.violationCount).toBe(2);
  });

  it('auto-suspends when risk score reaches threshold', () => {
    recordViolation('user1', 'out_of_turn');
    expect(isUserSuspended('user1')).toBe(false);

    recordViolation('user1', 'out_of_turn');
    expect(isUserSuspended('user1')).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'User auto-suspended due to high risk score',
      expect.objectContaining({ userId: 'user1' })
    );
  });

  it('stores violation details', () => {
    recordViolation('user1', 'replay_attack', { matchId: 'abc123' });

    const profile = getUserViolationSummary('user1');
    expect(profile!.violations[0].details).toEqual({ matchId: 'abc123' });
  });

  it('persists to storage when enabled', () => {
    recordViolation('user1', 'invalid_signature');
    expect(mockNk.storageWrite).toHaveBeenCalledTimes(1);
    expect(mockNk.storageWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        collection: 'anti_cheat_violations',
        userId: 'user1',
      }),
    ]);
  });

  it('handles storage write failure gracefully', () => {
    mockNk.storageWrite.mockImplementationOnce(() => {
      throw new Error('storage error');
    });

    recordViolation('user1', 'clock_skew');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to persist violation',
      expect.objectContaining({ userId: 'user1' })
    );
  });
});

describe('getUserViolationSummary', () => {
  it('returns profile for known user', () => {
    recordViolation('user1', 'clock_skew');
    const profile = getUserViolationSummary('user1');
    expect(profile).not.toBeNull();
    expect(profile!.userId).toBe('user1');
  });

  it('returns null for unknown user', () => {
    expect(getUserViolationSummary('nonexistent')).toBeNull();
  });
});

describe('getTopViolators', () => {
  it('sorts by risk score descending', () => {
    recordViolation('low_user', 'clock_skew');
    recordViolation('high_user', 'stat_manipulation');
    recordViolation('mid_user', 'replay_attack');

    const violators = getTopViolators();
    expect(violators[0].userId).toBe('high_user');
    expect(violators[1].userId).toBe('mid_user');
    expect(violators[2].userId).toBe('low_user');
  });

  it('respects the limit parameter', () => {
    recordViolation('user1', 'clock_skew');
    recordViolation('user2', 'clock_skew');
    recordViolation('user3', 'clock_skew');

    const violators = getTopViolators(2);
    expect(violators).toHaveLength(2);
  });

  it('defaults to limit of 10', () => {
    for (let i = 0; i < 15; i++) {
      recordViolation(`user${i}`, 'clock_skew');
    }
    const violators = getTopViolators();
    expect(violators).toHaveLength(10);
  });
});

describe('generateAuditReport', () => {
  it('returns null for non-existent user', () => {
    expect(generateAuditReport('nonexistent')).toBeNull();
  });

  it('returns report with risk level low for low score', () => {
    recordViolation('user1', 'clock_skew');

    const result = generateAuditReport('user1');
    expect(result).not.toBeNull();
    expect(result!.report.riskLevel).toBe('low');
    expect(result!.report.recommendedAction).toBe('none');
  });

  it('returns risk level medium for score >= 25', () => {
    initializeAuditLogging({ suspensionThreshold: 100 }, mockNk, mockLogger);
    recordViolation('user1', 'stat_manipulation');

    const result = generateAuditReport('user1');
    expect(result!.report.riskLevel).toBe('medium');
    expect(result!.report.recommendedAction).toBe('monitor');
  });

  it('returns risk level high for score >= highRiskThreshold (50)', () => {
    initializeAuditLogging({ suspensionThreshold: 100 }, mockNk, mockLogger);
    recordViolation('user1', 'stat_manipulation');
    recordViolation('user1', 'stat_manipulation');

    const result = generateAuditReport('user1');
    expect(result!.report.riskLevel).toBe('high');
    expect(result!.report.recommendedAction).toBe('flag');
  });

  it('returns risk level critical for score >= suspensionThreshold (15)', () => {
    recordViolation('user1', 'out_of_turn');
    recordViolation('user1', 'out_of_turn');

    const result = generateAuditReport('user1');
    expect(result!.report.riskLevel).toBe('critical');
    expect(result!.report.recommendedAction).toBe('suspend');
  });

  it('counts violations by severity', () => {
    recordViolation('user1', 'stat_manipulation');
    recordViolation('user1', 'invalid_progression');
    recordViolation('user1', 'timing_attack');
    recordViolation('user1', 'clock_skew');

    const result = generateAuditReport('user1');
    expect(result!.report.criticalViolations).toBe(1);
    expect(result!.report.highViolations).toBe(1);
    expect(result!.report.mediumViolations).toBe(1);
    expect(result!.report.lowViolations).toBe(1);
  });

  it('counts violations by type', () => {
    recordViolation('user1', 'replay_attack');
    recordViolation('user1', 'replay_attack');
    recordViolation('user1', 'clock_skew');

    const result = generateAuditReport('user1');
    expect(result!.report.violationsByType.replay_attack).toBe(2);
    expect(result!.report.violationsByType.clock_skew).toBe(1);
    expect(result!.report.violationsByType.invalid_signature).toBe(0);
  });
});

describe('isUserSuspended', () => {
  it('returns false for unknown user', () => {
    expect(isUserSuspended('nonexistent')).toBe(false);
  });

  it('returns false for user not yet suspended', () => {
    recordViolation('user1', 'clock_skew');
    expect(isUserSuspended('user1')).toBe(false);
  });

  it('returns true after auto-suspension', () => {
    recordViolation('user1', 'stat_manipulation');
    expect(isUserSuspended('user1')).toBe(true);
  });
});

describe('clearUserFlag', () => {
  it('resets score, violations, and suspension', () => {
    recordViolation('user1', 'stat_manipulation');
    expect(isUserSuspended('user1')).toBe(true);

    const result = clearUserFlag('user1');
    expect(result).toBe(true);

    const profile = getUserViolationSummary('user1');
    expect(profile!.riskScore).toBe(0);
    expect(profile!.violations).toHaveLength(0);
    expect(profile!.isSuspended).toBe(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'User flag cleared',
      { userId: 'user1' }
    );
  });

  it('returns false for unknown user', () => {
    expect(clearUserFlag('nonexistent')).toBe(false);
  });
});

describe('suspendUser', () => {
  it('suspends existing user and raises score if needed', () => {
    recordViolation('user1', 'clock_skew');

    const result = suspendUser('user1', 'manual_review');
    expect(result).toBe(true);

    const profile = getUserViolationSummary('user1');
    expect(profile!.isSuspended).toBe(true);
    expect(profile!.riskScore).toBeGreaterThanOrEqual(15);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'User suspended manually',
      { userId: 'user1', reason: 'manual_review' }
    );
  });

  it('creates a suspended profile for new user', () => {
    const result = suspendUser('new_user', 'admin_action');
    expect(result).toBe(true);
    expect(isUserSuspended('new_user')).toBe(true);

    const profile = getUserViolationSummary('new_user');
    expect(profile!.violationCount).toBe(0);
    expect(profile!.isSuspended).toBe(true);
  });

  it('uses default reason when not provided', () => {
    suspendUser('user1');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'User suspended manually',
      { userId: 'user1', reason: 'admin_action' }
    );
  });
});

describe('getAuditStats', () => {
  it('returns correct counts for empty state', () => {
    const stats = getAuditStats();
    expect(stats.totalViolations).toBe(0);
    expect(stats.uniqueUsers).toBe(0);
    expect(stats.suspendedUsers).toBe(0);
    expect(stats.highRiskUsers).toBe(0);
  });

  it('returns correct counts with multiple users', () => {
    initializeAuditLogging({ suspensionThreshold: 30 }, mockNk, mockLogger);
    recordViolation('user1', 'clock_skew');
    recordViolation('user2', 'stat_manipulation');
    recordViolation('user2', 'replay_attack');
    recordViolation('user3', 'replay_attack');

    const stats = getAuditStats();
    expect(stats.totalViolations).toBe(4);
    expect(stats.uniqueUsers).toBe(3);
    expect(stats.suspendedUsers).toBe(1);
  });

  it('counts high risk users correctly', () => {
    recordViolation('user1', 'stat_manipulation');
    recordViolation('user1', 'stat_manipulation');

    const stats = getAuditStats();
    expect(stats.highRiskUsers).toBe(1);
  });

  it('counts violations by type', () => {
    recordViolation('user1', 'replay_attack');
    recordViolation('user1', 'clock_skew');
    recordViolation('user2', 'replay_attack');

    const stats = getAuditStats();
    expect(stats.violationsByType.replay_attack).toBe(2);
    expect(stats.violationsByType.clock_skew).toBe(1);
    expect(stats.violationsByType.invalid_signature).toBe(0);
  });
});

describe('resetAuditState', () => {
  it('clears all data', () => {
    recordViolation('user1', 'stat_manipulation');
    recordViolation('user2', 'clock_skew');

    resetAuditState();

    expect(getUserViolationSummary('user1')).toBeNull();
    expect(getUserViolationSummary('user2')).toBeNull();
    expect(getAuditStats().totalViolations).toBe(0);
    expect(getAuditStats().uniqueUsers).toBe(0);
  });

  it('resets config to defaults', () => {
    initializeAuditLogging({ suspensionThreshold: 5 }, mockNk, mockLogger);
    resetAuditState();
    initializeAuditLogging({}, mockNk, mockLogger);

    recordViolation('user1', 'stat_manipulation');
    expect(isUserSuspended('user1')).toBe(true);
  });
});

describe('violation severity mapping', () => {
  const cases: Array<[ViolationType, string]> = [
    ['stat_manipulation', 'critical'],
    ['replay_attack', 'critical'],
    ['inventory_tampering', 'critical'],
    ['invalid_signature', 'high'],
    ['invalid_progression', 'high'],
    ['timing_attack', 'medium'],
    ['out_of_turn', 'low'],
    ['clock_skew', 'low'],
  ];

  it.each(cases)('maps %s to severity %s', (type, expectedSeverity) => {
    recordViolation('user1', type);
    const profile = getUserViolationSummary('user1');
    expect(profile!.violations[0].severity).toBe(expectedSeverity);
  });
});
