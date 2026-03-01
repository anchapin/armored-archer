import { z } from "zod";

export const ZodSchemas = {
  health_check: z.object({}),
  
  get_player_stats: z.object({}),
  
  gain_xp: z.object({
    xp_amount: z.number().int().positive().max(1000000),
    source: z.enum(["pve", "pvp"])
  }),
  
  allocate_stats: z.object({
    stat_name: z.enum(["attack", "defense", "dodge", "crit_rate"]),
    points: z.number().int().positive().max(1000)
  }),
  
  generate_gear: z.object({
    stage_id: z.string().min(1).max(100),
    boss_defeated: z.boolean()
  }),
  
  equip_gear: z.object({
    gear_id: z.string().min(1).max(100),
    slot: z.enum(["weapon", "armor", "accessory"])
  }),
  
  unequip_gear: z.object({
    slot: z.enum(["weapon", "armor", "accessory"])
  }),
  
  get_inventory: z.object({}),
  
  unlock_modifier_pool: z.object({
    modifier_id: z.string().min(1).max(100)
  }),
  
  list_matches: z.object({
    match_type: z.enum(["ranked", "casual"]).optional(),
    min_rank: z.number().int().min(1).optional(),
    max_rank: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional()
  }).optional(),
  
  create_match: z.object({
    match_type: z.enum(["ranked", "casual"]),
    is_punch_up: z.boolean().optional(),
    target_opponent_id: z.string().min(1).max(100).optional()
  }),
  
  accept_match: z.object({
    match_id: z.string().min(1).max(100)
  }),
  
  get_player_rank: z.object({}),
  
  submit_combat_action: z.object({
    match_id: z.string().min(1).max(100),
    action_type: z.enum(["shoot"]),
    angle: z.number().min(-6.28318530718).max(6.28318530718),
    power: z.number().min(0).max(100).optional()
  }),
  
  get_match_state: z.object({
    match_id: z.string().min(1).max(100)
  }),
  
  get_season_info: z.object({}),
  
  get_leaderboard: z.object({
    limit: z.number().int().min(1).max(100).optional()
  }).optional(),
  
  update_rank: z.object({
    winner_id: z.string().min(1).max(100),
    loser_id: z.string().min(1).max(100),
    winner_old_rank: z.number().int(),
    loser_old_rank: z.number().int(),
    winner_new_rank: z.number().int(),
    loser_new_rank: z.number().int(),
    is_punch_up: z.boolean()
  }),
  
  get_season_rewards: z.object({}),
  
  claim_season_rewards: z.object({}),
  
  end_season: z.object({}),
  
  validate_purchase: z.object({
    product_id: z.enum(["com.armoredarcher.gems.small", "com.armoredarcher.gems.medium", "com.armoredarcher.gems.large"]),
    platform: z.enum(["ios", "android"]),
    transaction_receipt: z.string().min(1).max(100000)
  }),
  
  get_currency: z.object({}),
  
  spend_gems: z.object({
    amount: z.number().int().positive().max(1000000)
  })
} as const;

export type SchemaName = keyof typeof ZodSchemas;

export function validatePayload<T>(schema: z.ZodSchema<T>, payload: string, rpcName: string): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(payload);
    const result = schema.safeParse(parsed);
    
    if (!result.success) {
      const errorMessages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed for ${rpcName}: ${errorMessages}` };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: `Invalid JSON in ${rpcName}: ${error}` };
  }
}

export function createValidationErrorResponse(rpcName: string, error: string): string {
  return JSON.stringify({
    error: error,
    error_code: "VALIDATION_ERROR",
    rpc_name: rpcName
  });
}
