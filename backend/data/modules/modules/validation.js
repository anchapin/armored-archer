"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodSchemas = exports.ValibotSchemas = exports.enumType = exports.unknown = exports.safeParse = exports.integer = exports.pipe = exports.optional = exports.regex = exports.length = exports.maxLength = exports.minLength = exports.maxValue = exports.minValue = exports.record = exports.array = exports.boolean = exports.string = exports.number = exports.object = void 0;
exports.validatePayload = validatePayload;
exports.createValidationErrorResponse = createValidationErrorResponse;
const valibot_1 = require("valibot");
Object.defineProperty(exports, "object", { enumerable: true, get: function () { return valibot_1.object; } });
Object.defineProperty(exports, "number", { enumerable: true, get: function () { return valibot_1.number; } });
Object.defineProperty(exports, "string", { enumerable: true, get: function () { return valibot_1.string; } });
Object.defineProperty(exports, "boolean", { enumerable: true, get: function () { return valibot_1.boolean; } });
Object.defineProperty(exports, "array", { enumerable: true, get: function () { return valibot_1.array; } });
Object.defineProperty(exports, "record", { enumerable: true, get: function () { return valibot_1.record; } });
Object.defineProperty(exports, "minValue", { enumerable: true, get: function () { return valibot_1.minValue; } });
Object.defineProperty(exports, "maxValue", { enumerable: true, get: function () { return valibot_1.maxValue; } });
Object.defineProperty(exports, "minLength", { enumerable: true, get: function () { return valibot_1.minLength; } });
Object.defineProperty(exports, "maxLength", { enumerable: true, get: function () { return valibot_1.maxLength; } });
Object.defineProperty(exports, "length", { enumerable: true, get: function () { return valibot_1.length; } });
Object.defineProperty(exports, "regex", { enumerable: true, get: function () { return valibot_1.regex; } });
Object.defineProperty(exports, "optional", { enumerable: true, get: function () { return valibot_1.optional; } });
Object.defineProperty(exports, "pipe", { enumerable: true, get: function () { return valibot_1.pipe; } });
Object.defineProperty(exports, "integer", { enumerable: true, get: function () { return valibot_1.integer; } });
Object.defineProperty(exports, "safeParse", { enumerable: true, get: function () { return valibot_1.safeParse; } });
Object.defineProperty(exports, "unknown", { enumerable: true, get: function () { return valibot_1.unknown; } });
// Re-export enum with a different name to avoid reserved keyword conflict
var valibot_2 = require("valibot");
Object.defineProperty(exports, "enumType", { enumerable: true, get: function () { return valibot_2.enum; } });
// Type assertion helper for enum schemas
function createEnum(values) {
    return (0, valibot_1.enum)(values);
}
exports.ValibotSchemas = {
    health_check: (0, valibot_1.object)({}),
    get_player_stats: (0, valibot_1.object)({}),
    // Stage completion schemas for PvE progression (with loot generation)
    complete_stage: (0, valibot_1.object)({
        stage_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        stage_prefix: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(50)),
        stars_earned: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(3)),
        score: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
        boss_defeated: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        boss_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
    }),
    get_stage_completion: (0, valibot_1.object)({
        stage_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    get_all_stage_completions: (0, valibot_1.object)({
        stage_prefix: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(50))),
    }),
    gain_xp: (0, valibot_1.object)({
        xp_amount: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(1000000)),
        source: createEnum(['pve', 'pvp']),
    }),
    allocate_stats: (0, valibot_1.object)({
        stat_name: createEnum(['attack', 'defense', 'dodge', 'crit_rate']),
        points: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(1000)),
    }),
    respec_stats: (0, valibot_1.object)({
        new_allocation: (0, valibot_1.object)({
            attack: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            defense: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            dodge: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            crit_rate: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        }),
        use_free_respec: (0, valibot_1.optional)((0, valibot_1.boolean)()),
    }),
    save_build: (0, valibot_1.object)({
        build_slot: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(3)),
        build_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(50)),
        stats: (0, valibot_1.object)({
            attack: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            defense: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            dodge: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            crit_rate: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        }),
        level: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1)),
    }),
    load_build: (0, valibot_1.object)({
        build_slot: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(3)),
    }),
    get_builds: (0, valibot_1.object)({}),
    generate_gear: (0, valibot_1.object)({
        stage_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        boss_defeated: (0, valibot_1.boolean)(),
    }),
    // Stage completion with loot generation
    stage_complete: (0, valibot_1.object)({
        stage_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        boss_defeated: (0, valibot_1.boolean)(),
        difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
        boss_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
        enemy_type: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
    }),
    equip_gear: (0, valibot_1.object)({
        gear_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        slot: createEnum(['helm', 'armor', 'bow', 'arrow', 'amulet']),
    }),
    unequip_gear: (0, valibot_1.object)({
        slot: createEnum(['helm', 'armor', 'bow', 'arrow', 'amulet']),
    }),
    get_inventory: (0, valibot_1.object)({}),
    unlock_modifier_pool: (0, valibot_1.object)({
        modifier_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    get_unlocked_modifiers: (0, valibot_1.object)({}),
    list_matches: (0, valibot_1.optional)((0, valibot_1.object)({
        match_type: (0, valibot_1.optional)(createEnum(['ranked', 'casual'])),
        min_rank: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1))),
        max_rank: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1))),
        limit: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(100))),
    })),
    create_match: (0, valibot_1.object)({
        match_type: createEnum(['ranked', 'casual']),
        is_punch_up: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        target_opponent_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
    }),
    accept_match: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    get_player_rank: (0, valibot_1.object)({}),
    join_pool: (0, valibot_1.object)({
        mode: createEnum(['1v1', '2v2']),
        rating: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1000), (0, valibot_1.maxValue)(3000)),
    }),
    leave_pool: (0, valibot_1.object)({
        mode: createEnum(['1v1', '2v2']),
    }),
    get_queue_status: (0, valibot_1.object)({
        mode: createEnum(['1v1', '2v2']),
    }),
    submit_combat_action: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        action_type: createEnum(['shoot']),
        angle: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(6.28318530718)),
        power: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(1))),
        // Anti-cheat fields (optional for backward compatibility)
        requestId: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(32), (0, valibot_1.maxLength)(32))),
        timestamp: (0, valibot_1.optional)((0, valibot_1.number)()),
        signature: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(64), (0, valibot_1.maxLength)(64))),
        nonce: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(32), (0, valibot_1.maxLength)(32))),
    }),
    get_match_state: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    player_disconnect: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        reason: (0, valibot_1.optional)(createEnum(['disconnect', 'voluntary', 'network_error'])),
    }),
    get_season_info: (0, valibot_1.object)({}),
    get_leaderboard: (0, valibot_1.optional)((0, valibot_1.object)({
        limit: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(100))),
    })),
    update_rank: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        winner_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        loser_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        winner_old_rank: (0, valibot_1.number)(),
        loser_old_rank: (0, valibot_1.number)(),
        winner_new_rank: (0, valibot_1.number)(),
        loser_new_rank: (0, valibot_1.number)(),
        is_punch_up: (0, valibot_1.boolean)(),
        // Anti-cheat fields
        requestId: (0, valibot_1.optional)((0, valibot_1.string)()),
        timestamp: (0, valibot_1.optional)((0, valibot_1.number)()),
        signature: (0, valibot_1.optional)((0, valibot_1.string)()),
        nonce: (0, valibot_1.optional)((0, valibot_1.string)()),
    }),
    complete_match: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        winner_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        loser_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        is_punch_up: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        // Anti-cheat fields
        requestId: (0, valibot_1.optional)((0, valibot_1.string)()),
        timestamp: (0, valibot_1.optional)((0, valibot_1.number)()),
        signature: (0, valibot_1.optional)((0, valibot_1.string)()),
        nonce: (0, valibot_1.optional)((0, valibot_1.string)()),
    }),
    get_season_rewards: (0, valibot_1.object)({}),
    report_player: (0, valibot_1.object)({
        reported_user_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        reason: createEnum([
            'win_trading',
            'match_manipulation',
            'suspicious_win_rate',
            'harassment',
            'exploiting_bugs',
            'other',
        ]),
        match_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
        additional_info: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(500))),
    }),
    get_player_reports: (0, valibot_1.object)({}),
    claim_season_rewards: (0, valibot_1.object)({}),
    end_season: (0, valibot_1.object)({}),
    validate_purchase: (0, valibot_1.object)({
        product_id: createEnum([
            'com.armoredarcher.gems.small',
            'com.armoredarcher.gems.medium',
            'com.armoredarcher.gems.large',
        ]),
        platform: createEnum(['ios', 'android']),
        transaction_receipt: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100000)),
    }),
    get_currency: (0, valibot_1.object)({}),
    spend_gems: (0, valibot_1.object)({
        amount: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(1000000)),
    }),
    check_refunds: (0, valibot_1.object)({}),
    check_subscriptions: (0, valibot_1.object)({}),
    process_pending_purchases: (0, valibot_1.object)({}),
    app_launch_check: (0, valibot_1.object)({}),
    // Deployment observability
    deployment_record: (0, valibot_1.object)({
        environment: createEnum(['development', 'staging', 'production']),
        version: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(50)),
        status: createEnum(['started', 'success', 'failed', 'rollback']),
        metadata: (0, valibot_1.optional)((0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.string)())),
    }),
    // Product Analytics
    track_event: (0, valibot_1.object)({
        event_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        properties: (0, valibot_1.optional)((0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.unknown)())),
        platform: (0, valibot_1.optional)(createEnum(['android', 'ios', 'web', 'desktop'])),
        session_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(100))),
    }),
    get_analytics_summary: (0, valibot_1.object)({
        start_date: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.regex)(/^\d{4}-\d{2}-\d{2}$/)),
        end_date: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.regex)(/^\d{4}-\d{2}-\d{2}$/)),
        event_names: (0, valibot_1.optional)((0, valibot_1.array)((0, valibot_1.string)())),
    }),
    track_revenue: (0, valibot_1.object)({
        amount: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        currency: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.length)(3)),
        product_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        transaction_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        platform: (0, valibot_1.optional)(createEnum(['ios', 'android'])),
    }),
    // Progressive Rollout
    rollout_create_flag: (0, valibot_1.object)({
        name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        description: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(500)),
        phases: (0, valibot_1.pipe)((0, valibot_1.array)((0, valibot_1.object)({
            phase: createEnum(['disabled', 'canary', 'gradual', 'full']),
            percentage: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100)),
            durationMinutes: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            minHealthPercent: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100)),
            maxErrorRatePercent: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100)),
            maxLatencyMs: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
            sampleSize: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            autoPromote: (0, valibot_1.boolean)(),
            rollbackCriteria: (0, valibot_1.object)({
                errorRateThreshold: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100)),
                latencyThreshold: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
                healthCheckFails: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
                customMetrics: (0, valibot_1.optional)((0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.number)())),
            }),
        })), (0, valibot_1.minLength)(1)),
    }),
    rollout_update_flag: (0, valibot_1.object)({
        name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        description: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(500))),
        enabled: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        rolloutPhase: (0, valibot_1.optional)(createEnum(['disabled', 'canary', 'gradual', 'full'])),
        rolloutPercentage: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100))),
        canaryUserIds: (0, valibot_1.optional)((0, valibot_1.array)((0, valibot_1.string)())),
        canaryVersionMin: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(50))),
        canaryVersionMax: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(50))),
    }),
    rollout_check: (0, valibot_1.object)({
        feature_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        user_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        game_version: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(50))),
    }),
    rollout_advance: (0, valibot_1.object)({
        feature_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    rollout_rollback: (0, valibot_1.object)({
        feature_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    rollout_get_metrics: (0, valibot_1.object)({
        feature_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
    }),
    rollout_record_metrics: (0, valibot_1.object)({
        feature_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        total_users: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0))),
        active_users: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0))),
        error_count: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0))),
        error_rate: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0))),
        avg_latency_ms: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0))),
        p99_latency_ms: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0))),
        health_check_passes: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0))),
        health_check_fails: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0))),
    }),
    // Privacy compliance schemas
    consent: (0, valibot_1.object)({
        analytics_consent: (0, valibot_1.boolean)(),
        marketing_consent: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        timestamp: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1)),
        version: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(20))),
    }),
    data_deletion: (0, valibot_1.object)({
        user_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        reason: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.maxLength)(500))),
    }),
    data_export: (0, valibot_1.object)({
        user_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        include_game_data: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        include_purchase_history: (0, valibot_1.optional)((0, valibot_1.boolean)()),
    }),
    privacy_settings_update: (0, valibot_1.object)({
        analytics_enabled: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        marketing_enabled: (0, valibot_1.optional)((0, valibot_1.boolean)()),
        data_retention_days: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(730))),
    }),
    privacy_check: (0, valibot_1.object)({
        data: (0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.unknown)()),
        operation: createEnum(['store', 'persist', 'log', 'transmit', 'send', 'share', 'export']),
        context: (0, valibot_1.optional)((0, valibot_1.string)()),
    }),
    pii_scan: (0, valibot_1.object)({
        text: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100000)),
        types: (0, valibot_1.optional)((0, valibot_1.array)(createEnum([
            'email',
            'phone',
            'ssn',
            'credit_card',
            'ip_address',
            'device_id',
            'user_id',
            'username',
            'full_name',
            'address',
            'date_of_birth',
            'geolocation',
            'password',
            'auth_token',
            'session_id',
        ]))),
    }),
    classify_data: (0, valibot_1.object)({
        data: (0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.unknown)()),
    }),
    // Weapon balance schemas
    apply_balance_adjustment: (0, valibot_1.object)({
        weapon_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        multiplier: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0.1), (0, valibot_1.maxValue)(10.0)),
        reason: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(500)),
    }),
    get_balance_metrics: (0, valibot_1.optional)((0, valibot_1.object)({
        weapon_id: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
    })),
    // Weapon usage tracking for balance tuning
    track_weapon_usage: (0, valibot_1.object)({
        weapon_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        match_result: createEnum(['win', 'loss']),
        rating_diff: (0, valibot_1.number)(),
    }),
    // Matchmaking analytics schemas
    log_match_data: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        timestamp: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        rating_diff: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        weapons: (0, valibot_1.array)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100))),
        duration: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
    }),
    log_abandonment: (0, valibot_1.object)({
        match_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        reason: (0, valibot_1.optional)((0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(500))),
        timestamp: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
    }),
    log_weapon_result: (0, valibot_1.object)({
        weapon_id: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100)),
        is_win: (0, valibot_1.boolean)(),
        timestamp: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
    }),
    log_queue_time: (0, valibot_1.object)({
        queue_time: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        timestamp: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
    }),
};
// Export with Zod-like names for backward compatibility
exports.ZodSchemas = exports.ValibotSchemas;
function validatePayload(schema, payload, rpcName) {
    try {
        let parsed;
        if (payload === '') {
            parsed = {};
        }
        else {
            parsed = JSON.parse(payload);
        }
        const result = (0, valibot_1.safeParse)(schema, parsed);
        if (!result.success) {
            const errorMessages = result.issues
                .map((issue) => `${issue.path?.map((p) => p.key).join('.') || 'root'}: ${issue.message}`)
                .join(', ');
            return { success: false, error: `Validation failed for ${rpcName}: ${errorMessages}` };
        }
        return { success: true, data: result.output };
    }
    catch (error) {
        return { success: false, error: `Invalid JSON in ${rpcName}: ${error}` };
    }
}
function createValidationErrorResponse(rpcName, error) {
    return JSON.stringify({
        success: false,
        error: error,
        error_code: 'VALIDATION_ERROR',
        rpc_name: rpcName,
    });
}
