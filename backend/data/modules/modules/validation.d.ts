export declare const ValibotSchemas: {
    readonly health_check: import("valibot").ObjectSchema<{}, undefined>;
    readonly get_player_stats: import("valibot").ObjectSchema<{}, undefined>;
    readonly complete_stage: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly stage_prefix: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>;
        readonly stars_earned: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 3, undefined>]>;
        readonly score: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
        readonly difficulty: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly boss_defeated: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly boss_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly get_stage_completion: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_all_stage_completions: import("valibot").ObjectSchema<{
        readonly stage_prefix: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly gain_xp: import("valibot").ObjectSchema<{
        readonly xp_amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000000, undefined>]>;
        readonly source: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly allocate_stats: import("valibot").ObjectSchema<{
        readonly stat_name: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly points: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000, undefined>]>;
    }, undefined>;
    readonly generate_gear: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly boss_defeated: import("valibot").BooleanSchema<undefined>;
    }, undefined>;
    readonly stage_complete: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly boss_defeated: import("valibot").BooleanSchema<undefined>;
        readonly difficulty: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly boss_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
        readonly enemy_type: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly equip_gear: import("valibot").ObjectSchema<{
        readonly gear_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly slot: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly unequip_gear: import("valibot").ObjectSchema<{
        readonly slot: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly get_inventory: import("valibot").ObjectSchema<{}, undefined>;
    readonly unlock_modifier_pool: import("valibot").ObjectSchema<{
        readonly modifier_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_unlocked_modifiers: import("valibot").ObjectSchema<{}, undefined>;
    readonly list_matches: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly match_type: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly min_rank: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>, undefined>;
        readonly max_rank: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>, undefined>;
        readonly limit: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
    }, undefined>, undefined>;
    readonly create_match: import("valibot").ObjectSchema<{
        readonly match_type: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly is_punch_up: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly target_opponent_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly accept_match: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_player_rank: import("valibot").ObjectSchema<{}, undefined>;
    readonly submit_combat_action: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly action_type: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly angle: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 6.28318530718, undefined>]>;
        readonly power: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 1, undefined>]>, undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 32, undefined>, import("valibot").MaxLengthAction<string, 32, undefined>]>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 64, undefined>, import("valibot").MaxLengthAction<string, 64, undefined>]>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 32, undefined>, import("valibot").MaxLengthAction<string, 32, undefined>]>, undefined>;
    }, undefined>;
    readonly get_match_state: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly player_disconnect: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
    }, undefined>;
    readonly get_season_info: import("valibot").ObjectSchema<{}, undefined>;
    readonly get_leaderboard: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly limit: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
    }, undefined>, undefined>;
    readonly update_rank: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly loser_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_old_rank: import("valibot").NumberSchema<undefined>;
        readonly loser_old_rank: import("valibot").NumberSchema<undefined>;
        readonly winner_new_rank: import("valibot").NumberSchema<undefined>;
        readonly loser_new_rank: import("valibot").NumberSchema<undefined>;
        readonly is_punch_up: import("valibot").BooleanSchema<undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly complete_match: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly loser_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly is_punch_up: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly get_season_rewards: import("valibot").ObjectSchema<{}, undefined>;
    readonly report_player: import("valibot").ObjectSchema<{
        readonly reported_user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly match_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
        readonly additional_info: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
    }, undefined>;
    readonly get_player_reports: import("valibot").ObjectSchema<{}, undefined>;
    readonly claim_season_rewards: import("valibot").ObjectSchema<{}, undefined>;
    readonly end_season: import("valibot").ObjectSchema<{}, undefined>;
    readonly validate_purchase: import("valibot").ObjectSchema<{
        readonly product_id: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly platform: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly transaction_receipt: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100000, undefined>]>;
    }, undefined>;
    readonly get_currency: import("valibot").ObjectSchema<{}, undefined>;
    readonly spend_gems: import("valibot").ObjectSchema<{
        readonly amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000000, undefined>]>;
    }, undefined>;
    readonly check_refunds: import("valibot").ObjectSchema<{}, undefined>;
    readonly check_subscriptions: import("valibot").ObjectSchema<{}, undefined>;
    readonly process_pending_purchases: import("valibot").ObjectSchema<{}, undefined>;
    readonly app_launch_check: import("valibot").ObjectSchema<{}, undefined>;
    readonly deployment_record: import("valibot").ObjectSchema<{
        readonly environment: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly version: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>;
        readonly status: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly metadata: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").StringSchema<undefined>, undefined>, undefined>;
    }, undefined>;
    readonly track_event: import("valibot").ObjectSchema<{
        readonly event_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly properties: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>, undefined>;
        readonly platform: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly session_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly get_analytics_summary: import("valibot").ObjectSchema<{
        readonly start_date: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").RegexAction<string, undefined>]>;
        readonly end_date: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").RegexAction<string, undefined>]>;
        readonly event_names: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
    }, undefined>;
    readonly track_revenue: import("valibot").ObjectSchema<{
        readonly amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
        readonly currency: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").LengthAction<string, 3, undefined>]>;
        readonly product_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly transaction_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly platform: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
    }, undefined>;
    readonly rollout_create_flag: import("valibot").ObjectSchema<{
        readonly name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly description: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>;
        readonly phases: import("valibot").SchemaWithPipe<readonly [import("valibot").ArraySchema<import("valibot").ObjectSchema<{
            readonly phase: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
            readonly percentage: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly durationMinutes: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly minHealthPercent: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly maxErrorRatePercent: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly maxLatencyMs: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly sampleSize: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly autoPromote: import("valibot").BooleanSchema<undefined>;
            readonly rollbackCriteria: import("valibot").ObjectSchema<{
                readonly errorRateThreshold: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
                readonly latencyThreshold: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
                readonly healthCheckFails: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
                readonly customMetrics: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").NumberSchema<undefined>, undefined>, undefined>;
            }, undefined>;
        }, undefined>, undefined>, import("valibot").MinLengthAction<{
            phase: import("valibot").EnumValues<import("valibot").Enum>;
            percentage: number;
            durationMinutes: number;
            minHealthPercent: number;
            maxErrorRatePercent: number;
            maxLatencyMs: number;
            sampleSize: number;
            autoPromote: boolean;
            rollbackCriteria: {
                errorRateThreshold: number;
                latencyThreshold: number;
                healthCheckFails: number;
                customMetrics?: {
                    [x: string]: number;
                } | undefined;
            };
        }[], 1, undefined>]>;
    }, undefined>;
    readonly rollout_update_flag: import("valibot").ObjectSchema<{
        readonly name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly description: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
        readonly enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly rolloutPhase: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly rolloutPercentage: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
        readonly canaryUserIds: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
        readonly canaryVersionMin: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
        readonly canaryVersionMax: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly rollout_check: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly game_version: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly rollout_advance: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_rollback: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_get_metrics: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_record_metrics: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly total_users: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly active_users: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly error_count: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly error_rate: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly avg_latency_ms: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly p99_latency_ms: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly health_check_passes: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly health_check_fails: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
    }, undefined>;
    readonly consent: import("valibot").ObjectSchema<{
        readonly analytics_consent: import("valibot").BooleanSchema<undefined>;
        readonly marketing_consent: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>;
        readonly version: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 20, undefined>]>, undefined>;
    }, undefined>;
    readonly data_deletion: import("valibot").ObjectSchema<{
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
    }, undefined>;
    readonly data_export: import("valibot").ObjectSchema<{
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly include_game_data: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly include_purchase_history: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
    }, undefined>;
    readonly privacy_settings_update: import("valibot").ObjectSchema<{
        readonly analytics_enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly marketing_enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly data_retention_days: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 730, undefined>]>, undefined>;
    }, undefined>;
    readonly privacy_check: import("valibot").ObjectSchema<{
        readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
        readonly operation: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly context: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly pii_scan: import("valibot").ObjectSchema<{
        readonly text: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100000, undefined>]>;
        readonly types: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>, undefined>;
    }, undefined>;
    readonly classify_data: import("valibot").ObjectSchema<{
        readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
    }, undefined>;
};
export declare const ZodSchemas: {
    readonly health_check: import("valibot").ObjectSchema<{}, undefined>;
    readonly get_player_stats: import("valibot").ObjectSchema<{}, undefined>;
    readonly complete_stage: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly stage_prefix: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>;
        readonly stars_earned: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 3, undefined>]>;
        readonly score: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
        readonly difficulty: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly boss_defeated: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly boss_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly get_stage_completion: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_all_stage_completions: import("valibot").ObjectSchema<{
        readonly stage_prefix: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly gain_xp: import("valibot").ObjectSchema<{
        readonly xp_amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000000, undefined>]>;
        readonly source: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly allocate_stats: import("valibot").ObjectSchema<{
        readonly stat_name: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly points: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000, undefined>]>;
    }, undefined>;
    readonly generate_gear: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly boss_defeated: import("valibot").BooleanSchema<undefined>;
    }, undefined>;
    readonly stage_complete: import("valibot").ObjectSchema<{
        readonly stage_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly boss_defeated: import("valibot").BooleanSchema<undefined>;
        readonly difficulty: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly boss_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
        readonly enemy_type: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly equip_gear: import("valibot").ObjectSchema<{
        readonly gear_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly slot: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly unequip_gear: import("valibot").ObjectSchema<{
        readonly slot: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
    }, undefined>;
    readonly get_inventory: import("valibot").ObjectSchema<{}, undefined>;
    readonly unlock_modifier_pool: import("valibot").ObjectSchema<{
        readonly modifier_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_unlocked_modifiers: import("valibot").ObjectSchema<{}, undefined>;
    readonly list_matches: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly match_type: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly min_rank: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>, undefined>;
        readonly max_rank: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>, undefined>;
        readonly limit: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
    }, undefined>, undefined>;
    readonly create_match: import("valibot").ObjectSchema<{
        readonly match_type: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly is_punch_up: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly target_opponent_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly accept_match: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly get_player_rank: import("valibot").ObjectSchema<{}, undefined>;
    readonly submit_combat_action: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly action_type: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly angle: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 6.28318530718, undefined>]>;
        readonly power: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 1, undefined>]>, undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 32, undefined>, import("valibot").MaxLengthAction<string, 32, undefined>]>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 64, undefined>, import("valibot").MaxLengthAction<string, 64, undefined>]>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 32, undefined>, import("valibot").MaxLengthAction<string, 32, undefined>]>, undefined>;
    }, undefined>;
    readonly get_match_state: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly player_disconnect: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
    }, undefined>;
    readonly get_season_info: import("valibot").ObjectSchema<{}, undefined>;
    readonly get_leaderboard: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly limit: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
    }, undefined>, undefined>;
    readonly update_rank: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly loser_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_old_rank: import("valibot").NumberSchema<undefined>;
        readonly loser_old_rank: import("valibot").NumberSchema<undefined>;
        readonly winner_new_rank: import("valibot").NumberSchema<undefined>;
        readonly loser_new_rank: import("valibot").NumberSchema<undefined>;
        readonly is_punch_up: import("valibot").BooleanSchema<undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly complete_match: import("valibot").ObjectSchema<{
        readonly match_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly winner_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly loser_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly is_punch_up: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly requestId: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly signature: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly nonce: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly get_season_rewards: import("valibot").ObjectSchema<{}, undefined>;
    readonly report_player: import("valibot").ObjectSchema<{
        readonly reported_user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly match_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
        readonly additional_info: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
    }, undefined>;
    readonly get_player_reports: import("valibot").ObjectSchema<{}, undefined>;
    readonly claim_season_rewards: import("valibot").ObjectSchema<{}, undefined>;
    readonly end_season: import("valibot").ObjectSchema<{}, undefined>;
    readonly validate_purchase: import("valibot").ObjectSchema<{
        readonly product_id: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly platform: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly transaction_receipt: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100000, undefined>]>;
    }, undefined>;
    readonly get_currency: import("valibot").ObjectSchema<{}, undefined>;
    readonly spend_gems: import("valibot").ObjectSchema<{
        readonly amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 1000000, undefined>]>;
    }, undefined>;
    readonly check_refunds: import("valibot").ObjectSchema<{}, undefined>;
    readonly check_subscriptions: import("valibot").ObjectSchema<{}, undefined>;
    readonly process_pending_purchases: import("valibot").ObjectSchema<{}, undefined>;
    readonly app_launch_check: import("valibot").ObjectSchema<{}, undefined>;
    readonly deployment_record: import("valibot").ObjectSchema<{
        readonly environment: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly version: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>;
        readonly status: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly metadata: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").StringSchema<undefined>, undefined>, undefined>;
    }, undefined>;
    readonly track_event: import("valibot").ObjectSchema<{
        readonly event_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly properties: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>, undefined>;
        readonly platform: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly session_id: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>, undefined>;
    }, undefined>;
    readonly get_analytics_summary: import("valibot").ObjectSchema<{
        readonly start_date: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").RegexAction<string, undefined>]>;
        readonly end_date: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").RegexAction<string, undefined>]>;
        readonly event_names: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
    }, undefined>;
    readonly track_revenue: import("valibot").ObjectSchema<{
        readonly amount: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
        readonly currency: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").LengthAction<string, 3, undefined>]>;
        readonly product_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly transaction_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly platform: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
    }, undefined>;
    readonly rollout_create_flag: import("valibot").ObjectSchema<{
        readonly name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly description: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>;
        readonly phases: import("valibot").SchemaWithPipe<readonly [import("valibot").ArraySchema<import("valibot").ObjectSchema<{
            readonly phase: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
            readonly percentage: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly durationMinutes: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly minHealthPercent: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly maxErrorRatePercent: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
            readonly maxLatencyMs: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly sampleSize: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
            readonly autoPromote: import("valibot").BooleanSchema<undefined>;
            readonly rollbackCriteria: import("valibot").ObjectSchema<{
                readonly errorRateThreshold: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>;
                readonly latencyThreshold: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
                readonly healthCheckFails: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>;
                readonly customMetrics: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").NumberSchema<undefined>, undefined>, undefined>;
            }, undefined>;
        }, undefined>, undefined>, import("valibot").MinLengthAction<{
            phase: import("valibot").EnumValues<import("valibot").Enum>;
            percentage: number;
            durationMinutes: number;
            minHealthPercent: number;
            maxErrorRatePercent: number;
            maxLatencyMs: number;
            sampleSize: number;
            autoPromote: boolean;
            rollbackCriteria: {
                errorRateThreshold: number;
                latencyThreshold: number;
                healthCheckFails: number;
                customMetrics?: {
                    [x: string]: number;
                } | undefined;
            };
        }[], 1, undefined>]>;
    }, undefined>;
    readonly rollout_update_flag: import("valibot").ObjectSchema<{
        readonly name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly description: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
        readonly enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly rolloutPhase: import("valibot").OptionalSchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>;
        readonly rolloutPercentage: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>, import("valibot").MaxValueAction<number, 100, undefined>]>, undefined>;
        readonly canaryUserIds: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
        readonly canaryVersionMin: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
        readonly canaryVersionMax: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly rollout_check: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly game_version: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 50, undefined>]>, undefined>;
    }, undefined>;
    readonly rollout_advance: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_rollback: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_get_metrics: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
    }, undefined>;
    readonly rollout_record_metrics: import("valibot").ObjectSchema<{
        readonly feature_name: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly total_users: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly active_users: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly error_count: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly error_rate: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly avg_latency_ms: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly p99_latency_ms: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly health_check_passes: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
        readonly health_check_fails: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>;
    }, undefined>;
    readonly consent: import("valibot").ObjectSchema<{
        readonly analytics_consent: import("valibot").BooleanSchema<undefined>;
        readonly marketing_consent: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly timestamp: import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>]>;
        readonly version: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 20, undefined>]>, undefined>;
    }, undefined>;
    readonly data_deletion: import("valibot").ObjectSchema<{
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly reason: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MaxLengthAction<string, 500, undefined>]>, undefined>;
    }, undefined>;
    readonly data_export: import("valibot").ObjectSchema<{
        readonly user_id: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100, undefined>]>;
        readonly include_game_data: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly include_purchase_history: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
    }, undefined>;
    readonly privacy_settings_update: import("valibot").ObjectSchema<{
        readonly analytics_enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly marketing_enabled: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly data_retention_days: import("valibot").OptionalSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 1, undefined>, import("valibot").MaxValueAction<number, 730, undefined>]>, undefined>;
    }, undefined>;
    readonly privacy_check: import("valibot").ObjectSchema<{
        readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
        readonly operation: import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>;
        readonly context: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>;
    readonly pii_scan: import("valibot").ObjectSchema<{
        readonly text: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100000, undefined>]>;
        readonly types: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").EnumSchema<import("valibot").Enum, import("valibot").ErrorMessage<import("valibot").EnumIssue> | undefined>, undefined>, undefined>;
    }, undefined>;
    readonly classify_data: import("valibot").ObjectSchema<{
        readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
    }, undefined>;
};
export type SchemaName = keyof typeof ValibotSchemas;
export type ValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
type AnySchema = any;
export declare function validatePayload<T = any>(schema: AnySchema, payload: string, rpcName: string): ValidationResult<T>;
export declare function createValidationErrorResponse(rpcName: string, error: string): string;
export {};
