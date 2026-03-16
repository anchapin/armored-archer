/**
 * Stage Tracking module.
 * @fileoverview Manages PvE stage completion tracking for player progression.
 * Uses Nakama's storage system for data persistence.
 */
import { Runtime } from '../types/nakama';
import { GearItem } from './gear_system';
/**
 * Stage completion record stored in database.
 */
export interface StageCompletion {
    id: string;
    user_id: string;
    stage_id: string;
    stage_prefix: string;
    stars_earned: number;
    score: number;
    completed_at: string;
    updated_at: string;
}
/**
 * Storage record for stage completions (stored per user).
 */
export interface StageCompletionStorage {
    user_id: string;
    completions: Record<string, {
        stage_id: string;
        stage_prefix: string;
        stars_earned: number;
        score: number;
        completed_at: string;
        updated_at: string;
    }>;
}
/**
 * Request payload for completing a stage (with optional loot generation).
 */
export interface CompleteStageRequest {
    stage_id: string;
    stage_prefix: string;
    stars_earned: number;
    score: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare';
    boss_defeated?: boolean;
    boss_id?: string;
}
/**
 * Loot result from stage completion.
 */
export interface LootResult {
    dropped: boolean;
    gear: GearItem | null;
}
/**
 * Request payload for getting completed stages.
 */
export interface GetStageCompletionRequest {
    stage_id: string;
}
/**
 * Request payload for getting all stage completions.
 */
export interface GetAllStageCompletionsRequest {
    stage_prefix?: string;
}
/**
 * Response for stage completion (with optional loot).
 */
export interface StageCompletionResponse {
    success: boolean;
    stage_id: string;
    stars_earned: number;
    score: number;
    is_new_completion: boolean;
    previous_best?: {
        stars_earned: number;
        score: number;
    };
    loot?: LootResult;
    drop_rate?: number;
    unlocked_modifier_pools?: string[];
}
/**
 * Registers the complete_stage RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcCompleteStage(initializer: Runtime.Initializer): void;
/**
 * Registers the get_completed_stages RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetCompletedStages(initializer: Runtime.Initializer): void;
/**
 * Handles stage completion requests from players.
 * Validates input and records stage completion using Nakama storage.
 * Allows stage replay - only updates if new score is better.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stage completion data
 * @returns JSON string with completion result
 */
export declare function rpcCompleteStage(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Handles requests to get completed stages for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing optional filters
 * @returns JSON string with completed stages
 */
export declare function rpcGetCompletedStages(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
