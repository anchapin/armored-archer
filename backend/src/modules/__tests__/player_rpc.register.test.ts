import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  registerRpcHealthCheck,
  registerRpcGetPlayerStats,
  registerRpcReportPlayer,
  registerRpcGetPlayerReports,
} from '../player_rpc';
import { Runtime } from '../../types/nakama';

jest.mock('../anti_cheat', () => ({
  submitPlayerReport: jest.fn(),
  getReportsForUser: jest.fn(),
}));

jest.mock('../../utils/player-data-helpers', () => ({
  getPlayerStatsWithCache: jest.fn().mockReturnValue(JSON.stringify({ level: 1, xp: 0 })),
}));

jest.mock('../../index', () => ({
  getStructuredLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockRegisterRpcWithMetrics = jest.fn();
jest.mock('../metrics', () => ({
  registerRpcWithMetrics: (...args: unknown[]) => mockRegisterRpcWithMetrics(...args),
}));

describe('player_rpc register functions', () => {
  let mockInitializer: Runtime.Initializer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializer = {} as Runtime.Initializer;
  });

  describe('registerRpcHealthCheck', () => {
    it('should register health check RPC with correct parameters', () => {
      registerRpcHealthCheck(mockInitializer);

      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledTimes(1);
      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/health_check',
        'health_check',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGetPlayerStats', () => {
    it('should register get player stats RPC with correct parameters', () => {
      registerRpcGetPlayerStats(mockInitializer);

      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledTimes(1);
      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/get_player_stats',
        'get_player_stats',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcReportPlayer', () => {
    it('should register report player RPC with correct parameters', () => {
      registerRpcReportPlayer(mockInitializer);

      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledTimes(1);
      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/report_player',
        'report_player',
        expect.any(Function)
      );
    });
  });

  describe('registerRpcGetPlayerReports', () => {
    it('should register get player reports RPC with correct parameters', () => {
      registerRpcGetPlayerReports(mockInitializer);

      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledTimes(1);
      expect(mockRegisterRpcWithMetrics).toHaveBeenCalledWith(
        mockInitializer,
        'armored_archer/get_player_reports',
        'get_player_reports',
        expect.any(Function)
      );
    });
  });
});
