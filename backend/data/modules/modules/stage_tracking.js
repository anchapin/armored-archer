"use strict";
/**
 * Stage Tracking module.
 * @fileoverview Manages PvE stage completion tracking for player progression.
 * Uses Nakama's storage system for data persistence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcCompleteStage = registerRpcCompleteStage;
exports.registerRpcGetCompletedStages = registerRpcGetCompletedStages;
exports.registerRpcGetCampaignProgress = registerRpcGetCampaignProgress;
exports.rpcCompleteStage = rpcCompleteStage;
exports.rpcGetCompletedStages = rpcGetCompletedStages;
exports.rpcGetCampaignProgress = rpcGetCampaignProgress;
const audit_1 = require("./audit");
const gear_system_1 = require("./gear_system");
const validation_1 = require("./validation");
/**
 * Storage collection name for stage completions.
 */
const STAGE_COMPLETION_COLLECTION = 'stage_completion';
/**
 * Registers the complete_stage RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcCompleteStage(initializer) {
    initializer.registerRpc('armored_archer/complete_stage', rpcCompleteStage);
}
/**
 * Registers the get_completed_stages RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetCompletedStages(initializer) {
    initializer.registerRpc('armored_archer/get_completed_stages', rpcGetCompletedStages);
}
/**
 * Registers the get_campaign_progress RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetCampaignProgress(initializer) {
    initializer.registerRpc('armored_archer/get_campaign_progress', rpcGetCampaignProgress);
}
/**
 * Determines if new completion is better than existing one
 */
function isBetterCompletion(newStars, newScore, existingStars, existingScore) {
    return newStars > existingStars || (newStars === existingStars && newScore > existingScore);
}
/**
 * Creates a new completion record
 */
function createCompletionRecord(stageId, stagePrefix, starsEarned, score) {
    const now = new Date().toISOString();
    return {
        id: '',
        user_id: '',
        stage_id: stageId,
        stage_prefix: stagePrefix,
        stars_earned: starsEarned,
        score,
        completed_at: now,
        updated_at: now,
    };
}
/**
 * Updates an existing completion record
 */
function updateCompletionRecord(stageId, stagePrefix, starsEarned, score, existingCompletion) {
    return {
        ...existingCompletion,
        stage_id: stageId,
        stage_prefix: stagePrefix,
        stars_earned: starsEarned,
        score,
        updated_at: new Date().toISOString(),
    };
}
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
function rpcCompleteStage(ctx, logger, nk, payload) {
    logger.info('Complete stage called for user: %s', ctx.userId);
    // Validate authentication
    if (!ctx.userId) {
        logger.warn('complete_stage attempted without authentication');
        return JSON.stringify({
            success: false,
            error: 'Authentication required',
            error_code: 'UNAUTHORIZED',
        });
    }
    // Validate payload
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.complete_stage, payload, 'complete_stage');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'complete_stage', 'stage_completion', { stage_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('complete_stage', validation.error);
    }
    const request = validation.data;
    const { stage_id, stage_prefix, stars_earned, score } = request;
    logger.info('Processing stage completion: user=%s stage=%s stars=%d score=%d', ctx.userId, stage_id, stars_earned, score);
    try {
        // Read and process stage completion data
        const completionResult = readAndProcessStageCompletion(nk, ctx.userId, stage_id, stage_prefix, stars_earned, score, logger);
        // Handle case where replay didn't improve
        if (completionResult.noImprovement) {
            return JSON.stringify({
                success: true,
                stage_id,
                stars_earned: completionResult.existingCompletion.stars_earned,
                score: completionResult.existingCompletion.score,
                is_new_completion: false,
                previous_best: completionResult.previousBest,
                message: 'No improvement over previous completion',
            });
        }
        const isNewCompletion = completionResult.isNewCompletion;
        const previousBest = completionResult.previousBest;
        // Server-side loot generation (only if difficulty is provided)
        const lootResult = { dropped: false, gear: null };
        let dropRate = 0;
        let unlockedModifierPools = [];
        if (request.difficulty) {
            // Process loot generation
            const lootProcessingResult = processStageLoot(nk, ctx.userId, request, stage_id, logger);
            lootResult.dropped = lootProcessingResult.lootResult.dropped;
            lootResult.gear = lootProcessingResult.lootResult.gear;
            dropRate = lootProcessingResult.dropRate;
            unlockedModifierPools = lootProcessingResult.unlockedModifierPools;
        }
        // Log audit event
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'complete_stage', 'stage_completion', { stage_id, stage_prefix, stars_earned, score }, isNewCompletion ? 'success' : 'success', isNewCompletion ? 'New completion' : 'Updated completion');
        const response = {
            success: true,
            stage_id,
            stars_earned,
            score,
            is_new_completion: isNewCompletion,
        };
        if (previousBest) {
            response.previous_best = previousBest;
        }
        // Add loot information if difficulty was provided
        if (request.difficulty) {
            response.loot = lootResult;
            response.drop_rate = dropRate;
            response.unlocked_modifier_pools = unlockedModifierPools;
        }
        return JSON.stringify(response);
    }
    catch (error) {
        logger.error('Error processing stage completion: %s', String(error));
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'complete_stage', 'stage_completion', { stage_id }, 'failure', String(error));
        return JSON.stringify({
            success: false,
            error: 'Failed to process stage completion',
            error_code: 'INTERNAL_ERROR',
        });
    }
}
/**
 * Handles requests to get completed stages for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing optional filters
 * @returns JSON string with completed stages
 */
function rpcGetCompletedStages(ctx, logger, nk, payload) {
    logger.info('Get completed stages called for user: %s', ctx.userId);
    // Validate authentication
    if (!ctx.userId) {
        logger.warn('get_completed_stages attempted without authentication');
        return JSON.stringify({
            success: false,
            error: 'Authentication required',
            error_code: 'UNAUTHORIZED',
        });
    }
    // Handle empty payload - return all completions
    let request = {};
    if (payload && payload.trim()) {
        const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_all_stage_completions, payload, 'get_completed_stages');
        if (!validation.success) {
            return (0, validation_1.createValidationErrorResponse)('get_completed_stages', validation.error);
        }
        request = validation.data;
    }
    try {
        // Read stage completions from storage
        const storageObjects = nk.storageRead([
            {
                collection: STAGE_COMPLETION_COLLECTION,
                key: ctx.userId,
                userId: ctx.userId,
            },
        ]);
        let storageData = {
            user_id: ctx.userId,
            completions: {},
        };
        // Parse existing data if it exists
        if (storageObjects.length > 0 && storageObjects[0].value) {
            try {
                storageData = JSON.parse(storageObjects[0].value);
            }
            catch (e) {
                logger.warn('Failed to parse stage completion storage: %s', String(e));
            }
        }
        // Filter completions by prefix if specified
        let completions = Object.values(storageData.completions);
        if (request.stage_prefix) {
            completions = completions.filter((c) => c.stage_prefix === request.stage_prefix);
        }
        // Sort by completion date (most recent first)
        completions.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        logger.info('Retrieved %d completed stages for user: %s (filter: %s)', completions.length, ctx.userId, request.stage_prefix || 'none');
        return JSON.stringify({
            success: true,
            stages: completions.map((c) => ({
                stage_id: c.stage_id,
                stage_prefix: c.stage_prefix,
                stars_earned: c.stars_earned,
                score: c.score,
                completed_at: c.completed_at,
            })),
            count: completions.length,
        });
    }
    catch (error) {
        logger.error('Error retrieving completed stages: %s', String(error));
        return JSON.stringify({
            success: false,
            error: 'Failed to retrieve completed stages',
            error_code: 'INTERNAL_ERROR',
        });
    }
}
/**
 * Derives the next stage ID in sequence.
 * e.g., "1_1" -> "1_2", "2_3" -> "2_4"
 */
function deriveNextStageId(stageId) {
    const parts = stageId.split('_');
    if (parts.length !== 2)
        return null;
    const chapter = parts[0];
    const stageNum = parseInt(parts[1], 10);
    if (isNaN(stageNum))
        return null;
    return `${chapter}_${stageNum + 1}`;
}
/**
 * Handles requests to get campaign progress for a player.
 * Returns completed stages, unlocked stages, and defeated bosses.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (empty or unused)
 * @returns JSON string with campaign progress
 */
function rpcGetCampaignProgress(ctx, logger, nk, _payload) {
    logger.info('Get campaign progress called for user: %s', ctx.userId);
    // Validate authentication
    if (!ctx.userId) {
        logger.warn('get_campaign_progress attempted without authentication');
        return JSON.stringify({
            success: false,
            error: 'Authentication required',
            error_code: 'UNAUTHORIZED',
        });
    }
    try {
        // Read stage completions from storage
        const storageObjects = nk.storageRead([
            {
                collection: STAGE_COMPLETION_COLLECTION,
                key: ctx.userId,
                userId: ctx.userId,
            },
        ]);
        let storageData = {
            user_id: ctx.userId,
            completions: {},
        };
        // Parse existing data if it exists
        if (storageObjects.length > 0 && storageObjects[0].value) {
            try {
                storageData = JSON.parse(storageObjects[0].value);
            }
            catch (e) {
                logger.warn('Failed to parse stage completion storage: %s', String(e));
            }
        }
        // Build completed_stages array from completion keys
        const completedStages = Object.keys(storageData.completions);
        // Derive unlocked_stages: for each completed stage, the next stage is unlocked
        const unlockedSet = new Set();
        for (const stageId of completedStages) {
            const nextStage = deriveNextStageId(stageId);
            if (nextStage) {
                unlockedSet.add(nextStage);
            }
        }
        // Always ensure first stage is available
        unlockedSet.add('1_1');
        const unlockedStages = Array.from(unlockedSet);
        // Extract bosses defeated from completions (boss stages typically have boss data)
        // We read from the gear_system inventory for boss defeats
        const bossesDefeated = [];
        try {
            const inventoryObjects = nk.storageRead([
                {
                    collection: 'player_inventory',
                    key: ctx.userId,
                    userId: ctx.userId,
                },
            ]);
            if (inventoryObjects.length > 0 && inventoryObjects[0].value) {
                const inventory = JSON.parse(inventoryObjects[0].value);
                if (Array.isArray(inventory.unlocked_modifier_pools)) {
                    // Modifier pools unlocked by bosses indicate boss defeats
                    bossesDefeated.push(...inventory.unlocked_modifier_pools);
                }
            }
        }
        catch (e) {
            logger.warn('Failed to read boss defeats from inventory: %s', String(e));
        }
        logger.info('Campaign progress for user %s: completed=%d, unlocked=%d, bosses=%d', ctx.userId, completedStages.length, unlockedStages.length, bossesDefeated.length);
        return JSON.stringify({
            success: true,
            completed_stages: completedStages,
            unlocked_stages: unlockedStages,
            bosses_defeated: bossesDefeated,
        });
    }
    catch (error) {
        logger.error('Error retrieving campaign progress: %s', String(error));
        return JSON.stringify({
            success: false,
            error: 'Failed to retrieve campaign progress',
            error_code: 'INTERNAL_ERROR',
        });
    }
}
/**
 * Process stage completion loot generation
 */
function processStageLoot(nk, userId, request, stageId, logger) {
    const lootResult = {
        lootResult: { dropped: false, gear: null },
        dropRate: 0,
        unlockedModifierPools: [],
    };
    // Calculate drop rate server-side
    lootResult.dropRate = (0, gear_system_1.calculateDropRate)(request.difficulty, request.boss_defeated || false);
    const roll = Math.random();
    logger.info('Loot roll for user %s: roll=%f, dropRate=%f, difficulty=%s, bossDefeated=%s', userId, roll, lootResult.dropRate, request.difficulty, request.boss_defeated);
    // Get player inventory using helper function
    const inventory = (0, gear_system_1.getPlayerInventory)(nk, userId, logger);
    // Unlock modifier pools when boss is defeated
    if (request.boss_defeated && request.boss_id) {
        const modifiersToUnlock = (0, gear_system_1.getModifiersUnlockedByBoss)(request.boss_id);
        for (const modifierId of modifiersToUnlock) {
            if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
                inventory.unlocked_modifier_pools.push(modifierId);
                logger.info('Unlocked modifier pool %s for user %s after defeating boss %s', modifierId, userId, request.boss_id);
            }
        }
    }
    lootResult.unlockedModifierPools = inventory.unlocked_modifier_pools;
    // Roll for loot
    if (roll < lootResult.dropRate) {
        const gear = (0, gear_system_1.generateGearItem)(stageId, inventory.unlocked_modifier_pools, logger);
        inventory.gear.push(gear);
        lootResult.lootResult.dropped = true;
        lootResult.lootResult.gear = gear;
        logger.info('Loot dropped for user %s: %s (%s)', userId, gear.name, gear.rarity);
    }
    // Save inventory with new gear (if any)
    nk.storageWrite([
        {
            collection: 'player_inventory',
            key: userId,
            userId: userId,
            value: JSON.stringify(inventory),
        },
    ]);
    // Audit the loot drop
    (0, audit_1.logAudit)(nk, userId, null, 'stage_complete_loot', 'stage_progression', {
        stage_id: stageId,
        difficulty: request.difficulty,
        boss_defeated: request.boss_defeated,
        boss_id: request.boss_id ?? null,
        loot_dropped: lootResult.lootResult.dropped,
        loot_gear_id: lootResult.lootResult.gear?.id ?? null,
        loot_gear_rarity: lootResult.lootResult.gear?.rarity ?? null,
        drop_rate_used: lootResult.dropRate,
        roll_value: roll,
    }, 'success');
    return lootResult;
}
/**
 * Read and process stage completion data from storage
 */
function readAndProcessStageCompletion(nk, userId, stageId, stagePrefix, starsEarned, score, logger) {
    // Read existing stage completions from storage
    const storageObjects = nk.storageRead([
        {
            collection: STAGE_COMPLETION_COLLECTION,
            key: userId,
            userId: userId,
        },
    ]);
    let storageData = {
        user_id: userId,
        completions: {},
    };
    // Parse existing data if it exists
    if (storageObjects.length > 0 && storageObjects[0].value) {
        try {
            storageData = JSON.parse(storageObjects[0].value);
        }
        catch (e) {
            logger.warn('Failed to parse stage completion storage, creating new: %s', String(e));
        }
    }
    // Check for existing completion of this stage
    const existingCompletion = storageData.completions[stageId];
    const result = {
        storageData,
        isNewCompletion: true,
        noImprovement: false,
        previousBest: undefined,
        existingCompletion: undefined,
    };
    if (existingCompletion) {
        result.isNewCompletion = false;
        result.previousBest = {
            stars_earned: existingCompletion.stars_earned,
            score: existingCompletion.score,
        };
        // Only update if new completion is better
        if (!isBetterCompletion(starsEarned, score, existingCompletion.stars_earned, existingCompletion.score)) {
            logger.info('Stage replay did not improve: stage=%s new_stars=%d existing_stars=%d new_score=%d existing_score=%d', stageId, starsEarned, existingCompletion.stars_earned, score, existingCompletion.score);
            result.noImprovement = true;
            result.existingCompletion = existingCompletion;
            return result;
        }
        // Update existing completion
        storageData.completions[stageId] = updateCompletionRecord(stageId, stagePrefix, starsEarned, score, existingCompletion);
        logger.info('Updated stage completion: stage=%s stars=%d score=%d', stageId, starsEarned, score);
    }
    else {
        // Create new completion
        storageData.completions[stageId] = createCompletionRecord(stageId, stagePrefix, starsEarned, score);
        logger.info('Created new stage completion: stage=%s stars=%d score=%d', stageId, starsEarned, score);
    }
    // Write updated completions to storage
    nk.storageWrite([
        {
            collection: STAGE_COMPLETION_COLLECTION,
            key: userId,
            userId: userId,
            value: JSON.stringify(storageData),
        },
    ]);
    return result;
}
