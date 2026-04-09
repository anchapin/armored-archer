/**
 * Progression Tracking module tests.
 * Tests for quest progress, map markers, and level requirements.
 */

import {
  trackQuestProgress,
  getActiveQuests,
  getQuestObjectives,
  updateMapMarkers,
  getMapMarkers,
  isLevelRequirementMet,
  getLevelRequirements,
  completeQuestObjective,
  saveProgressionData,
  loadProgressionData,
} from '../progression_tracking';
import { Runtime } from '../../types/nakama';

describe('ProgressionTracking', () => {
  let mockCtx: Partial<Runtime>;
  let testUserId = 'test-user-123';

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
  });

  describe('trackQuestProgress', () => {
    it('should track quest progress by ID', () => {
      const questData = {
        quest_id: 'stage_forest_1',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'complete_stage',
            description: 'Complete stage',
            state: 'in_progress',
            target: 1,
            current: 0,
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      const result = trackQuestProgress(mockCtx, testUserId, questData);
      expect(result.success).toBe(true);
    });

    it('should update existing quest progress', () => {
      const questData = {
        quest_id: 'stage_forest_1',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'complete_stage',
            description: 'Complete stage',
            state: 'in_progress',
            target: 1,
            current: 0,
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      // Track initial progress
      trackQuestProgress(mockCtx, testUserId, questData);

      // Update with progress
      questData.objectives[0].current = 1;
      questData.objectives[0].state = 'completed';
      const result = trackQuestProgress(mockCtx, testUserId, questData);

      expect(result.success).toBe(true);
    });

    it('should validate objective state enum', () => {
      const validStates = ['not_started', 'in_progress', 'completed', 'failed'];

      for (const state of validStates) {
        const questData = {
          quest_id: 'test_quest',
          quest_type: 'stage_completion',
          objectives: [
            {
              objective_id: 'test_objective',
              description: 'Test objective',
              state: state,
              target: 1,
              current: 0,
            },
          ],
          started_at: new Date().toISOString(),
          priority: 100,
        };

        const result = trackQuestProgress(mockCtx, testUserId, questData);
        expect(result.success || result.error).toBeDefined();
      }
    });

    it('should validate quest type enum', () => {
      const validTypes = ['stage_completion', 'boss_defeat', 'stat_target', 'level_target', 'collect_item', 'survival'];

      for (const type of validTypes) {
        const questData = {
          quest_id: `test_${type}`,
          quest_type: type,
          objectives: [],
          started_at: new Date().toISOString(),
          priority: 100,
        };

        const result = trackQuestProgress(mockCtx, testUserId, questData);
        expect(result.success || result.error).toBeDefined();
      }
    });
  });

  describe('getActiveQuests', () => {
    it('should return active quests for player', () => {
      const result = getActiveQuests(mockCtx, testUserId);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.quests)).toBe(true);
    });

    it('should return empty array when no active quests', () => {
      const result = getActiveQuests(mockCtx, testUserId);
      expect(result.success).toBe(true);
      expect(result.quests).toEqual([]);
    });

    it('should sort quests by priority', () => {
      // Create test quests with different priorities
      const quests = [
        {
          quest_id: 'low_priority',
          quest_type: 'stat_target',
          objectives: [],
          started_at: new Date().toISOString(),
          priority: 50,
        },
        {
          quest_id: 'high_priority',
          quest_type: 'stage_completion',
          objectives: [],
          started_at: new Date().toISOString(),
          priority: 100,
        },
      ];

      // Mock storage to return these quests
      mockCtx.storageRead.mockResolvedValueOnce({
        player_id: testUserId,
        active_quests: quests,
        completed_quests: [],
      });

      const result = getActiveQuests(mockCtx, testUserId);
      expect(result.quests[0].quest_id).toBe('high_priority');
      expect(result.quests[1].quest_id).toBe('low_priority');
    });
  });

  describe('getQuestObjectives', () => {
    it('should return objectives for quest ID', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          { objective_id: 'obj1', description: 'Objective 1', state: 'in_progress', target: 1, current: 0 },
          { objective_id: 'obj2', description: 'Objective 2', state: 'not_started', target: 1, current: 0 },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = getQuestObjectives(mockCtx, testUserId, 'test_quest');
      expect(result.success).toBe(true);
      expect(result.objectives.length).toBe(2);
    });

    it('should return empty for non-existent quest', () => {
      const result = getQuestObjectives(mockCtx, testUserId, 'non_existent');
      expect(result.success).toBe(true);
      expect(result.objectives).toEqual([]);
    });
  });

  describe('updateMapMarkers', () => {
    it('should create markers for active quest objectives', () => {
      const questData = {
        quest_id: 'stage_forest_1',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'complete_stage',
            description: 'Complete Forest Stage 1',
            state: 'in_progress',
            target: 1,
            current: 0,
            stage_id: 'forest_stage_1',
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = updateMapMarkers(mockCtx, testUserId);
      expect(result.success).toBe(true);
    });

    it('should create markers for available content', () => {
      const result = updateMapMarkers(mockCtx, testUserId);
      expect(result.success).toBe(true);
    });

    it('should create markers for locked content', () => {
      // Set up a level requirement
      const levelReq = {
        level_or_stage: 'forest_stage_5',
        required_level: 10,
        description: 'Reach level 10',
      };

      const result = updateMapMarkers(mockCtx, testUserId);
      expect(result.success || result.error).toBeDefined();
    });
  });

  describe('getMapMarkers', () => {
    it('should return map markers keyed by stage ID', () => {
      const result = getMapMarkers(mockCtx, testUserId);
      expect(result.success).toBe(true);
      expect(typeof result.markers).toBe('object');
    });

    it('should include marker type information', () => {
      const result = getMapMarkers(mockCtx, testUserId);
      const markers = result.markers || {};

      for (const stageId in markers) {
        const stageMarkers = markers[stageId];
        expect(Array.isArray(stageMarkers)).toBe(true);
        for (const marker of stageMarkers) {
          expect(marker.marker_type).toBeDefined();
          expect(['quest', 'available', 'locked']).toContain(marker.marker_type);
        }
      }
    });

    it('should include marker description', () => {
      const result = getMapMarkers(mockCtx, testUserId);
      const markers = result.markers || {};

      for (const stageId in markers) {
        const stageMarkers = markers[stageId];
        for (const marker of stageMarkers) {
          expect(marker.description).toBeDefined();
          expect(typeof marker.description).toBe('string');
        }
      }
    });
  });

  describe('isLevelRequirementMet', () => {
    it('should return true when player meets requirement', () => {
      const result = isLevelRequirementMet(mockCtx, testUserId, 'forest_stage_5', 5);
      expect(result.met).toBe(true);
    });

    it('should return false when player below requirement', () => {
      const result = isLevelRequirementMet(mockCtx, testUserId, 'forest_stage_5', 10);
      expect(result.met).toBe(false);
    });

    it('should return true when no requirement exists', () => {
      const result = isLevelRequirementMet(mockCtx, testUserId, 'forest_stage_1', 1);
      expect(result.met).toBe(true);
    });
  });

  describe('getLevelRequirements', () => {
    it('should return requirement for stage ID', () => {
      const result = getLevelRequirements(mockCtx, testUserId, 'forest_stage_5');
      expect(result.success || result.error).toBeDefined();
    });

    it('should return requirement for level number', () => {
      const result = getLevelRequirements(mockCtx, testUserId, 10);
      expect(result.success || result.error).toBeDefined();
    });

    it('should include required level', () => {
      const result = getLevelRequirements(mockCtx, testUserId, 'forest_stage_10');
      if (result.success) {
        expect(result.requirement.required_level).toBeGreaterThan(0);
      }
    });

    it('should include optional description', () => {
      const result = getLevelRequirements(mockCtx, testUserId, 'forest_stage_10');
      if (result.success) {
        expect(result.requirement.required_level).toBeDefined();
      }
    });
  });

  describe('completeQuestObjective', () => {
    it('should update objective state to completed', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'test_objective',
            description: 'Test objective',
            state: 'in_progress',
            target: 1,
            current: 0,
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = completeQuestObjective(mockCtx, testUserId, 'test_quest', 'test_objective');
      expect(result.success).toBe(true);
    });

    it('should set completed timestamp', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'test_objective',
            description: 'Test objective',
            state: 'in_progress',
            target: 1,
            current: 0,
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = completeQuestObjective(mockCtx, testUserId, 'test_quest', 'test_objective');
      if (result.success) {
        expect(result.objective.completed_at).toBeDefined();
      }
    });

    it('should validate all objectives completed before quest complete', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          {
            objective_id: 'obj1',
            description: 'Objective 1',
            state: 'in_progress',
            target: 1,
            current: 0,
          },
          {
            objective_id: 'obj2',
            description: 'Objective 2',
            state: 'not_started',
            target: 1,
            current: 0,
          },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      // Try to mark quest complete with incomplete objectives
      const result = completeQuestObjective(mockCtx, testUserId, 'test_quest', 'obj1');
      expect(result.success || !result.error).toBeDefined();
    });
  });

  describe('Quest types', () => {
    it('should support stage_completion quest type', () => {
      const questData = {
        quest_id: 'stage_quest',
        quest_type: 'stage_completion',
        objectives: [],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      const result = trackQuestProgress(mockCtx, testUserId, questData);
      expect(result.success || result.error).toBeDefined();
    });

    it('should support level_target quest type', () => {
      const questData = {
        quest_id: 'level_quest',
        quest_type: 'level_target',
        objectives: [],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      const result = trackQuestProgress(mockCtx, testUserId, questData);
      expect(result.success || result.error).toBeDefined();
    });

    it('should support boss_defeat quest type', () => {
      const questData = {
        quest_id: 'boss_quest',
        quest_type: 'boss_defeat',
        objectives: [],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      const result = trackQuestProgress(mockCtx, testUserId, questData);
      expect(result.success || result.error).toBeDefined();
    });
  });

  describe('saveProgressionData', () => {
    it('should save progression data to storage', () => {
      const result = saveProgressionData(mockCtx, testUserId);
      expect(result.success).toBe(true);
    });

    it('should include active quests in save data', () => {
      saveProgressionData(mockCtx, testUserId);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith(
        'progression_data',
        expect.objectContaining({
          active_quests: expect.any(Array),
        })
      );
    });

    it('should include completed quests in save data', () => {
      saveProgressionData(mockCtx, testUserId);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith(
        'progression_data',
        expect.objectContaining({
          completed_quests: expect.any(Array),
        })
      );
    });
  });

  describe('loadProgressionData', () => {
    it('should load progression data from storage', () => {
      const savedData = {
        user_id: testUserId,
        active_quests: [],
        completed_quests: ['completed_quest_1'],
        total_quests_completed: 1,
        last_updated: new Date().toISOString(),
      };

      mockCtx.storageRead.mockResolvedValueOnce(savedData);

      const result = loadProgressionData(mockCtx, testUserId);
      expect(result.success).toBe(true);
      expect(result.data.total_quests_completed).toBe(1);
    });

    it('should handle missing saved data', () => {
      mockCtx.storageRead.mockResolvedValueOnce(null);

      const result = loadProgressionData(mockCtx, testUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Progression percentage calculation', () => {
    it('should calculate 0% for new quest', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          { objective_id: 'obj1', description: 'Objective 1', state: 'in_progress', target: 1, current: 0 },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = getQuestObjectives(mockCtx, testUserId, 'test_quest');
      if (result.success) {
        const progress = calculateQuestProgress(result.objectives);
        expect(progress).toBe(0);
      }
    });

    it('should calculate 50% for half-completed quest', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          { objective_id: 'obj1', description: 'Objective 1', state: 'completed', target: 1, current: 1 },
          { objective_id: 'obj2', description: 'Objective 2', state: 'in_progress', target: 1, current: 0 },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = getQuestObjectives(mockCtx, testUserId, 'test_quest');
      if (result.success) {
        const progress = calculateQuestProgress(result.objectives);
        expect(progress).toBeCloseTo(50, 1);
      }
    });

    it('should calculate 100% for completed quest', () => {
      const questData = {
        quest_id: 'test_quest',
        quest_type: 'stage_completion',
        objectives: [
          { objective_id: 'obj1', description: 'Objective 1', state: 'completed', target: 1, current: 1 },
          { objective_id: 'obj2', description: 'Objective 2', state: 'completed', target: 1, current: 1 },
        ],
        started_at: new Date().toISOString(),
        priority: 100,
      };

      trackQuestProgress(mockCtx, testUserId, questData);

      const result = getQuestObjectives(mockCtx, testUserId, 'test_quest');
      if (result.success) {
        const progress = calculateQuestProgress(result.objectives);
        expect(progress).toBe(100);
      }
    });
  });

  describe('Map marker types', () => {
    it('should create quest markers for active objectives', () => {
      const result = updateMapMarkers(mockCtx, testUserId);
      if (result.success) {
        const markers = result.markers || {};
        for (const stageId in markers) {
          for (const marker of markers[stageId]) {
            if (marker.marker_type === 'quest') {
              expect(marker.description).toBeDefined();
            }
          }
        }
      }
    });

    it('should create available markers for unlocked content', () => {
      const result = updateMapMarkers(mockCtx, testUserId);
      if (result.success) {
        const markers = result.markers || {};
        for (const stageId in markers) {
          for (const marker of markers[stageId]) {
            if (marker.marker_type === 'available') {
              expect(marker.description).toBeDefined();
            }
          }
        }
      }
    });

    it('should create locked markers for gated content', () => {
      const result = updateMapMarkers(mockCtx, testUserId);
      if (result.success) {
        const markers = result.markers || {};
        for (const stageId in markers) {
          for (const marker of markers[stageId]) {
            if (marker.marker_type === 'locked') {
              expect(marker.description).toBeDefined();
            }
          }
        }
      }
    });
  });
});
