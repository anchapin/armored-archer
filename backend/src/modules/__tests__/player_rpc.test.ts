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

jest.mock('../anti_cheat', () => ({
  submitPlayerReport: jest.fn(),
  getReportsForUser: jest.fn(),
}));

jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
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

    it('should return reports for specified user_id', () => {
      getReportsForUser.mockReturnValue([
        { reportId: 'r2', reporterId: 'admin', reason: 'cheating' },
      ]);

      // Mock validatePayload to return data with user_id (Valibot strips unknown keys)
      const validation = require('../validation');
      const originalValidate = validation.validatePayload;
      validation.validatePayload = jest.fn().mockReturnValue({
        success: true,
        data: { user_id: 'target-user' },
      });

      const payload = JSON.stringify({ user_id: 'target-user' });
      const result = rpcGetPlayerReports(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.reports).toHaveLength(1);
      expect(getReportsForUser).toHaveBeenCalledWith('target-user');

      validation.validatePayload = originalValidate;
    });
  });
});
