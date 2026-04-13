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
var tslib_1 = require("tslib");
var audit_1 = require("./audit");
var gear_system_1 = require("./gear_system");
var validation_1 = require("./validation");
/**
 * Storage collection name for stage completions.
 */
var STAGE_COMPLETION_COLLECTION = 'stage_completion';
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
    var now = new Date().toISOString();
    return {
        id: '',
        user_id: '',
        stage_id: stageId,
        stage_prefix: stagePrefix,
        stars_earned: starsEarned,
        score: score,
        completed_at: now,
        updated_at: now,
    };
}
/**
 * Updates an existing completion record
 */
function updateCompletionRecord(stageId, stagePrefix, starsEarned, score, existingCompletion) {
    return tslib_1.__assign(tslib_1.__assign({}, existingCompletion), { stage_id: stageId, stage_prefix: stagePrefix, stars_earned: starsEarned, score: score, updated_at: new Date().toISOString() });
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
    var _a, _b, _c;
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
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.complete_stage, payload, 'complete_stage');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'complete_stage', 'stage_completion', { stage_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('complete_stage', validation.error);
    }
    var request = validation.data;
    var stage_id = request.stage_id, stage_prefix = request.stage_prefix, stars_earned = request.stars_earned, score = request.score;
    logger.info('Processing stage completion: user=%s stage=%s stars=%d score=%d', ctx.userId, stage_id, stars_earned, score);
    try {
        // Read and process stage completion data
        var completionResult = readAndProcessStageCompletion(nk, ctx.userId, stage_id, stage_prefix, stars_earned, score, logger);
        // Handle case where replay didn't improve
        if (completionResult.noImprovement) {
            return JSON.stringify({
                success: true,
                stage_id: stage_id,
                stars_earned: completionResult.existingCompletion.stars_earned,
                score: completionResult.existingCompletion.score,
                is_new_completion: false,
                previous_best: completionResult.previousBest,
                message: 'No improvement over previous completion',
            });
        }
        var isNewCompletion = completionResult.isNewCompletion;
        var previousBest = completionResult.previousBest;
        // Server-side loot generation (only if difficulty is provided)
        var lootResult = { dropped: false, gear: null };
        var dropRate = 0;
        var unlockedModifierPools = [];
        if (request.difficulty) {
            // Process loot generation
            var lootProcessingResult = processStageLoot(nk, ctx.userId, request, stage_id, logger);
            lootResult.dropped = lootProcessingResult.lootResult.dropped;
            lootResult.gear = lootProcessingResult.lootResult.gear;
            dropRate = lootProcessingResult.dropRate;
            unlockedModifierPools = lootProcessingResult.unlockedModifierPools;
        }
        // Log audit event
        (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'complete_stage', 'stage_completion', { stage_id: stage_id, stage_prefix: stage_prefix, stars_earned: stars_earned, score: score }, isNewCompletion ? 'success' : 'success', isNewCompletion ? 'New completion' : 'Updated completion');
        var response = {
            success: true,
            stage_id: stage_id,
            stars_earned: stars_earned,
            score: score,
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
        (0, audit_1.logAudit)(nk, ctx.userId, (_c = ctx.ipAddress) !== null && _c !== void 0 ? _c : null, 'complete_stage', 'stage_completion', { stage_id: stage_id }, 'failure', String(error));
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
    var request = {};
    if (payload && payload.trim()) {
        var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_all_stage_completions, payload, 'get_completed_stages');
        if (!validation.success) {
            return (0, validation_1.createValidationErrorResponse)('get_completed_stages', validation.error);
        }
        request = validation.data;
    }
    try {
        // Read stage completions from storage
        var storageObjects = nk.storageRead([
            {
                collection: STAGE_COMPLETION_COLLECTION,
                key: ctx.userId,
                userId: ctx.userId,
            },
        ]);
        var storageData = {
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
        var completions = Object.values(storageData.completions);
        if (request.stage_prefix) {
            completions = completions.filter(function (c) { return c.stage_prefix === request.stage_prefix; });
        }
        // Sort by completion date (most recent first)
        completions.sort(function (a, b) { return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(); });
        logger.info('Retrieved %d completed stages for user: %s (filter: %s)', completions.length, ctx.userId, request.stage_prefix || 'none');
        return JSON.stringify({
            success: true,
            stages: completions.map(function (c) { return ({
                stage_id: c.stage_id,
                stage_prefix: c.stage_prefix,
                stars_earned: c.stars_earned,
                score: c.score,
                completed_at: c.completed_at,
            }); }),
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
    var parts = stageId.split('_');
    if (parts.length !== 2)
        return null;
    var chapter = parts[0];
    var stageNum = parseInt(parts[1], 10);
    if (isNaN(stageNum))
        return null;
    return "".concat(chapter, "_").concat(stageNum + 1);
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
function rpcGetCampaignProgress(ctx, logger, nk, payload) {
    var e_1, _a;
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
        var storageObjects = nk.storageRead([
            {
                collection: STAGE_COMPLETION_COLLECTION,
                key: ctx.userId,
                userId: ctx.userId,
            },
        ]);
        var storageData = {
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
        var completedStages = Object.keys(storageData.completions);
        // Derive unlocked_stages: for each completed stage, the next stage is unlocked
        var unlockedSet = new Set();
        try {
            for (var completedStages_1 = tslib_1.__values(completedStages), completedStages_1_1 = completedStages_1.next(); !completedStages_1_1.done; completedStages_1_1 = completedStages_1.next()) {
                var stageId = completedStages_1_1.value;
                var nextStage = deriveNextStageId(stageId);
                if (nextStage) {
                    unlockedSet.add(nextStage);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (completedStages_1_1 && !completedStages_1_1.done && (_a = completedStages_1.return)) _a.call(completedStages_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Always ensure first stage is available
        unlockedSet.add('1_1');
        var unlockedStages = Array.from(unlockedSet);
        // Extract bosses defeated from completions (boss stages typically have boss data)
        // We read from the gear_system inventory for boss defeats
        var bossesDefeated = [];
        try {
            var inventoryObjects = nk.storageRead([
                {
                    collection: 'player_inventory',
                    key: ctx.userId,
                    userId: ctx.userId,
                },
            ]);
            if (inventoryObjects.length > 0 && inventoryObjects[0].value) {
                var inventory = JSON.parse(inventoryObjects[0].value);
                if (Array.isArray(inventory.unlocked_modifier_pools)) {
                    // Modifier pools unlocked by bosses indicate boss defeats
                    bossesDefeated.push.apply(bossesDefeated, tslib_1.__spreadArray([], tslib_1.__read(inventory.unlocked_modifier_pools), false));
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
    var e_2, _a;
    var _b, _c, _d, _e, _f;
    var lootResult = {
        lootResult: { dropped: false, gear: null },
        dropRate: 0,
        unlockedModifierPools: [],
    };
    // Calculate drop rate server-side
    lootResult.dropRate = (0, gear_system_1.calculateDropRate)(request.difficulty, request.boss_defeated || false);
    var roll = Math.random();
    logger.info('Loot roll for user %s: roll=%f, dropRate=%f, difficulty=%s, bossDefeated=%s', userId, roll, lootResult.dropRate, request.difficulty, request.boss_defeated);
    // Get player inventory using helper function
    var inventory = (0, gear_system_1.getPlayerInventory)(nk, userId, logger);
    // Unlock modifier pools when boss is defeated
    if (request.boss_defeated && request.boss_id) {
        var modifiersToUnlock = (0, gear_system_1.getModifiersUnlockedByBoss)(request.boss_id);
        try {
            for (var modifiersToUnlock_1 = tslib_1.__values(modifiersToUnlock), modifiersToUnlock_1_1 = modifiersToUnlock_1.next(); !modifiersToUnlock_1_1.done; modifiersToUnlock_1_1 = modifiersToUnlock_1.next()) {
                var modifierId = modifiersToUnlock_1_1.value;
                if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
                    inventory.unlocked_modifier_pools.push(modifierId);
                    logger.info('Unlocked modifier pool %s for user %s after defeating boss %s', modifierId, userId, request.boss_id);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (modifiersToUnlock_1_1 && !modifiersToUnlock_1_1.done && (_a = modifiersToUnlock_1.return)) _a.call(modifiersToUnlock_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    lootResult.unlockedModifierPools = inventory.unlocked_modifier_pools;
    // Roll for loot
    if (roll < lootResult.dropRate) {
        var gear = (0, gear_system_1.generateGearItem)(stageId, inventory.unlocked_modifier_pools, logger);
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
        boss_id: (_b = request.boss_id) !== null && _b !== void 0 ? _b : null,
        loot_dropped: lootResult.lootResult.dropped,
        loot_gear_id: (_d = (_c = lootResult.lootResult.gear) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null,
        loot_gear_rarity: (_f = (_e = lootResult.lootResult.gear) === null || _e === void 0 ? void 0 : _e.rarity) !== null && _f !== void 0 ? _f : null,
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
    var storageObjects = nk.storageRead([
        {
            collection: STAGE_COMPLETION_COLLECTION,
            key: userId,
            userId: userId,
        },
    ]);
    var storageData = {
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
    var existingCompletion = storageData.completions[stageId];
    var result = {
        storageData: storageData,
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
