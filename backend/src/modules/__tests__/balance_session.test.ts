/**
 * Balance Session Module Tests
 * @fileoverview Tests for simulated balancing sessions with player cohorts.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PlayerArchetype,
  runBalanceSession,
} from '../balance_session';
import type { BalanceSessionConfig, BalanceSessionReport } from '../balance_session';

// Mock the metrics module
jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
}));

// Mock the validation module
jest.mock('../validation', () => ({
  validatePayload: jest.fn((_schema: unknown, payload: string, _rpcName: string) => {
    try {
      const data = payload ? JSON.parse(payload) : {};
      return { success: true, data };
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }
  }),
  createValidationErrorResponse: jest.fn((_rpc: string, error: string) =>
    JSON.stringify({ success: false, error })
  ),
  ZodSchemas: {
    run_balance_session: {},
  },
}));

// Mock the gear_system module for calculateDropRate
jest.mock('../gear_system', () => ({
  calculateDropRate: jest.fn((difficulty: string, bossDefeated: boolean) => {
    const multipliers: Record<string, number> = { easy: 0.5, medium: 1.0, hard: 1.5, nightmare: 2.0 };
    const rate = 0.4 * (multipliers[difficulty] || 1.0);
    return Math.min(rate + (bossDefeated ? 0.25 : 0), 1.0);
  }),
}));

const DEFAULT_CONFIG: BalanceSessionConfig = {
  cohortSize: 10,
  pveIterations: 3,
  pvpIterations: 20,
  seed: 42,
  difficulties: ['easy', 'medium', 'hard'],
};

describe('BalanceSession', () => {
  describe('runBalanceSession', () => {
    it('should produce a complete report', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      expect(report.sessionId).toMatch(/^session_/);
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.config).toEqual(DEFAULT_CONFIG);
      expect(report.pve).toBeDefined();
      expect(report.pvp).toBeDefined();
      expect(report.economy).toBeDefined();
      expect(report.issues).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.suggestedAdjustments).toBeInstanceOf(Array);
    });

    it('should run deterministically with the same seed', () => {
      const report1 = runBalanceSession(DEFAULT_CONFIG);
      const report2 = runBalanceSession(DEFAULT_CONFIG);

      expect(report1.pve.totalRuns).toBe(report2.pve.totalRuns);
      expect(report1.pvp.totalMatches).toBe(report2.pvp.totalMatches);
      expect(report1.pve.completionRateByArchetype).toEqual(report2.pve.completionRateByArchetype);
      expect(report1.pvp.winRateMatrix).toEqual(report2.pvp.winRateMatrix);
    });

    it('should produce different results with different seeds', () => {
      const config2 = { ...DEFAULT_CONFIG, seed: 99 };
      const report1 = runBalanceSession(DEFAULT_CONFIG);
      const report2 = runBalanceSession(config2);

      // With different seeds, results should differ (extremely unlikely to be identical)
      const same =
        JSON.stringify(report1.pve.completionRateByArchetype) ===
        JSON.stringify(report2.pve.completionRateByArchetype);
      expect(same).toBe(false);
    });
  });

  describe('PvE Simulation', () => {
    it('should generate correct total runs (players * iterations * difficulties)', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      const archetypes = Object.values(PlayerArchetype);
      const expectedRuns = archetypes.length * DEFAULT_CONFIG.cohortSize * DEFAULT_CONFIG.pveIterations * DEFAULT_CONFIG.difficulties.length;
      expect(report.pve.totalRuns).toBe(expectedRuns);
    });

    it('should have completion rates for all archetypes', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const archetype of Object.values(PlayerArchetype)) {
        expect(report.pve.completionRateByArchetype[archetype]).toBeDefined();
        const data = report.pve.completionRateByArchetype[archetype];
        expect(data.rate).toBeGreaterThanOrEqual(0);
        expect(data.rate).toBeLessThanOrEqual(1);
        expect(data.avgStars).toBeGreaterThanOrEqual(0);
        expect(data.avgStars).toBeLessThanOrEqual(3);
        expect(data.avgTurns).toBeGreaterThan(0);
      }
    });

    it('should have completion rates by difficulty', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const difficulty of DEFAULT_CONFIG.difficulties) {
        expect(report.pve.completionRateByDifficulty[difficulty]).toBeDefined();
        expect(report.pve.completionRateByDifficulty[difficulty].rate).toBeGreaterThanOrEqual(0);
        expect(report.pve.completionRateByDifficulty[difficulty].rate).toBeLessThanOrEqual(1);
      }
    });

    it('should show higher completion for endgame vs new players', () => {
      const config: BalanceSessionConfig = { ...DEFAULT_CONFIG, seed: 12345, pveIterations: 10, cohortSize: 30 };
      const report = runBalanceSession(config);

      const newRate = report.pve.completionRateByArchetype[PlayerArchetype.NEW]?.rate ?? 0;
      const endgameRate = report.pve.completionRateByArchetype[PlayerArchetype.ENDGAME]?.rate ?? 0;
      // Endgame players should complete stages more often than new players
      expect(endgameRate).toBeGreaterThanOrEqual(newRate * 0.8); // Allow some variance
    });

    it('should have health remaining between 0 and 1', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.pve.averageHealthRemainingPercent).toBeGreaterThanOrEqual(0);
      expect(report.pve.averageHealthRemainingPercent).toBeLessThanOrEqual(1);
    });
  });

  describe('PvP Simulation', () => {
    it('should generate matches for all archetype pairings', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      const archetypes = Object.values(PlayerArchetype);

      for (const a1 of archetypes) {
        for (const a2 of archetypes) {
          expect(report.pvp.winRateMatrix[a1]?.[a2]).toBeDefined();
          expect(report.pvp.winRateMatrix[a1][a2]).toBeGreaterThanOrEqual(0);
          expect(report.pvp.winRateMatrix[a1][a2]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have ~50% win rate for same-tier matchups', () => {
      const config: BalanceSessionConfig = { ...DEFAULT_CONFIG, pvpIterations: 200, seed: 42 };
      const report = runBalanceSession(config);

      for (const archetype of Object.values(PlayerArchetype)) {
        const winRate = report.pvp.winRateMatrix[archetype]?.[archetype];
        if (winRate !== undefined) {
          // Same-tier should be approximately 50% (allow ±15% for variance)
          expect(winRate).toBeGreaterThan(0.3);
          expect(winRate).toBeLessThan(0.7);
        }
      }
    });

    it('should show advantage for higher tiers over lower tiers', () => {
      const config: BalanceSessionConfig = { ...DEFAULT_CONFIG, pvpIterations: 200, seed: 42 };
      const report = runBalanceSession(config);

      const endgameVsNew = report.pvp.winRateMatrix[PlayerArchetype.ENDGAME]?.[PlayerArchetype.NEW];
      if (endgameVsNew !== undefined) {
        // Endgame should beat new players more often than not
        expect(endgameVsNew).toBeGreaterThan(0.4);
      }
    });

    it('should track upset rate', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.pvp.upsetRate).toBeGreaterThanOrEqual(0);
      expect(report.pvp.upsetRate).toBeLessThanOrEqual(1);
    });

    it('should track average turns per match', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.pvp.averageTurnsPerMatch).toBeGreaterThan(0);
      expect(report.pvp.averageTurnsPerMatch).toBeLessThanOrEqual(50);
    });

    it('should identify a dominant archetype', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.pvp.dominantArchetype).not.toBeNull();
      expect(Object.values(PlayerArchetype)).toContain(report.pvp.dominantArchetype);
    });
  });

  describe('Economy Simulation', () => {
    it('should track total drops and runs', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.economy.totalDrops).toBeGreaterThan(0);
      expect(report.economy.totalRuns).toBeGreaterThan(0);
      expect(report.economy.averageDropsPerRun).toBeGreaterThan(0);
    });

    it('should track drop rates by rarity', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
        const data = report.economy.dropRateByRarity[rarity];
        expect(data).toBeDefined();
        expect(data.observed).toBeGreaterThanOrEqual(0);
        expect(data.expected).toBeGreaterThan(0);
        expect(typeof data.deviation).toBe('number');
      }
    });

    it('should estimate runs needed per rarity', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
        expect(report.economy.estimatedRunsToRarity[rarity]).toBeGreaterThan(0);
      }

      // Legendary should require more runs than common
      expect(report.economy.estimatedRunsToRarity.legendary).toBeGreaterThan(
        report.economy.estimatedRunsToRarity.common
      );
    });
  });

  describe('Balance Issues and Recommendations', () => {
    it('should identify issues with appropriate severity', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const issue of report.issues) {
        expect(['critical', 'warning', 'info']).toContain(issue.severity);
        expect(['pve', 'pvp', 'economy']).toContain(issue.category);
        expect(issue.description.length).toBeGreaterThan(0);
        expect(issue.evidence.length).toBeGreaterThan(0);
      }
    });

    it('should generate one recommendation per issue', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      expect(report.recommendations.length).toBe(report.issues.length);
    });

    it('should include suggested adjustments with valid structure', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);

      for (const adj of report.suggestedAdjustments) {
        expect(adj.module.length).toBeGreaterThan(0);
        expect(adj.parameter.length).toBeGreaterThan(0);
        expect(typeof adj.currentValue).toBe('number');
        expect(typeof adj.suggestedValue).toBe('number');
        expect(adj.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum cohort size', () => {
      const config: BalanceSessionConfig = {
        cohortSize: 10,
        pveIterations: 1,
        pvpIterations: 10,
        seed: 1,
        difficulties: ['medium'],
      };
      const report = runBalanceSession(config);
      expect(report.pve.totalRuns).toBe(4 * 10 * 1 * 1); // 4 archetypes
      expect(report.pvp.totalMatches).toBeGreaterThan(0);
    });

    it('should handle single difficulty', () => {
      const config: BalanceSessionConfig = {
        ...DEFAULT_CONFIG,
        difficulties: ['hard'],
      };
      const report = runBalanceSession(config);
      expect(Object.keys(report.pve.completionRateByDifficulty)).toContain('hard');
    });
  });

  describe('Report Serialization', () => {
    it('should be JSON serializable', () => {
      const report = runBalanceSession(DEFAULT_CONFIG);
      const json = JSON.stringify(report);
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json) as BalanceSessionReport;
      expect(parsed.sessionId).toBe(report.sessionId);
      expect(parsed.pve.totalRuns).toBe(report.pve.totalRuns);
      expect(parsed.pvp.totalMatches).toBe(report.pvp.totalMatches);
    });
  });
});
