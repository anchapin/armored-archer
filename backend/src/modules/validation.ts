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

// Type assertion helper for enum schemas
function createEnum<T extends string>(values: readonly T[]): ReturnType<typeof enumType> {
  return enumType(values as any);
}

export const ValibotSchemas = {
  health_check: object({}),

  get_player_stats: object({}),

  // Stage completion schemas for PvE progression
  complete_stage: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    stage_prefix: pipe(string(), minLength(1), maxLength(50)),
    stars_earned: pipe(number(), integer(), minValue(0), maxValue(3)),
    score: pipe(number(), integer(), minValue(0)),
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

  generate_gear: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    boss_defeated: boolean(),
  }),

  // Stage completion with loot generation
  stage_complete: object({
    stage_id: pipe(string(), minLength(1), maxLength(100)),
    boss_defeated: boolean(),
    difficulty: createEnum(['easy', 'medium', 'hard', 'nightmare']),
  }),

  equip_gear: object({
    gear_id: pipe(string(), minLength(1), maxLength(100)),
    slot: createEnum(['weapon', 'armor', 'accessory']),
  }),

  unequip_gear: object({
    slot: createEnum(['weapon', 'armor', 'accessory']),
  }),

  get_inventory: object({}),

  unlock_modifier_pool: object({
    modifier_id: pipe(string(), minLength(1), maxLength(100)),
  }),

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
} as const;

// Export with Zod-like names for backward compatibility
export const ZodSchemas = ValibotSchemas;

export type SchemaName = keyof typeof ValibotSchemas;

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const errorMessages = result.issues
        .map(
          (issue: any) =>
            `${issue.path?.map((p: any) => p.key).join('.') || 'root'}: ${issue.message}`
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
