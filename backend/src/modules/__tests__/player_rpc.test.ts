import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcHealthCheck,
  rpcGetPlayerStats,
  rpcReportPlayer,
  rpcGetPlayerReports,
} from '../player_rpc';
import { Runtime } from '../../types/nakama';
import { PlayerStats } from '../../types/game';
import { initializeCaches } from '../../utils/cache';
import { resetAdminAllowlistCache } from '../admin_auth';

jest.mock('../anti_cheat', () => ({
  submitPlayerReport: jest.fn(),
  getReportsForUser: jest.fn(),
}));

jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
}));

// Mock the audit module so player_rpc can call logAudit without pulling in
// the real audit/admin_auth module graph (which would create a circular
// import during test bootstrap). The mock mirrors the production
// logAudit signature so the handler can be called directly.
jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../index', () => ({
  getStructuredLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../health_monitor', () => ({
  getHealthStatus: jest.fn().mockReturnValue({
    healthy: true,
    metrics: { cpuUsage: 10, memoryUsage: 50, diskUsage: 25, dbConnections: 5 },
    isMonitoring: false,
  }),
}));

const { submitPlayerReport, getReportsForUser } = jest.requireMock('../anti_cheat');
const { logAudit } = jest.requireMock('../audit') as { logAudit: jest.Mock };

describe('player_rpc', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
    initializeCaches(mockLogger);
  });

  describe('rpcHealthCheck', () => {
    it('should return healthy status', () => {
      const payload = JSON.stringify({});
      const result = rpcHealthCheck(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('ok');
      expect(parsed.version).toBe('0.1.0');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should accept empty payload', () => {
      const payload = '';
      const result = rpcHealthCheck(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('ok');
    });
  });

  describe('rpcGetPlayerStats', () => {
    it('should return player stats from storage', () => {
      const stats: PlayerStats = {
        level: 10,
        xp: 1500,
        stats: { attack: 25, defense: 20, dodge: 15, crit_rate: 12 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user',
          value: JSON.stringify(stats),
        },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.level).toBe(10);
      expect(parsed.xp).toBe(1500);
      expect(parsed.stats.attack).toBe(25);
    });

    it('should return error when player stats not found', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Player stats not found');
    });

    it('should cache player stats', () => {
      const stats: PlayerStats = {
        level: 5,
        xp: 500,
        stats: { attack: 15, defense: 12, dodge: 10, crit_rate: 8 },
      };

      mockNk.storageRead = jest.fn().mockReturnValue([
        {
          collection: 'player_stats',
          key: 'test-user',
          value: JSON.stringify(stats),
        },
      ]);

      const payload = JSON.stringify({});
      rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);
      rpcGetPlayerStats(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.storageRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('rpcReportPlayer', () => {
    it('should return validation error for invalid payload', () => {
      const payload = JSON.stringify({});
      const result = rpcReportPlayer(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for invalid JSON', () => {
      const payload = 'not-json';
      const result = rpcReportPlayer(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return success when report is submitted', () => {
      submitPlayerReport.mockReturnValue({ success: true, reportId: 'report-123' });

      const payload = JSON.stringify({
        reported_user_id: 'other-user',
        reason: 'harassment',
      });
      const result = rpcReportPlayer(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.report_id).toBe('report-123');
    });

    it('should return error when report submission fails', () => {
      submitPlayerReport.mockReturnValue({ success: false, error: 'Cannot report yourself' });

      const payload = JSON.stringify({
        reported_user_id: 'other-user',
        reason: 'harassment',
      });
      const result = rpcReportPlayer(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Cannot report yourself');
    });

    it('should pass optional fields to submitPlayerReport', () => {
      submitPlayerReport.mockReturnValue({ success: true, reportId: 'r-1' });

      const payload = JSON.stringify({
        reported_user_id: 'other-user',
        reason: 'win_trading',
        match_id: 'match-42',
        additional_info: 'They kept disconnecting',
      });
      rpcReportPlayer(mockCtx, mockLogger, mockNk, payload);

      expect(submitPlayerReport).toHaveBeenCalledWith(
        'test-user',
        'other-user',
        'win_trading',
        'match-42',
        'They kept disconnecting'
      );
    });
  });

  describe('rpcGetPlayerReports', () => {
    it('should return validation error for invalid JSON', () => {
      const payload = 'not-valid-json{{{';
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should return reports for current user when no user_id provided', () => {
      getReportsForUser.mockReturnValue([
        { reportId: 'r1', reporterId: 'test-user', reason: 'harassment' },
      ]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reports).toHaveLength(1);
      expect(getReportsForUser).toHaveBeenCalledWith('test-user');
    });

    it('should return empty reports array', () => {
      getReportsForUser.mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reports).toEqual([]);
    });

    // Regression test for issue #1150: rpcGetPlayerReports previously accepted
    // an arbitrary `user_id` in the payload and returned that user's moderation
    // reports to any authenticated session, leaking reporter identities,
    // match IDs, and free-text reasons. The handler now binds the lookup to
    // ctx.userId and rejects cross-user probes with FORBIDDEN + audit log.
    it('should accept an explicit self user_id and look up ctx.userId (#1150)', () => {
      getReportsForUser.mockReturnValue([
        { reportId: 'r-self', reporterId: 'test-user', reason: 'cheating' },
      ]);

      const payload = JSON.stringify({ user_id: 'test-user' });
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reports).toHaveLength(1);
      expect(getReportsForUser).toHaveBeenCalledWith('test-user');
      expect(logAudit).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should reject a cross-user probe with FORBIDDEN and audit log the attempt (#1150)', () => {
      const payload = JSON.stringify({ user_id: 'victim-user' });
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      // The probe must be rejected with a generic message that does not leak
      // any information about the victim's reports.
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Forbidden');
      expect(parsed.error_code).toBe('FORBIDDEN');
      expect(parsed.rpc_name).toBe('get_player_reports');
      expect(parsed.reports).toBeUndefined();
      expect(parsed.total).toBeUndefined();

      // The victim's storage is never read.
      expect(getReportsForUser).not.toHaveBeenCalled();
      expect(getReportsForUser).not.toHaveBeenCalledWith('victim-user');

      // The attempt must be audit-logged against the caller for security
      // monitoring — the victim's id is recorded in the details so operators
      // can correlate, but never echoed to the client.
      expect(logAudit).toHaveBeenCalledTimes(1);
      const auditArgs = (logAudit as jest.Mock).mock.calls[0];
      expect(auditArgs[0]).toBe(mockNk);
      expect(auditArgs[1]).toBe('test-user');
      expect(auditArgs[3]).toBe('get_player_reports');
      expect(auditArgs[4]).toBe('player_reports');
      expect(auditArgs[6]).toBe('failure');
      expect(auditArgs[7]).toContain('does not match');
      const details = auditArgs[5] as Record<string, unknown>;
      expect(details.requested_user_id).toBe('victim-user');
      expect(details.reason).toBe('cross_user_probe');

      // The response must not echo the victim or any internals.
      expect(result).not.toContain('victim-user');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('test-user')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('victim-user')
      );
    });

    it('should allow an allowlisted admin to query another user\'s reports (#1150, #1075)', () => {
      const previousAdminIds = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = '00000000-0000-4000-8000-000000000005';
      // isAdminUser caches the parsed allowlist (issue #1155), so the cache
      // must be reset after mutating ADMIN_USER_IDS for the guard to see it.
      resetAdminAllowlistCache();
      const adminCtx = createMockContext({ userId: '00000000-0000-4000-8000-000000000005' });

      getReportsForUser.mockReturnValue([
        { reportId: 'r-victim', reporterId: 'victim-user', reason: 'win_trading' },
      ]);

      const payload = JSON.stringify({ user_id: 'victim-user' });
      const result = rpcGetPlayerReports(adminCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reports).toHaveLength(1);
      expect(getReportsForUser).toHaveBeenCalledWith('victim-user');
      expect(logAudit).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();

      if (previousAdminIds === undefined) {
        delete process.env.ADMIN_USER_IDS;
      } else {
        process.env.ADMIN_USER_IDS = previousAdminIds;
      }
      resetAdminAllowlistCache();
    });
  });
});
