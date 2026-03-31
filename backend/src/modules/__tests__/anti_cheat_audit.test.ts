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
  AuditConfig,
} from '../anti_cheat_audit';

describe('anti_cheat_audit', () => {
  const mockNakama = {
    storageWrite: jest.fn().mockResolvedValue([]),
  } as any;

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuditState();
    initializeAuditLogging({}, mockNakama, mockLogger);
  });

  describe('initializeAuditLogging', () => {
    it('should initialize with default config', () => {
      initializeAuditLogging({}, mockNakama, mockLogger);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should initialize with custom config', () => {
      const config: Partial<AuditConfig> = {
        highRiskThreshold: 100,
        suspensionThreshold: 50,
      };
      initializeAuditLogging(config, mockNakama, mockLogger);
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('recordViolation', () => {
    it('should record a new violation for a user', () => {
      recordViolation('user1', 'replay_attack', { extra: 'data' });
      const summary = getUserViolationSummary('user1');
      expect(summary).not.toBeNull();
      expect(summary?.violationCount).toBe(1);
      expect(summary?.violations[0].type).toBe('replay_attack');
    });

    it('should add multiple violations', () => {
      recordViolation('user1', 'replay_attack');
      recordViolation('user1', 'timing_attack');
      recordViolation('user1', 'clock_skew');
      const summary = getUserViolationSummary('user1');
      expect(summary?.violationCount).toBe(3);
    });

    it('should calculate risk score based on violation type', () => {
      recordViolation('user1', 'stat_manipulation');
      const summary = getUserViolationSummary('user1');
      expect(summary?.riskScore).toBe(25);
    });

    it('should auto-suspend user when risk score exceeds threshold', () => {
      initializeAuditLogging({ suspensionThreshold: 15 }, mockNakama, mockLogger);
      recordViolation('user1', 'stat_manipulation');
      recordViolation('user1', 'invalid_signature');
      const summary = getUserViolationSummary('user1');
      expect(summary?.isSuspended).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should persist violation if enabled', () => {
      initializeAuditLogging({ enablePersistence: true }, mockNakama, mockLogger);
      recordViolation('user1', 'replay_attack');
      expect(mockNakama.storageWrite).toHaveBeenCalled();
    });
  });

  describe('getUserViolationSummary', () => {
    it('should return null for non-existent user', () => {
      const summary = getUserViolationSummary('nonexistent');
      expect(summary).toBeNull();
    });

    it('should return user profile for existing user', () => {
      recordViolation('testuser', 'replay_attack');
      const summary = getUserViolationSummary('testuser');
      expect(summary).not.toBeNull();
      expect(summary?.userId).toBe('testuser');
    });
  });

  describe('getTopViolators', () => {
    it('should return array', () => {
      const topViolators = getTopViolators(10);
      expect(topViolators).toBeInstanceOf(Array);
    });
  });

  describe('generateAuditReport', () => {
    it('should return null for non-existent user', () => {
      const report = generateAuditReport('nonexistent');
      expect(report).toBeNull();
    });

    it('should generate comprehensive report', () => {
      recordViolation('user1', 'stat_manipulation');
      recordViolation('user1', 'replay_attack');
      recordViolation('user1', 'clock_skew');
      const report = generateAuditReport('user1');
      expect(report).not.toBeNull();
      expect(report?.report.totalViolations).toBe(3);
    });

    it('should recommend suspend for critical risk', () => {
      initializeAuditLogging({ suspensionThreshold: 30 }, mockNakama, mockLogger);
      recordViolation('user1', 'stat_manipulation');
      recordViolation('user1', 'stat_manipulation');
      const report = generateAuditReport('user1');
      expect(report?.report.riskLevel).toBe('critical');
      expect(report?.report.recommendedAction).toBe('suspend');
    });
  });

  describe('isUserSuspended', () => {
    it('should return false for non-suspended user', () => {
      recordViolation('user1', 'clock_skew');
      expect(isUserSuspended('user1')).toBe(false);
    });

    it('should return false for non-existent user', () => {
      expect(isUserSuspended('nonexistent')).toBe(false);
    });
  });

  describe('clearUserFlag', () => {
    it('should return false for non-existent user', () => {
      const result = clearUserFlag('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('suspendUser', () => {
    it('should suspend a new user', () => {
      const result = suspendUser('newuser', 'test reason');
      expect(result).toBe(true);
      expect(isUserSuspended('newuser')).toBe(true);
    });
  });

  describe('getAuditStats', () => {
    it('should return stats object', () => {
      const stats = getAuditStats();
      expect(stats).toBeDefined();
      expect(stats.totalViolations).toBeDefined();
    });
  });
});
