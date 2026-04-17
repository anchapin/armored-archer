import {
  object,
  number,
  string,
  boolean,
  enum as enumType,
  array,
  record,
  minValue,
  maxValue,
  minLength,
  maxLength,
  length,
  regex,
  optional,
  pipe,
  integer,
  safeParse,
  unknown,
} from 'valibot';

// Re-export valibot functions for use in other modules
export {
  object,
  number,
  string,
  boolean,
  array,
  record,
  minValue,
  maxValue,
  minLength,
  maxLength,
  length,
  regex,
  optional,
  pipe,
  integer,
  safeParse,
  unknown,
};

// Re-export enum with a different name to avoid reserved keyword conflict
export { enum as enumType } from 'valibot';

// Type assertion helper for enum schemas
function createEnum<T extends string>(values: readonly T[]): ReturnType<typeof enumType> {
  return enumType(values as any);
}

export const ValibotSchemas = {
  health_check: object({}),

  get_player_stats: object({}),

  // Stage completion schemas for PvE progression (with loot generation)
  complete_stage: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    stage_prefix: pipe(string(), minLength(1), maxLength(50)),
    stars_earned: pipe(number(), integer(), minValue(0), maxValue(3)),
    score: pipe(number(), integer(), minValue(0)),
    difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
    boss_defeated: optional(boolean()),
    boss_id: optional(pipe(string(), minLength(1), maxLength(100))),
  }),

  get_stage_completion: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  get_all_stage_completions: object({
    stage_prefix: optional(pipe(string(), minLength(1), maxLength(50))),
  }),

  gain_xp: object({
    xp_amount: pipe(number(), integer(), minValue(1), maxValue(1000000)),
    source: createEnum(['pve', 'pvp']),
  }),

  allocate_stats: object({
    stat_name: createEnum(['attack', 'defense', 'dodge', 'crit_rate']),
    points: pipe(number(), integer(), minValue(1), maxValue(1000)),
  }),

  respec_stats: object({
    new_allocation: object({
      attack: pipe(number(), integer(), minValue(0)),
      defense: pipe(number(), integer(), minValue(0)),
      dodge: pipe(number(), integer(), minValue(0)),
      crit_rate: pipe(number(), integer(), minValue(0)),
    }),
    use_free_respec: optional(boolean()),
  }),

  save_build: object({
    build_slot: pipe(number(), integer(), minValue(1), maxValue(3)),
    build_name: pipe(string(), minLength(1), maxLength(50)),
    stats: object({
      attack: pipe(number(), integer(), minValue(0)),
      defense: pipe(number(), integer(), minValue(0)),
      dodge: pipe(number(), integer(), minValue(0)),
      crit_rate: pipe(number(), integer(), minValue(0)),
    }),
    level: pipe(number(), integer(), minValue(1)),
  }),

  load_build: object({
    build_slot: pipe(number(), integer(), minValue(1), maxValue(3)),
  }),

  get_builds: object({}),

  generate_gear: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    boss_defeated: boolean(),
  }),

  // Stage completion with loot generation
  stage_complete: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    boss_defeated: boolean(),
    difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
    boss_id: optional(pipe(string(), minLength(1), maxLength(100))),
    enemy_type: optional(pipe(string(), minLength(1), maxLength(100))),
  }),

  equip_gear: object({
    gear_id: pipe(string(), minLength(1), maxLength(100)),
    slot: createEnum(['helm', 'armor', 'bow', 'arrow', 'amulet']),
  }),

  unequip_gear: object({
    slot: createEnum(['helm', 'armor', 'bow', 'arrow', 'amulet']),
  }),

  get_inventory: object({}),

  unlock_modifier_pool: object({
    modifier_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  get_unlocked_modifiers: object({}),

  list_matches: optional(
    object({
      match_type: optional(createEnum(['ranked', 'casual'])),
      min_rank: optional(pipe(number(), integer(), minValue(1))),
      max_rank: optional(pipe(number(), integer(), minValue(1))),
      limit: optional(pipe(number(), integer(), minValue(1), maxValue(100))),
    })
  ),

  create_match: object({
    match_type: createEnum(['ranked', 'casual']),
    is_punch_up: optional(boolean()),
    target_opponent_id: optional(pipe(string(), minLength(1), maxLength(100))),
  }),

  accept_match: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  get_player_rank: object({}),

  get_match_history: optional(
    object({
      match_type: optional(createEnum(['ranked', 'casual'])),
      limit: optional(pipe(number(), integer(), minValue(1), maxValue(100))),
      offset: optional(pipe(number(), integer(), minValue(0))),
      start_date: optional(string()), // ISO date string
      end_date: optional(string()), // ISO date string
    })
  ),

  get_match_details: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  admin_query_matches: optional(
    object({
      user_id: optional(pipe(string(), minLength(1))),
      match_type: optional(createEnum(['ranked', 'casual'])),
      end_reason: optional(createEnum(['health_zero', 'forfeit', 'timeout', 'disconnect'])),
      season_id: optional(string()),
      is_punch_up: optional(boolean()),
      start_date: optional(string()), // ISO date string
      end_date: optional(string()), // ISO date string
      limit: optional(pipe(number(), integer(), minValue(1), maxValue(200))),
      offset: optional(pipe(number(), integer(), minValue(0))),
    })
  ),
  join_pool: object({
    mode: createEnum(['1v1', '2v2']),
    rating: pipe(number(), integer(), minValue(1000), maxValue(3000)),
  }),

  leave_pool: object({
    mode: createEnum(['1v1', '2v2']),
  }),

  get_queue_status: object({
    mode: createEnum(['1v1', '2v2']),
  }),

  submit_combat_action: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    action_type: createEnum(['shoot']),
    angle: pipe(number(), minValue(0), maxValue(6.28318530718)),
    power: optional(pipe(number(), minValue(0), maxValue(1))),
    // Anti-cheat fields (optional for backward compatibility)
    requestId: optional(pipe(string(), minLength(32), maxLength(32))),
    timestamp: optional(number()),
    signature: optional(pipe(string(), minLength(64), maxLength(64))),
    nonce: optional(pipe(string(), minLength(32), maxLength(32))),
  }),

  get_match_state: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  player_disconnect: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    reason: optional(createEnum(['disconnect', 'voluntary', 'network_error'])),
  }),

  get_season_info: object({}),

  get_leaderboard: optional(
    object({
      limit: optional(pipe(number(), integer(), minValue(1), maxValue(100))),
    })
  ),

  update_rank: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    winner_id: pipe(string(), minLength(1), maxLength(100)),
    loser_id: pipe(string(), minLength(1), maxLength(100)),
    winner_old_rank: number(),
    loser_old_rank: number(),
    winner_new_rank: number(),
    loser_new_rank: number(),
    is_punch_up: boolean(),
    // Anti-cheat fields
    requestId: optional(string()),
    timestamp: optional(number()),
    signature: optional(string()),
    nonce: optional(string()),
  }),

  complete_match: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    winner_id: pipe(string(), minLength(1), maxLength(100)),
    loser_id: pipe(string(), minLength(1), maxLength(100)),
    is_punch_up: optional(boolean()),
    // Anti-cheat fields
    requestId: optional(string()),
    timestamp: optional(number()),
    signature: optional(string()),
    nonce: optional(string()),
  }),

  get_season_rewards: object({}),

  report_player: object({
    reported_user_id: pipe(string(), minLength(1), maxLength(100)),
    reason: createEnum([
      'win_trading',
      'match_manipulation',
      'suspicious_win_rate',
      'harassment',
      'exploiting_bugs',
      'other',
    ]),
    match_id: optional(pipe(string(), minLength(1), maxLength(100))),
    additional_info: optional(pipe(string(), maxLength(500))),
  }),

  get_player_reports: object({}),

  claim_season_rewards: object({}),

  end_season: object({}),

  get_season_history: optional(
    object({
      limit: optional(pipe(number(), integer(), minValue(1), maxValue(50))),
    })
  ),

  get_player_season_rank: optional(
    object({
      season_id: optional(string()),
    })
  ),

  get_player_cosmetics: object({}),

  validate_purchase: object({
    product_id: createEnum([
      'com.armoredarcher.gems.small',
      'com.armoredarcher.gems.medium',
      'com.armoredarcher.gems.large',
    ]),
    platform: createEnum(['ios', 'android']),
    transaction_receipt: pipe(string(), minLength(1), maxLength(100000)),
  }),

  get_currency: object({}),

  spend_gems: object({
    amount: pipe(number(), integer(), minValue(1), maxValue(1000000)),
  }),

  check_refunds: object({}),

  check_subscriptions: object({}),

  process_pending_purchases: object({}),

  app_launch_check: object({}),

  // Deployment observability
  deployment_record: object({
    environment: createEnum(['development', 'staging', 'production']),
    version: pipe(string(), minLength(1), maxLength(50)),
    status: createEnum(['started', 'success', 'failed', 'rollback']),
    metadata: optional(record(string(), string())),
  }),

  // Product Analytics
  track_event: object({
    event_name: pipe(string(), minLength(1), maxLength(100)),
    properties: optional(record(string(), unknown())),
    platform: optional(createEnum(['android', 'ios', 'web', 'desktop'])),
    session_id: optional(pipe(string(), maxLength(100))),
  }),

  get_analytics_summary: object({
    start_date: pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/)),
    end_date: pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/)),
    event_names: optional(array(string())),
  }),

  track_revenue: object({
    amount: pipe(number(), minValue(0)),
    currency: pipe(string(), length(3)),
    product_id: pipe(string(), minLength(1), maxLength(100)),
    transaction_id: pipe(string(), minLength(1), maxLength(100)),
    platform: optional(createEnum(['ios', 'android'])),
  }),

  // Progressive Rollout
  rollout_create_flag: object({
    name: pipe(string(), minLength(1), maxLength(100)),
    description: pipe(string(), maxLength(500)),
    phases: pipe(
      array(
        object({
          phase: createEnum(['disabled', 'canary', 'gradual', 'full']),
          percentage: pipe(number(), integer(), minValue(0), maxValue(100)),
          durationMinutes: pipe(number(), integer(), minValue(0)),
          minHealthPercent: pipe(number(), minValue(0), maxValue(100)),
          maxErrorRatePercent: pipe(number(), minValue(0), maxValue(100)),
          maxLatencyMs: pipe(number(), minValue(0)),
          sampleSize: pipe(number(), integer(), minValue(0)),
          autoPromote: boolean(),
          rollbackCriteria: object({
            errorRateThreshold: pipe(number(), minValue(0), maxValue(100)),
            latencyThreshold: pipe(number(), minValue(0)),
            healthCheckFails: pipe(number(), integer(), minValue(0)),
            customMetrics: optional(record(string(), number())),
          }),
        })
      ),
      minLength(1)
    ),
  }),

  rollout_update_flag: object({
    name: pipe(string(), minLength(1), maxLength(100)),
    description: optional(pipe(string(), maxLength(500))),
    enabled: optional(boolean()),
    rolloutPhase: optional(createEnum(['disabled', 'canary', 'gradual', 'full'])),
    rolloutPercentage: optional(pipe(number(), integer(), minValue(0), maxValue(100))),
    canaryUserIds: optional(array(string())),
    canaryVersionMin: optional(pipe(string(), maxLength(50))),
    canaryVersionMax: optional(pipe(string(), maxLength(50))),
  }),

  rollout_check: object({
    feature_name: pipe(string(), minLength(1), maxLength(100)),
    user_id: pipe(string(), minLength(1), maxLength(100)),
    game_version: optional(pipe(string(), maxLength(50))),
  }),

  rollout_advance: object({
    feature_name: pipe(string(), minLength(1), maxLength(100)),
  }),

  rollout_rollback: object({
    feature_name: pipe(string(), minLength(1), maxLength(100)),
  }),

  rollout_get_metrics: object({
    feature_name: pipe(string(), minLength(1), maxLength(100)),
  }),

  rollout_record_metrics: object({
    feature_name: pipe(string(), minLength(1), maxLength(100)),
    total_users: optional(pipe(number(), integer(), minValue(0))),
    active_users: optional(pipe(number(), integer(), minValue(0))),
    error_count: optional(pipe(number(), integer(), minValue(0))),
    error_rate: optional(pipe(number(), minValue(0))),
    avg_latency_ms: optional(pipe(number(), minValue(0))),
    p99_latency_ms: optional(pipe(number(), minValue(0))),
    health_check_passes: optional(pipe(number(), integer(), minValue(0))),
    health_check_fails: optional(pipe(number(), integer(), minValue(0))),
  }),

  // Privacy compliance schemas
  consent: object({
    analytics_consent: boolean(),
    marketing_consent: optional(boolean()),
    timestamp: pipe(number(), integer(), minValue(1)),
    version: optional(pipe(string(), maxLength(20))),
  }),

  data_deletion: object({
    user_id: pipe(string(), minLength(1), maxLength(100)),
    reason: optional(pipe(string(), maxLength(500))),
  }),

  data_export: object({
    user_id: pipe(string(), minLength(1), maxLength(100)),
    include_game_data: optional(boolean()),
    include_purchase_history: optional(boolean()),
  }),

  privacy_settings_update: object({
    analytics_enabled: optional(boolean()),
    marketing_enabled: optional(boolean()),
    data_retention_days: optional(pipe(number(), integer(), minValue(1), maxValue(730))),
  }),

  privacy_check: object({
    data: record(string(), unknown()),
    operation: createEnum(['store', 'persist', 'log', 'transmit', 'send', 'share', 'export']),
    context: optional(string()),
  }),

  pii_scan: object({
    text: pipe(string(), minLength(1), maxLength(100000)),
    types: optional(
      array(
        createEnum([
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
        ])
      )
    ),
  }),

  classify_data: object({
    data: record(string(), unknown()),
  }),

  // Weapon balance schemas
  apply_balance_adjustment: object({
    weapon_id: pipe(string(), minLength(1), maxLength(100)),
    multiplier: pipe(number(), minValue(0.1), maxValue(10.0)),
    reason: pipe(string(), minLength(1), maxLength(500)),
  }),

  get_balance_metrics: optional(
    object({
      weapon_id: optional(pipe(string(), minLength(1), maxLength(100))),
    })
  ),

  // Weapon usage tracking for balance tuning
  track_weapon_usage: object({
    weapon_id: pipe(string(), minLength(1), maxLength(100)),
    match_id: pipe(string(), minLength(1), maxLength(100)),
    match_result: createEnum(['win', 'loss']),
    rating_diff: number(),
  }),

  // Matchmaking analytics schemas
  log_match_data: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    timestamp: pipe(number(), integer(), minValue(0)),
    rating_diff: pipe(number(), integer(), minValue(0)),
    weapons: array(pipe(string(), minLength(1), maxLength(100))),
    duration: pipe(number(), minValue(0)),
  }),

  log_abandonment: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    reason: optional(pipe(string(), minLength(1), maxLength(500))),
    timestamp: pipe(number(), integer(), minValue(0)),
  }),

  log_weapon_result: object({
    weapon_id: pipe(string(), minLength(1), maxLength(100)),
    is_win: boolean(),
    timestamp: pipe(number(), integer(), minValue(0)),
  }),

  log_queue_time: object({
    queue_time: pipe(number(), minValue(0)),
    timestamp: pipe(number(), integer(), minValue(0)),
  }),

  // Fairness telemetry schemas
  hit_resolution: object({
    event_id: optional(pipe(string(), minLength(1), maxLength(100))),
    match_id: pipe(string(), minLength(1), maxLength(100)),
    timestamp: pipe(number(), integer(), minValue(0)),
    attacker_id: pipe(string(), minLength(1), maxLength(100)),
    defender_id: pipe(string(), minLength(1), maxLength(100)),
    hit: boolean(),
    damage: pipe(number(), integer(), minValue(0)),
    is_crit: boolean(),
    angle: pipe(number(), minValue(0), maxValue(6.28318530718)),
    power: optional(pipe(number(), minValue(0), maxValue(1))),
    attacker_health: pipe(number(), integer(), minValue(0)),
    defender_health: pipe(number(), integer(), minValue(0)),
    turn: pipe(number(), integer(), minValue(1)),
  }),

  disconnect_event: object({
    event_id: optional(pipe(string(), minLength(1), maxLength(100))),
    match_id: pipe(string(), minLength(1), maxLength(100)),
    timestamp: pipe(number(), integer(), minValue(0)),
    user_id: pipe(string(), minLength(1), maxLength(100)),
    opponent_id: pipe(string(), minLength(1), maxLength(100)),
    disconnect_reason: pipe(string(), minLength(1), maxLength(100)),
    match_status: pipe(string(), minLength(1), maxLength(50)),
    match_type: createEnum(['ranked', 'casual']),
    current_turn_user_id: pipe(string(), minLength(1), maxLength(100)),
    was_winning: optional(boolean()),
    health_before_disconnect: optional(pipe(number(), integer(), minValue(0))),
    opponent_health_before_disconnect: optional(pipe(number(), integer(), minValue(0))),
  }),

  timeout_event: object({
    event_id: optional(pipe(string(), minLength(1), maxLength(100))),
    match_id: pipe(string(), minLength(1), maxLength(100)),
    timestamp: pipe(number(), integer(), minValue(0)),
    timed_out_user_id: pipe(string(), minLength(1), maxLength(100)),
    opponent_id: pipe(string(), minLength(1), maxLength(100)),
    timeout_type: createEnum(['turn_timeout', 'match_timeout', 'consecutive_timeouts']),
    consecutive_timeouts: pipe(number(), integer(), minValue(0)),
    match_type: createEnum(['ranked', 'casual']),
    turn: pipe(number(), integer(), minValue(1)),
    turn_duration_ms: pipe(number(), integer(), minValue(0)),
  }),

  ranking_delta_event: object({
    event_id: optional(pipe(string(), minLength(1), maxLength(100))),
    match_id: pipe(string(), minLength(1), maxLength(100)),
    timestamp: pipe(number(), integer(), minValue(0)),
    winner_id: pipe(string(), minLength(1), maxLength(100)),
    loser_id: pipe(string(), minLength(1), maxLength(100)),
    winner_old_rank: pipe(number(), integer()),
    winner_new_rank: pipe(number(), integer()),
    winner_rank_change: pipe(number(), integer()),
    loser_old_rank: pipe(number(), integer()),
    loser_new_rank: pipe(number(), integer()),
    loser_rank_change: pipe(number(), integer()),
    match_type: createEnum(['ranked', 'casual']),
    is_punch_up: boolean(),
    winner_old_season_position: pipe(number(), integer(), minValue(0)),
    winner_new_season_position: pipe(number(), integer(), minValue(0)),
    loser_old_season_position: pipe(number(), integer(), minValue(0)),
    loser_new_season_position: pipe(number(), integer(), minValue(0)),
    season_id: pipe(string(), minLength(1), maxLength(50)),
  }),

  fairness_query: object({
    start_date: optional(pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/))),
    end_date: optional(pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/))),
    match_id: optional(pipe(string(), minLength(1), maxLength(100))),
    user_id: optional(pipe(string(), minLength(1), maxLength(100))),
    limit: optional(pipe(number(), integer(), minValue(1), maxValue(10000))),
  }),

  // Balance analytics schemas
  record_drop: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    stage_prefix: pipe(string(), minLength(1), maxLength(50)),
    difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
    boss_defeated: boolean(),
    gear_rarity: createEnum(['common', 'rare', 'epic', 'legendary']),
    gear_type: createEnum(['helm', 'armor', 'bow', 'arrow', 'amulet']),
    gear_id: pipe(string(), minLength(1), maxLength(200)),
    drop_rate_used: pipe(number(), minValue(0), maxValue(1)),
    roll_value: pipe(number(), minValue(0), maxValue(1)),
  }),

  record_stage_attempt: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    stage_prefix: pipe(string(), minLength(1), maxLength(50)),
    difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare', 'normal']),
    boss_defeated: boolean(),
    completed: boolean(),
    stars_earned: pipe(number(), integer(), minValue(0), maxValue(3)),
    score: pipe(number(), integer(), minValue(0)),
    attempt_number: pipe(number(), integer(), minValue(1)),
  }),

  get_balance_statistics: object({
    start_date: optional(pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/))),
    end_date: optional(pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/))),
  }),

  // Async duel lifecycle schemas
  submit_turn: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    action_type: createEnum(['shoot']),
    angle: pipe(number(), minValue(0), maxValue(6.28318530718)),
    power: optional(pipe(number(), minValue(0), maxValue(1))),
  }),

  forfeit_match: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  // Match replay schemas for debugging and QA
  get_match_replay: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
  }),

  list_match_replays: object({
    limit: optional(pipe(number(), minValue(1), maxValue(100))),
    offset: optional(pipe(number(), minValue(0))),
    match_type: optional(string()),
    qa_flagged_only: optional(boolean()),
    player_id: optional(string()),
    date_from: optional(string()),
    date_to: optional(string()),
  }),

  flag_match_for_qa: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    reason: pipe(string(), minLength(1), maxLength(1000)),
  }),

  add_debug_notes: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    notes: pipe(string(), minLength(1), maxLength(5000)),
  }),

  reconstruct_match_state: object({
    match_id: pipe(string(), minLength(1), maxLength(100)),
    turn: pipe(number(), minValue(1), maxValue(1000)),
  }),
} as const;

// Export with Zod-like names for backward compatibility
export const ZodSchemas = ValibotSchemas;

export type SchemaName = keyof typeof ValibotSchemas;

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

type AnySchema = any;

export function validatePayload<T = any>(
  schema: AnySchema,
  payload: string,
  rpcName: string
): ValidationResult<T> {
  try {
    let parsed: unknown;
    if (payload === '') {
      parsed = {};
    } else {
      parsed = JSON.parse(payload);
    }

    const result = safeParse(schema, parsed);

    if (!result.success) {
      interface ValibotIssue {
        path?: Array<{ key: string | number }> | undefined;
        message: string;
      }

      const errorMessages = result.issues
        .map(
          (issue: ValibotIssue) =>
            `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message}`
        )
        .join(', ');
      return { success: false, error: `Validation failed for ${rpcName}: ${errorMessages}` };
    }

    return { success: true, data: result.output as T };
  } catch (error) {
    return { success: false, error: `Invalid JSON in ${rpcName}: ${error}` };
  }
}

export function createValidationErrorResponse(rpcName: string, error: string): string {
  return JSON.stringify({
    success: false,
    error: error,
    error_code: 'VALIDATION_ERROR',
    rpc_name: rpcName,
  });
}
