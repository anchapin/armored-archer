/**
 * Balance Analytics Module Tests
 * @fileoverview Tests for drop distribution and stage completion analytics
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  recordDrop,
  recordStageAttempt,
  calculateDropStatistics,
  calculateStageCompletionStatistics,
  generateBalanceInsights,
  getRecentDrops,
  getRecentStageAttempts,
  clearAnalyticsStorage,
  rpcRecordDrop,
  rpcRecordStageAttempt,
  rpcGetDropStatistics,
  rpcGetStageCompletionStatistics,
  rpcGetBalanceInsights,
} from '../balance_analytics';
import { mockNakama, mockContext, mockLogger } from '../../__mocks__/nakama';

// Mock the audit module
jest.mock('../audit', () => ({
  logAudit: jest.fn(),
}));

// Mock the metrics module
jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn((initializer, id, name, handler) => {
    initializer.registerRpc(id, handler);
  }),
}));

// Mock the validation module
jest.mock('../validation', () => ({
  validatePayload: jest.fn((schema, payload, rpcName) => {
    try {
      const data = payload ? JSON.parse(payload) : {};
      return { success: true, data };
    } catch (e) {
      return { success: false, error: 'Invalid JSON' };
    }
  }),
  ZodSchemas: {
    record_drop: {},
    record_stage_attempt: {},
    get_balance_statistics: {},
  },
  createValidationErrorResponse: jest.fn((rpcName, error) => {
    return JSON.stringify({ success: false, error, error_code: 'VALIDATION_ERROR', rpc_name: rpcName });
  }),
}));

describe('Balance Analytics Module', () => {
  beforeEach(() => {
    clearAnalyticsStorage();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearAnalyticsStorage();
  });

  describe('Drop Recording', () => {
    it('should record a drop successfully', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      const dropData = {
        userId: 'user123',
        timestamp: Date.now(),
        stageId: '1_1',
        stagePrefix: 'campaign_1',
        difficulty: 'medium',
        bossDefeated: false,
        gearRarity: 'rare',
        gearType: 'bow',
        gearId: 'bow_crossbow_rare_123',
        dropRateUsed: 0.35,
        rollValue: 0.25,
      };

      await recordDrop(nk, dropData);

      const drops = getRecentDrops();
      expect(drops).toHaveLength(1);
      expect(drops[0]).toMatchObject({
        userId: 'user123',
        stageId: '1_1',
        gearRarity: 'rare',
        gearType: 'bow',
      });
      expect(nk.storageWrite).toHaveBeenCalled();
    });

    it('should limit in-memory storage to MAX_RECENT_DROPS', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      // Record more drops than the limit
      for (let i = 0; i < 100001; i++) {
        await recordDrop(nk, {
          userId: `user${i}`,
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'common',
          gearType: 'helm',
          gearId: `helm_${i}`,
          dropRateUsed: 0.6,
          rollValue: 0.3,
        });
      }

      const drops = getRecentDrops();
      expect(drops.length).toBeLessThanOrEqual(100000);
    });
  });

  describe('Stage Attempt Recording', () => {
    it('should record a stage attempt successfully', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      const attemptData = {
        userId: 'user123',
        timestamp: Date.now(),
        stageId: '1_1',
        stagePrefix: 'campaign_1',
        difficulty: 'medium',
        bossDefeated: false,
        completed: true,
        starsEarned: 3,
        score: 1500,
        attemptNumber: 1,
      };

      await recordStageAttempt(nk, attemptData);

      const attempts = getRecentStageAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        userId: 'user123',
        stageId: '1_1',
        completed: true,
        starsEarned: 3,
        score: 1500,
      });
      expect(nk.storageWrite).toHaveBeenCalled();
    });

    it('should record failed stage attempts', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      await recordStageAttempt(nk, {
        userId: 'user123',
        timestamp: Date.now(),
        stageId: '1_2',
        stagePrefix: 'campaign_1',
        difficulty: 'hard',
        bossDefeated: true,
        completed: false,
        starsEarned: 0,
        score: 0,
        attemptNumber: 3,
      });

      const attempts = getRecentStageAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0].completed).toBe(false);
      expect(attempts[0].bossDefeated).toBe(true);
    });
  });

  describe('Drop Statistics Calculation', () => {
    beforeEach(async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      // Record some sample drops
      const sampleDrops = [
        { rarity: 'common', type: 'helm', stage: '1_1', difficulty: 'easy', boss: false },
        { rarity: 'common', type: 'armor', stage: '1_1', difficulty: 'easy', boss: false },
        { rarity: 'common', type: 'bow', stage: '1_2', difficulty: 'medium', boss: false },
        { rarity: 'rare', type: 'arrow', stage: '1_2', difficulty: 'medium', boss: false },
        { rarity: 'rare', type: 'amulet', stage: '2_1', difficulty: 'hard', boss: true },
        { rarity: 'epic', type: 'bow', stage: '2_1', difficulty: 'hard', boss: true },
        { rarity: 'common', type: 'helm', stage: '2_2', difficulty: 'hard', boss: false },
        { rarity: 'rare', type: 'armor', stage: '2_2', difficulty: 'hard', boss: false },
        { rarity: 'common', type: 'arrow', stage: '1_1', difficulty: 'easy', boss: false },
        { rarity: 'common', type: 'amulet', stage: '1_2', difficulty: 'medium', boss: false },
      ];

      for (const drop of sampleDrops) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: drop.stage,
          stagePrefix: `campaign_${drop.stage.split('_')[0]}`,
          difficulty: drop.difficulty,
          bossDefeated: drop.boss,
          gearRarity: drop.rarity,
          gearType: drop.type,
          gearId: `${drop.type}_${drop.rarity}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }
    });

    it('should calculate drop statistics correctly', () => {
      const stats = calculateDropStatistics();

      expect(stats.totalDrops).toBe(10);
      expect(stats.byRarity.common.count).toBe(6);
      expect(stats.byRarity.rare.count).toBe(3);
      expect(stats.byRarity.epic.count).toBe(1);
      expect(stats.byRarity.legendary.count).toBe(0);
    });

    it('should calculate rarity percentages', () => {
      const stats = calculateDropStatistics();

      expect(stats.byRarity.common.percentage).toBe(60);
      expect(stats.byRarity.rare.percentage).toBe(30);
      expect(stats.byRarity.epic.percentage).toBe(10);
    });

    it('should calculate rarity deviations', () => {
      const stats = calculateDropStatistics();

      // Expected rates: common 60%, rare 25%, epic 10%, legendary 5%
      expect(stats.byRarity.common.deviation).toBeCloseTo(0, 1); // 60% expected, 60% actual
      expect(stats.byRarity.rare.deviation).toBeCloseTo(5, 1); // 25% expected, 30% actual
      expect(stats.byRarity.epic.deviation).toBeCloseTo(0, 1); // 10% expected, 10% actual
    });

    it('should group drops by difficulty', () => {
      const stats = calculateDropStatistics();

      expect(stats.byDifficulty.easy).toBeDefined();
      expect(stats.byDifficulty.easy.drops).toBe(3);
      expect(stats.byDifficulty.medium).toBeDefined();
      expect(stats.byDifficulty.medium.drops).toBe(3);
      expect(stats.byDifficulty.hard).toBeDefined();
      expect(stats.byDifficulty.hard.drops).toBe(4);
    });

    it('should track boss bonus drops', () => {
      const stats = calculateDropStatistics();

      expect(stats.bossBonusDrops.attempts).toBe(2);
      expect(stats.bossBonusDrops.drops).toBe(2);
      expect(stats.bossBonusDrops.dropRate).toBe(1);
    });

    it('should group drops by stage', () => {
      const stats = calculateDropStatistics();

      expect(stats.byStage['1_1']).toBeDefined();
      expect(stats.byStage['1_1'].drops).toBe(3);
      expect(stats.byStage['1_2']).toBeDefined();
      expect(stats.byStage['1_2'].drops).toBe(3);
      expect(stats.byStage['2_1']).toBeDefined();
      expect(stats.byStage['2_1'].drops).toBe(2);
      expect(stats.byStage['2_2']).toBeDefined();
      expect(stats.byStage['2_2'].drops).toBe(2);
    });
  });

  describe('Stage Completion Statistics Calculation', () => {
    beforeEach(async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      // Record some sample stage attempts
      const sampleAttempts = [
        { stage: '1_1', prefix: 'campaign_1', difficulty: 'easy', boss: false, completed: true, stars: 3, score: 1500 },
        { stage: '1_1', prefix: 'campaign_1', difficulty: 'easy', boss: false, completed: true, stars: 2, score: 1200 },
        { stage: '1_1', prefix: 'campaign_1', difficulty: 'easy', boss: false, completed: false, stars: 0, score: 0 },
        { stage: '1_2', prefix: 'campaign_1', difficulty: 'medium', boss: false, completed: true, stars: 3, score: 1800 },
        { stage: '1_2', prefix: 'campaign_1', difficulty: 'medium', boss: false, completed: false, stars: 0, score: 0 },
        { stage: '1_2', prefix: 'campaign_1', difficulty: 'medium', boss: false, completed: true, stars: 1, score: 800 },
        { stage: '2_1', prefix: 'campaign_2', difficulty: 'hard', boss: true, completed: true, stars: 3, score: 2500 },
        { stage: '2_1', prefix: 'campaign_2', difficulty: 'hard', boss: true, completed: false, stars: 0, score: 0 },
        { stage: '2_2', prefix: 'campaign_2', difficulty: 'hard', boss: false, completed: false, stars: 0, score: 0 },
        { stage: '2_2', prefix: 'campaign_2', difficulty: 'hard', boss: false, completed: false, stars: 0, score: 0 },
      ];

      for (let i = 0; i < sampleAttempts.length; i++) {
        await recordStageAttempt(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: sampleAttempts[i].stage,
          stagePrefix: sampleAttempts[i].prefix,
          difficulty: sampleAttempts[i].difficulty,
          bossDefeated: sampleAttempts[i].boss,
          completed: sampleAttempts[i].completed,
          starsEarned: sampleAttempts[i].stars,
          score: sampleAttempts[i].score,
          attemptNumber: i + 1,
        });
      }
    });

    it('should calculate stage completion statistics correctly', () => {
      const stats = calculateStageCompletionStatistics();

      expect(stats.totalAttempts).toBe(10);
      expect(stats.totalCompletions).toBe(5);
      expect(stats.overallCompletionRate).toBe(0.5);
    });

    it('should calculate stage-specific completion rates', () => {
      const stats = calculateStageCompletionStatistics();

      expect(stats.byStage['1_1']).toBeDefined();
      expect(stats.byStage['1_1'].attempts).toBe(3);
      expect(stats.byStage['1_1'].completions).toBe(2);
      expect(stats.byStage['1_1'].completionRate).toBeCloseTo(0.667, 3);
      expect(stats.byStage['1_1'].averageStars).toBe(2.5);
      expect(stats.byStage['1_1'].averageScore).toBe(1350);

      expect(stats.byStage['1_2']).toBeDefined();
      expect(stats.byStage['1_2'].completions).toBe(2);
      expect(stats.byStage['1_2'].completionRate).toBeCloseTo(0.667, 3);

      expect(stats.byStage['2_1']).toBeDefined();
      expect(stats.byStage['2_1'].completions).toBe(1);
      expect(stats.byStage['2_1'].completionRate).toBe(0.5);

      expect(stats.byStage['2_2']).toBeDefined();
      expect(stats.byStage['2_2'].completions).toBe(0);
      expect(stats.byStage['2_2'].completionRate).toBe(0);
    });

    it('should calculate difficulty-specific statistics', () => {
      const stats = calculateStageCompletionStatistics();

      expect(stats.byDifficulty.easy).toBeDefined();
      expect(stats.byDifficulty.easy.completions).toBe(2);
      expect(stats.byDifficulty.easy.averageStars).toBe(2.5);

      expect(stats.byDifficulty.medium).toBeDefined();
      expect(stats.byDifficulty.medium.completions).toBe(2);
      expect(stats.byDifficulty.medium.averageStars).toBe(2);

      expect(stats.byDifficulty.hard).toBeDefined();
      expect(stats.byDifficulty.hard.completions).toBe(1);
      expect(stats.byDifficulty.hard.completionRate).toBe(0.25);
    });

    it('should calculate chapter-level statistics', () => {
      const stats = calculateStageCompletionStatistics();

      expect(stats.byChapter['campaign_1']).toBeDefined();
      expect(stats.byChapter['campaign_1'].totalStages).toBe(2);
      expect(stats.byChapter['campaign_1'].totalAttempts).toBe(6);
      expect(stats.byChapter['campaign_1'].totalCompletions).toBe(4);

      expect(stats.byChapter['campaign_2']).toBeDefined();
      expect(stats.byChapter['campaign_2'].totalStages).toBe(2);
      expect(stats.byChapter['campaign_2'].totalAttempts).toBe(4);
      expect(stats.byChapter['campaign_2'].totalCompletions).toBe(1);
    });

    it('should track boss stage statistics', () => {
      const stats = calculateStageCompletionStatistics();

      expect(stats.bossStages.attempts).toBe(2);
      expect(stats.bossStages.completions).toBe(1);
      expect(stats.bossStages.completionRate).toBe(0.5);
    });
  });

  describe('Balance Insights Generation', () => {
    beforeEach(async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      // Create a scenario with balance issues
      // Rarity distribution deviation
      // Very low completion rate for a stage
      // Very high completion rate for another stage

      // Generate drops with skewed rarity distribution to trigger deviation issues
      // Expected: common 60%, rare 25%, epic 10%, legendary 5%
      // We'll create: common 30%, rare 40%, epic 20%, legendary 10% (large deviation)
      for (let i = 0; i < 30; i++) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'common',
          gearType: 'helm',
          gearId: `helm_common_${i}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }
      for (let i = 0; i < 40; i++) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'rare',
          gearType: 'helm',
          gearId: `helm_rare_${i}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }
      for (let i = 0; i < 20; i++) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'epic',
          gearType: 'helm',
          gearId: `helm_epic_${i}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }
      for (let i = 0; i < 10; i++) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'legendary',
          gearType: 'helm',
          gearId: `helm_legendary_${i}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }

      // Stage attempts with balance issues
      // Generate 25 attempts for a stage that's too easy (above threshold of 20)
      for (let i = 0; i < 25; i++) {
        await recordStageAttempt(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          completed: true,
          starsEarned: 3,
          score: 1500 + Math.floor(Math.random() * 100),
          attemptNumber: i + 1,
        });
      }

      // Generate 25 attempts for a stage that's too hard (0% completion)
      for (let i = 0; i < 25; i++) {
        await recordStageAttempt(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_2',
          stagePrefix: 'campaign_1',
          difficulty: 'hard',
          bossDefeated: false,
          completed: false,
          starsEarned: 0,
          score: 0,
          attemptNumber: i + 1,
        });
      }
    });

    it('should identify drop distribution issues', () => {
      const insights = generateBalanceInsights();

      // Should identify rarity distribution deviations
      expect(insights.drops.issues.length).toBeGreaterThan(0);
    });

    it('should identify stage completion rate issues', () => {
      const insights = generateBalanceInsights();

      expect(insights.stages.issues.length).toBeGreaterThan(0);
      expect(insights.stages.recommendations.length).toBeGreaterThan(0);
    });

    it('should include both summary and insights in response', () => {
      const insights = generateBalanceInsights();

      expect(insights.drops.summary).toBeDefined();
      expect(insights.stages.summary).toBeDefined();
      expect(insights.timeRange).toBeDefined();
      expect(insights.generatedAt).toBeDefined();
    });
  });

  describe('RPC Handlers', () => {
    it('should handle record_drop RPC', async () => {
      const ctx = mockContext();
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      const payload = JSON.stringify({
        stage_id: '1_1',
        stage_prefix: 'campaign_1',
        difficulty: 'medium',
        boss_defeated: false,
        gear_rarity: 'rare',
        gear_type: 'bow',
        gear_id: 'bow_rare_123',
        drop_rate_used: 0.35,
        roll_value: 0.25,
      });

      const result = await rpcRecordDrop(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.drop_id).toBeDefined();
      expect(nk.storageWrite).toHaveBeenCalled();
    });

    it('should handle record_stage_attempt RPC', async () => {
      const ctx = mockContext();
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      const payload = JSON.stringify({
        stage_id: '1_1',
        stage_prefix: 'campaign_1',
        difficulty: 'medium',
        boss_defeated: false,
        completed: true,
        stars_earned: 3,
        score: 1500,
        attempt_number: 1,
      });

      const result = await rpcRecordStageAttempt(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.attempt_id).toBeDefined();
      expect(nk.storageWrite).toHaveBeenCalled();
    });

    it('should handle get_drop_statistics RPC', () => {
      const ctx = mockContext();
      const nk = mockNakama();

      const payload = JSON.stringify({});

      const result = rpcGetDropStatistics(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.statistics).toBeDefined();
    });

    it('should handle get_stage_completion_statistics RPC', () => {
      const ctx = mockContext();
      const nk = mockNakama();

      const payload = JSON.stringify({});

      const result = rpcGetStageCompletionStatistics(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.statistics).toBeDefined();
    });

    it('should handle get_balance_insights RPC', () => {
      const ctx = mockContext();
      const nk = mockNakama();

      const payload = JSON.stringify({});

      const result = rpcGetBalanceInsights(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.insights).toBeDefined();
      expect(response.insights.drops).toBeDefined();
      expect(response.insights.stages).toBeDefined();
    });

    it('should filter statistics by date range', () => {
      const ctx = mockContext();
      const nk = mockNakama();

      const payload = JSON.stringify({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

      const result = rpcGetDropStatistics(ctx, mockLogger(), nk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.statistics).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should get recent drops with limit', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      for (let i = 0; i < 50; i++) {
        await recordDrop(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          gearRarity: 'common',
          gearType: 'helm',
          gearId: `helm_${i}`,
          dropRateUsed: 0.5,
          rollValue: 0.25,
        });
      }

      const recentDrops = getRecentDrops(10);
      expect(recentDrops).toHaveLength(10);
    });

    it('should get recent stage attempts with limit', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      for (let i = 0; i < 50; i++) {
        await recordStageAttempt(nk, {
          userId: 'user123',
          timestamp: Date.now(),
          stageId: '1_1',
          stagePrefix: 'campaign_1',
          difficulty: 'medium',
          bossDefeated: false,
          completed: true,
          starsEarned: 3,
          score: 1500,
          attemptNumber: i + 1,
        });
      }

      const recentAttempts = getRecentStageAttempts(10);
      expect(recentAttempts).toHaveLength(10);
    });

    it('should clear analytics storage', async () => {
      const nk = mockNakama();
      nk.storageWrite.mockResolvedValue([]);

      await recordDrop(nk, {
        userId: 'user123',
        timestamp: Date.now(),
        stageId: '1_1',
        stagePrefix: 'campaign_1',
        difficulty: 'medium',
        bossDefeated: false,
        gearRarity: 'common',
        gearType: 'helm',
        gearId: 'helm_1',
        dropRateUsed: 0.5,
        rollValue: 0.25,
      });

      expect(getRecentDrops()).toHaveLength(1);

      clearAnalyticsStorage();

      expect(getRecentDrops()).toHaveLength(0);
    });
  });
});
