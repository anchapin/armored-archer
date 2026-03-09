import { z } from 'zod';

export const ZodSchemas = {
  health_check: z.object({}),

  get_player_stats: z.object({}),

  gain_xp: z.object({
    xp_amount: z.number().int().positive().max(1000000),
    source: z.enum(['pve', 'pvp']),
  }),

  allocate_stats: z.object({
    stat_name: z.enum(['attack', 'defense', 'dodge', 'crit_rate']),
    points: z.number().int().positive().max(1000),
  }),

  generate_gear: z.object({
    stage_id: z.string().min(1).max(100),
    boss_defeated: z.boolean(),
  }),

  equip_gear: z.object({
    gear_id: z.string().min(1).max(100),
    slot: z.enum(['weapon', 'armor', 'accessory']),
  }),

  unequip_gear: z.object({
    slot: z.enum(['weapon', 'armor', 'accessory']),
  }),

  get_inventory: z.object({}),

  unlock_modifier_pool: z.object({
    modifier_id: z.string().min(1).max(100),
  }),

  list_matches: z
    .object({
      match_type: z.enum(['ranked', 'casual']).optional(),
      min_rank: z.number().int().min(1).optional(),
      max_rank: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .optional(),

  create_match: z.object({
    match_type: z.enum(['ranked', 'casual']),
    is_punch_up: z.boolean().optional(),
    target_opponent_id: z.string().min(1).max(100).optional(),
  }),

  accept_match: z.object({
    match_id: z.string().min(1).max(100),
  }),

  get_player_rank: z.object({}),

  submit_combat_action: z.object({
    match_id: z.string().min(1).max(100),
    action_type: z.enum(['shoot']),
    angle: z.number().min(0).max(6.28318530718), // 0 to 2π radians (0° to 360°)
    power: z.number().min(0).max(1).optional(), // Normalized 0.0-1.0

    // Anti-cheat fields (optional for backward compatibility)
    requestId: z.string().min(32).max(32).optional(),
    timestamp: z.number().int().min(0).optional(),
    signature: z.string().min(64).max(64).optional(),
    nonce: z.string().min(32).max(32).optional(),
  }),

  get_match_state: z.object({
    match_id: z.string().min(1).max(100),
  }),

  get_season_info: z.object({}),

  get_leaderboard: z
    .object({
      limit: z.number().int().min(1).max(100).optional(),
    })
    .optional(),

  update_rank: z.object({
    match_id: z.string().min(1).max(100),
    winner_id: z.string().min(1).max(100),
    loser_id: z.string().min(1).max(100),
    winner_old_rank: z.number().int(),
    loser_old_rank: z.number().int(),
    winner_new_rank: z.number().int(),
    loser_new_rank: z.number().int(),
    is_punch_up: z.boolean(),
    // Anti-cheat fields
    requestId: z.string().optional(),
    timestamp: z.number().optional(),
    signature: z.string().optional(),
    nonce: z.string().optional(),
  }),

  get_season_rewards: z.object({}),

  report_player: z.object({
    reported_user_id: z.string().min(1).max(100),
    reason: z.enum([
      'win_trading',
      'match_manipulation',
      'suspicious_win_rate',
      'harassment',
      'exploiting_bugs',
      'other',
    ]),
    match_id: z.string().min(1).max(100).optional(),
    additional_info: z.string().max(500).optional(),
  }),

  get_player_reports: z.object({}),

  claim_season_rewards: z.object({}),

  end_season: z.object({}),

  validate_purchase: z.object({
    product_id: z.enum([
      'com.armoredarcher.gems.small',
      'com.armoredarcher.gems.medium',
      'com.armoredarcher.gems.large',
    ]),
    platform: z.enum(['ios', 'android']),
    transaction_receipt: z.string().min(1).max(100000),
  }),

  get_currency: z.object({}),

  spend_gems: z.object({
    amount: z.number().int().positive().max(1000000),
  }),

  check_refunds: z.object({}),

  check_subscriptions: z.object({}),

  process_pending_purchases: z.object({}),

  app_launch_check: z.object({}),

  // Deployment observability
  deployment_record: z.object({
    environment: z.enum(['development', 'staging', 'production']),
    version: z.string().min(1).max(50),
    status: z.enum(['started', 'success', 'failed', 'rollback']),
    metadata: z.record(z.string(), z.string()).optional(),
  }),

  // Product Analytics
  track_event: z.object({
    event_name: z.string().min(1).max(100),
    properties: z.record(z.string(), z.unknown()).optional(),
    platform: z.enum(['android', 'ios', 'web', 'desktop']).optional(),
    session_id: z.string().max(100).optional(),
  }),

  get_analytics_summary: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event_names: z.array(z.string()).optional(),
  }),

  track_revenue: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
    product_id: z.string().min(1).max(100),
    transaction_id: z.string().min(1).max(100),
    platform: z.enum(['ios', 'android']).optional(),
  }),

  // Progressive Rollout
  rollout_create_flag: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    phases: z
      .array(
        z.object({
          phase: z.enum(['disabled', 'canary', 'gradual', 'full']),
          percentage: z.number().int().min(0).max(100),
          durationMinutes: z.number().int().min(0),
          minHealthPercent: z.number().min(0).max(100),
          maxErrorRatePercent: z.number().min(0).max(100),
          maxLatencyMs: z.number().min(0),
          sampleSize: z.number().int().min(0),
          autoPromote: z.boolean(),
          rollbackCriteria: z.object({
            errorRateThreshold: z.number().min(0).max(100),
            latencyThreshold: z.number().min(0),
            healthCheckFails: z.number().int().min(0),
            customMetrics: z.record(z.string(), z.number()).optional(),
          }),
        })
      )
      .min(1),
  }),

  rollout_update_flag: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional(),
    rolloutPhase: z.enum(['disabled', 'canary', 'gradual', 'full']).optional(),
    rolloutPercentage: z.number().int().min(0).max(100).optional(),
    canaryUserIds: z.array(z.string()).optional(),
    canaryVersionMin: z.string().max(50).optional(),
    canaryVersionMax: z.string().max(50).optional(),
  }),

  rollout_check: z.object({
    feature_name: z.string().min(1).max(100),
    user_id: z.string().min(1).max(100),
    game_version: z.string().max(50).optional(),
  }),

  rollout_advance: z.object({
    feature_name: z.string().min(1).max(100),
  }),

  rollout_rollback: z.object({
    feature_name: z.string().min(1).max(100),
  }),

  rollout_get_metrics: z.object({
    feature_name: z.string().min(1).max(100),
  }),

  rollout_record_metrics: z.object({
    feature_name: z.string().min(1).max(100),
    total_users: z.number().int().min(0).optional(),
    active_users: z.number().int().min(0).optional(),
    error_count: z.number().int().min(0).optional(),
    error_rate: z.number().min(0).optional(),
    avg_latency_ms: z.number().min(0).optional(),
    p99_latency_ms: z.number().min(0).optional(),
    health_check_passes: z.number().int().min(0).optional(),
    health_check_fails: z.number().int().min(0).optional(),
  }),

  // Privacy compliance schemas
  consent: z.object({
    analytics_consent: z.boolean(),
    marketing_consent: z.boolean().optional(),
    timestamp: z.number().int().positive(),
    version: z.string().max(20).optional(),
  }),

  data_deletion: z.object({
    user_id: z.string().min(1).max(100),
    reason: z.string().max(500).optional(),
  }),

  data_export: z.object({
    user_id: z.string().min(1).max(100),
    include_game_data: z.boolean().optional(),
    include_purchase_history: z.boolean().optional(),
  }),

  privacy_settings_update: z.object({
    analytics_enabled: z.boolean().optional(),
    marketing_enabled: z.boolean().optional(),
    data_retention_days: z.number().int().min(1).max(730).optional(),
  }),

  privacy_check: z.object({
    data: z.record(z.string(), z.unknown()),
    operation: z.enum(['store', 'persist', 'log', 'transmit', 'send', 'share', 'export']),
    context: z.string().optional(),
  }),

  pii_scan: z.object({
    text: z.string().min(1).max(100000),
    types: z.array(z.enum([
      'email', 'phone', 'ssn', 'credit_card', 'ip_address', 'device_id',
      'user_id', 'username', 'full_name', 'address', 'date_of_birth',
      'geolocation', 'password', 'auth_token', 'session_id'
    ])).optional(),
  }),

  classify_data: z.object({
    data: z.record(z.string(), z.unknown()),
  }),
} as const;

export type SchemaName = keyof typeof ZodSchemas;

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export function validatePayload<T>(
  schema: z.ZodSchema<T>,
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
    const result = schema.safeParse(parsed);

    if (!result.success) {
      const errorMessages = result.error.issues
        .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { success: false, error: `Validation failed for ${rpcName}: ${errorMessages}` };
    }

    return { success: true, data: result.data as T };
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
