/**
 * Progression Tracking Module
 *
 * Tracks player progression data including quest progress, map markers,
 * and level requirements. Provides server-side persistence for progression
 * indicators and syncs with client state.
 *
 * Features:
 * - Track quest progress and completion
 * - Get player overall progression stats
 * - Update map markers based on player position
 * - Level requirement validation
 */

import { z } from 'zod';
import type { Nakama } from '@heroiclabs/nakama-js';
import type { Logger } from '@nestjs/common';

/**
 * Quest progress schema
 */
const QuestProgressSchema = z.object({
  quest_id: z.string(),
  quest_type: z.enum(['stage_completion', 'boss_defeat', 'stat_target', 'level_target', 'collect_item', 'survival']),
  objectives: z.array(z.object({
    objective_id: z.string(),
    description: z.string(),
    state: z.enum(['not_started', 'in_progress', 'completed', 'failed']),
    target: z.number(),
    current: z.number(),
    completed_at: z.string().optional(),
  })),
  started_at: z.string(),
  completed_at: z.string().optional(),
  priority: z.number().default(0),
});

export type QuestProgress = z.infer<typeof QuestProgressSchema>;

/**
 * Player progression data schema
 */
const PlayerProgressionSchema = z.object({
  user_id: z.string(),
  active_quests: z.array(QuestProgressSchema),
  completed_quests: z.array(z.string()),
  total_quests_completed: z.number().default(0),
  last_updated: z.string(),
});

export type PlayerProgression = z.infer<typeof PlayerProgressionSchema>;

/**
 * Map marker schema
 */
const MapMarkerSchema = z.object({
  stage_id: z.string(),
  marker_type: z.enum(['quest', 'available', 'locked']),
  description: z.string(),
  priority: z.number().default(0),
});

export type MapMarker = z.infer<typeof MapMarkerSchema>;

/**
 * Level requirement schema
 */
const LevelRequirementSchema = z.object({
  level_or_stage: z.string(),
  required_level: z.number().min(1),
  description: z.string().optional(),
  rewards: z.array(z.object({
    type: z.string(),
    amount: z.number(),
    description: z.string().optional(),
  })).optional(),
});

export type LevelRequirement = z.infer<typeof LevelRequirementSchema>;

/**
 * Progression tracking class
 */
export class ProgressionTracking {
  private logger: Logger;
  private nakama: Nakama.Client;
  private storage: Nakama.StorageClient;

  constructor(logger: Logger, nakama: Nakama.Client, storage: Nakama.StorageClient) {
    this.logger = logger;
    this.nakama = nakama;
    this.storage = storage;
  }

  /**
   * Tracks quest progress on the server
   *
   * @param userId - User ID
   * @param questId - Quest ID
   * @param objectiveId - Objective ID (optional)
   * @param progress - Progress value (0.0 to 1.0)
   * @returns Promise with update result
   */
  async trackQuestProgress(
    userId: string,
    questId: string,
    objectiveId?: string,
    progress?: number
  ): Promise<{ success: boolean; error?: string; quest_data?: QuestProgress }> {
    try {
      // Fetch current progression data
      const progression = await this.getPlayerProgression(userId);

      // Find the quest
      let quest = progression.active_quests.find(q => q.quest_id === questId);

      if (!quest) {
        return { success: false, error: 'Quest not found' };
      }

      // Update quest progress
      if (progress !== undefined) {
        quest.priority = Math.floor(progress * 100);
      }

      // Update objective if specified
      if (objectiveId) {
        const objective = quest.objectives.find(obj => obj.objective_id === objectiveId);
        if (objective) {
          objective.current = Math.min(objective.target, objective.current + 1);

          if (objective.current >= objective.target) {
            objective.state = 'completed';
            objective.completed_at = new Date().toISOString();
          }

          // Check if all objectives are completed
          const allCompleted = quest.objectives.every(obj => obj.state === 'completed');
          if (allCompleted) {
            quest.completed_at = new Date().toISOString();
            progression.completed_quests.push(questId);
            progression.active_quests = progression.active_quests.filter(q => q.quest_id !== questId);
            progression.total_quests_completed += 1;
          }
        }
      }

      progression.last_updated = new Date().toISOString();

      // Save updated progression
      await this.savePlayerProgression(userId, progression);

      this.logger.log(`Tracked progress for quest ${questId} for user ${userId}`);

      return { success: true, quest_data: quest };
    } catch (error) {
      this.logger.error(`Failed to track quest progress: ${error}`);
      return { success: false, error: 'Failed to track quest progress' };
    }
  }

  /**
   * Gets player overall progression stats
   *
   * @param userId - User ID
   * @returns Promise with progression stats
   */
  async getPlayerProgressionStats(
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
    stats?: {
      active_quests_count: number;
      completed_quests_count: number;
      total_progress: number;
      current_objectives: number;
      completed_objectives: number;
      last_updated: string;
    };
  }> {
    try {
      const progression = await this.getPlayerProgression(userId);

      const activeQuestsCount = progression.active_quests.length;
      const completedQuestsCount = progression.completed_quests.length;

      let totalProgress = 0;
      let currentObjectives = 0;
      let completedObjectives = 0;

      for (const quest of progression.active_quests) {
        const questObjectives = quest.objectives.length;
        const completedInQuest = quest.objectives.filter(obj => obj.state === 'completed').length;

        currentObjectives += questObjectives;
        completedObjectives += completedInQuest;

        if (questObjectives > 0) {
          totalProgress += (completedInQuest / questObjectives);
        }
      }

      // Calculate overall progress percentage
      const overallProgress = currentObjectives > 0
        ? Math.round((totalProgress / activeQuestsCount) * 100)
        : 0;

      return {
        success: true,
        stats: {
          active_quests_count: activeQuestsCount,
          completed_quests_count: completedQuestsCount,
          total_progress: overallProgress,
          current_objectives: currentObjectives,
          completed_objectives: completedObjectives,
          last_updated: progression.last_updated,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get player progression stats: ${error}`);
      return { success: false, error: 'Failed to get progression stats' };
    }
  }

  /**
   * Updates map markers based on player position and progress
   *
   * @param userId - User ID
   * @param playerLevel - Current player level
   * @returns Promise with updated map markers
   */
  async updateMapMarkers(
    userId: string,
    playerLevel: number
  ): Promise<{
    success: boolean;
    error?: string;
    markers?: MapMarker[];
  }> {
    try {
      const markers: MapMarker[] = [];

      // Get player progression
      const progression = await this.getPlayerProgression(userId);

      // Add markers for active quest objectives
      for (const quest of progression.active_quests) {
        for (const objective of quest.objectives) {
          if (objective.state === 'in_progress') {
            // Extract stage_id from description or quest data if available
            const stageId = this.extractStageId(quest.quest_id);
            if (stageId) {
              markers.push({
                stage_id: stageId,
                marker_type: 'quest',
                description: objective.description,
                priority: 100,
              });
            }
          }
        }
      }

      // Note: Available and locked markers are determined client-side
      // based on campaign progression. Server provides quest markers only.

      this.logger.log(`Updated map markers for user ${userId}, found ${markers.length} markers`);

      return { success: true, markers };
    } catch (error) {
      this.logger.error(`Failed to update map markers: ${error}`);
      return { success: false, error: 'Failed to update map markers' };
    }
  }

  /**
   * Validates if a level requirement is met
   *
   * @param userId - User ID
   * @param levelOrStage - Level number or stage ID
   * @returns Promise with validation result
   */
  async validateLevelRequirement(
    userId: string,
    levelOrStage: string | number
  ): Promise<{
    success: boolean;
    error?: string;
    is_met?: boolean;
    required_level?: number;
    current_level?: number;
  }> {
    try {
      // Get player stats to determine current level
      const stats = await this.getPlayerStats(userId);

      if (!stats) {
        return { success: false, error: 'Player stats not found' };
      }

      const currentLevel = stats.level || 1;

      // Determine required level
      let requiredLevel: number;

      if (typeof levelOrStage === 'number') {
        requiredLevel = levelOrStage;
      } else {
        // Extract level from stage ID (e.g., "2_3" -> 2)
        const parts = levelOrStage.split('_');
        const chapterLevel = parseInt(parts[0], 10);

        // Map chapter to level requirement
        const levelMap: Record<string, number> = {
          '1': 1,
          '2': 5,
          '3': 10,
          '4': 15,
        };

        requiredLevel = levelMap[chapterLevel.toString()] || 1;
      }

      const isMet = currentLevel >= requiredLevel;

      return {
        success: true,
        is_met: isMet,
        required_level: requiredLevel,
        current_level: currentLevel,
      };
    } catch (error) {
      this.logger.error(`Failed to validate level requirement: ${error}`);
      return { success: false, error: 'Failed to validate level requirement' };
    }
  }

  /**
   * Gets player progression data from storage
   *
   * @param userId - User ID
   * @returns Promise with player progression data
   */
  private async getPlayerProgression(userId: string): Promise<PlayerProgression> {
    try {
      const objectIds: Nakama.StorageReadRequest[] = [
        {
          collection: 'progression',
          key: `progression_${userId}`,
          userId: userId,
        },
      ];

      const results = await this.storage.readObjects(objectIds);

      if (results.length > 0) {
        const data = JSON.parse(results[0].value);
        return PlayerProgressionSchema.parse(data);
      }

      // Return default progression if not found
      return {
        user_id: userId,
        active_quests: [],
        completed_quests: [],
        total_quests_completed: 0,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get player progression: ${error}`);
      throw error;
    }
  }

  /**
   * Saves player progression data to storage
   *
   * @param userId - User ID
   * @param progression - Progression data to save
   */
  private async savePlayerProgression(userId: string, progression: PlayerProgression): Promise<void> {
    try {
      const writeObject: Nakama.StorageWriteRequest = {
        collection: 'progression',
        key: `progression_${userId}`,
        value: JSON.stringify(progression),
        userId: userId,
      };

      await this.storage.writeObjects([writeObject]);
    } catch (error) {
      this.logger.error(`Failed to save player progression: ${error}`);
      throw error;
    }
  }

  /**
   * Gets player stats from storage
   *
   * @param userId - User ID
   * @returns Promise with player stats
   */
  private async getPlayerStats(userId: string): Promise<{ level: number } | null> {
    try {
      const objectIds: Nakama.StorageReadRequest[] = [
        {
          collection: 'player_stats',
          key: `stats_${userId}`,
          userId: userId,
        },
      ];

      const results = await this.storage.readObjects(objectIds);

      if (results.length > 0) {
        const data = JSON.parse(results[0].value);
        return { level: data.level || 1 };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get player stats: ${error}`);
      return null;
    }
  }

  /**
   * Extracts stage ID from quest ID
   *
   * @param questId - Quest ID (e.g., "stage_1_3" -> "1_3")
   * @returns Stage ID or null
   */
  private extractStageId(questId: string): string | null {
    if (questId.startsWith('stage_')) {
      return questId.substring(6); // Remove 'stage_' prefix
    }
    return null;
  }
}

/**
 * RPC handler for tracking quest progress
 */
export async function trackQuestProgressRpc(
  ctx: any,
  logger: Logger,
  nakama: Nakama.Client,
  storage: Nakama.StorageClient
): Promise<any> {
  const progressionTracking = new ProgressionTracking(logger, nakama, storage);

  try {
    // Parse request payload
    const payload = JSON.parse(ctx.payload);
    const questId = payload.quest_id as string;
    const objectiveId = payload.objective_id as string | undefined;
    const progress = payload.progress as number | undefined;

    if (!questId) {
      return { success: false, error: 'quest_id is required' };
    }

    const userId = ctx.userId;

    // Track quest progress
    const result = await progressionTracking.trackQuestProgress(userId, questId, objectiveId, progress);

    return result;
  } catch (error) {
    logger.error(`RPC trackQuestProgress failed: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * RPC handler for getting player progression stats
 */
export async function getPlayerProgressionStatsRpc(
  ctx: any,
  logger: Logger,
  nakama: Nakama.Client,
  storage: Nakama.StorageClient
): Promise<any> {
  const progressionTracking = new ProgressionTracking(logger, nakama, storage);

  try {
    const userId = ctx.userId;

    // Get progression stats
    const result = await progressionTracking.getPlayerProgressionStats(userId);

    return result;
  } catch (error) {
    logger.error(`RPC getPlayerProgressionStats failed: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * RPC handler for updating map markers
 */
export async function updateMapMarkersRpc(
  ctx: any,
  logger: Logger,
  nakama: Nakama.Client,
  storage: Nakama.StorageClient
): Promise<any> {
  const progressionTracking = new ProgressionTracking(logger, nakama, storage);

  try {
    // Parse request payload
    const payload = JSON.parse(ctx.payload);
    const playerLevel = payload.player_level as number;

    if (!playerLevel) {
      return { success: false, error: 'player_level is required' };
    }

    const userId = ctx.userId;

    // Update map markers
    const result = await progressionTracking.updateMapMarkers(userId, playerLevel);

    return result;
  } catch (error) {
    logger.error(`RPC updateMapMarkers failed: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * RPC handler for validating level requirements
 */
export async function validateLevelRequirementRpc(
  ctx: any,
  logger: Logger,
  nakama: Nakama.Client,
  storage: Nakama.StorageClient
): Promise<any> {
  const progressionTracking = new ProgressionTracking(logger, nakama, storage);

  try {
    // Parse request payload
    const payload = JSON.parse(ctx.payload);
    const levelOrStage = payload.level_or_stage as string | number;

    if (!levelOrStage) {
      return { success: false, error: 'level_or_stage is required' };
    }

    const userId = ctx.userId;

    // Validate level requirement
    const result = await progressionTracking.validateLevelRequirement(userId, levelOrStage);

    return result;
  } catch (error) {
    logger.error(`RPC validateLevelRequirement failed: ${error}`);
    return { success: false, error: 'Internal server error' };
  }
}
