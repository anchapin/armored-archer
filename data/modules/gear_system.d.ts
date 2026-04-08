/**
 * Gear System module.
 * @fileoverview Manages equipment generation, modification, and inventory.
 */
import { Runtime } from '../types/nakama';
/**
 * Gear rarity data structure.
 *
 * @property name - Display name of the rarity
 * @property stat_multiplier - Multiplier for base stats
 * @property drop_chance - Probability of dropping
 * @property color - Hex color code for UI display
 */
export interface GearRarity {
    name: string;
    stat_multiplier: number;
    drop_chance: number;
    color: string;
}
/**
 * Gear modifier data structure.
 *
 * @property id - Unique identifier for the modifier
 * @property name - Display name of the modifier
 * @property description - Description shown in UI
 * @property stat - Stat that this modifier affects
 * @property value_range - Range of possible values
 * @property rarity - Rarity level of the modifier
 * @property boss_unlock - Optional boss that unlocks this modifier
 */
export interface GearModifier {
    id: string;
    name: string;
    description: string;
    stat: string;
    value_range: [number, number];
    rarity: string;
    boss_unlock: string | null;
}
/**
 * Gear stat data structure.
 *
 * @property name - Name of the stat
 * @property base_value - Base value before multipliers
 * @property value - Final calculated value
 */
export interface GearStat {
    name: string;
    base_value: number;
    value: number;
}
/**
 * Gear item data structure.
 *
 * @property id - Unique identifier for the gear
 * @property name - Display name of the gear
 * @property rarity - Rarity level of the gear
 * @property type - Type of gear (helm, armor, bow, arrow, amulet)
 * @property stats - Array of gear stats
 * @property modifiers - Array of gear modifiers
 * @property level - Level of the gear
 * @property timestamp - Creation timestamp
 */
export interface GearItem {
    id: string;
    name: string;
    rarity: string;
    type: string;
    stats: GearStat[];
    modifiers: GearModifier[];
    level: number;
    timestamp: number;
}
/**
 * Request payload for generating gear.
 *
 * @property stage_id - ID of the stage where gear is being generated
 * @property boss_defeated - Whether a boss was defeated in this stage
 */
export interface GenerateGearRequest {
    stage_id: string;
    boss_defeated: boolean;
}
/**
 * Request payload for equipping gear.
 *
 * @property gear_id - ID of the gear to equip
 * @property slot - Equipment slot to equip into
 */
export interface EquipGearRequest {
    gear_id: string;
    slot: string;
}
/**
 * Request payload for unequipping gear.
 *
 * @property slot - Equipment slot to unequip from
 */
export interface UnequipGearRequest {
    slot: string;
}
/**
 * Player inventory data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property gear - Array of gear items in inventory
 * @property equipped_gear - Mapping of equipped gear by slot
 * @property unlocked_modifier_pools - List of unlocked modifier pools
 */
export interface PlayerInventory {
    user_id: string;
    gear: GearItem[];
    equipped_gear: {
        [slot: string]: string | null;
    };
    unlocked_modifier_pools: string[];
}
/**
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific boss.
 *
 * @param bossId - The ID of the defeated boss
 * @returns Array of modifier IDs unlocked by the boss
 */
export declare function getModifiersUnlockedByBoss(bossId: string): string[];
/**
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific enemy.
 *
 * @param enemyId - The ID of the defeated enemy
 * @returns Array of modifier IDs unlocked by the enemy
 */
export declare function getModifiersUnlockedByEnemy(enemyId: string): string[];
/**
 * Applies gear modifiers to a base stat value.
 *
 * @param baseValue - The base stat value before modifiers
 * @param modifiers - Array of gear modifiers to apply
 * @param statName - The name of the stat to modify
 * @returns The final stat value after applying all modifiers
 */
export declare function applyModifiersToStat(baseValue: number, modifiers: GearModifier[], statName: string): number;
/**
 * Applies all gear modifiers to gear stats.
 *
 * @param stats - Array of gear stats to modify
 * @param modifiers - Array of gear modifiers to apply
 * @returns Modified gear stats with applied modifiers
 */
export declare function applyModifiersToGearStats(stats: GearStat[], modifiers: GearModifier[]): GearStat[];
/**
 * Calculates total stat bonuses from all equipped gear modifiers.
 *
 * @param inventory - Player inventory containing equipped gear
 * @returns Object with stat name as key and total bonus as value
 */
export declare function getEquippedGearModifierBonuses(inventory: PlayerInventory): {
    [statName: string]: number;
};
/**
 * Applies equipped gear modifier bonuses to player stats.
 * This should be called in combat calculations to account for gear modifiers.
 *
 * @param baseStats - Base player stats
 * @param inventory - Player inventory with equipped gear
 * @returns Modified stats with gear bonuses applied
 */
export declare function applyGearModifiersToPlayerStats(baseStats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
}, inventory: PlayerInventory): {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
};
/**
 * Generates a gear item for stage completion rewards.
 * Exported for use by stage_tracking module.
 *
 * @param stageId - ID of the stage where gear is being generated
 * @param unlockedPools - List of unlocked modifier pools
 * @param logger - Nakama logger instance
 * @returns Generated gear item
 */
export declare function generateGearItem(stageId: string, unlockedPools: string[], logger: Runtime.Logger): GearItem;
/**
 * Registers the generate gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGenerateGear(initializer: Runtime.Initializer): void;
/**
 * Handles gear generation requests for players.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stage_id
 * @returns JSON string with generated gear and inventory
 *
 * @example
 * // Request payload
 * { "stage_id": "stage_123" }
 *
 * // Response
 * {
 *   "success": true,
 *   "gear": { ... },
 *   "inventory": { ... }
 * }
 */
export declare function rpcGenerateGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the equip gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcEquipGear(initializer: Runtime.Initializer): void;
/**
 * Handles equipping gear to a specific slot.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing gear_id and slot
 * @returns JSON string with updated equipment
 *
 * @example
 * // Request payload
 * { "gear_id": "gear_123", "slot": "helm" }
 *
 * // Response
 * {
 *   "success": true,
 *   "equipped_gear": { ... },
 *   "gear": { ... }
 * }
 */
export declare function rpcEquipGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the unequip gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcUnequipGear(initializer: Runtime.Initializer): void;
/**
 * Handles unequipping gear from a specific slot.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing slot
 * @returns JSON string with updated equipment
 *
 * @example
 * // Request payload
 * { "slot": "helm" }
 *
 * // Response
 * {
 *   "success": true,
 *   "equipped_gear": { ... }
 * }
 */
export declare function rpcUnequipGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get inventory RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetInventory(initializer: Runtime.Initializer): void;
/**
 * Retrieves a player's inventory and equipped gear.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with inventory data
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "gear": [ ... ],
 *   "equipped_gear": { ... },
 *   "unlocked_modifier_pools": [ ... ]
 * }
 */
/**
 * Retrieves player inventory from storage.
 * Exported for use by combat_system module.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Player inventory or default inventory if not found
 */
export declare function getPlayerInventory(nk: Runtime.Nakama, userId: string, logger: Runtime.Logger): PlayerInventory;
/**
 *
 */
export declare function rpcGetInventory(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the unlock modifier pool RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcUnlockModifierPool(initializer: Runtime.Initializer): void;
/**
 * Unlocks a modifier pool for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing modifier_id
 * @returns JSON string with updated unlocked pools
 *
 * @example
 * // Request payload
 * { "modifier_id": "piercing_arrow" }
 *
 * // Response
 * {
 *   "success": true,
 *   "unlocked_modifier_pools": [ ... ]
 * }
 */
export declare function rpcUnlockModifierPool(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Boss defeat tracking data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property defeats - Map of boss_id to defeat count
 * @property unlocked_modifiers - List of unlocked modifier IDs
 */
export interface BossDefeatData {
    user_id: string;
    defeats: {
        [bossId: string]: number;
    };
    unlocked_modifiers: string[];
}
/**
 * Registers the get unlocked modifiers RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetUnlockedModifiers(initializer: Runtime.Initializer): void;
/**
 * Retrieves all unlocked modifiers for a player.
 * This includes modifiers unlocked by defeating bosses and enemies.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with unlocked modifiers and boss defeat counts
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "unlocked_modifier_pools": ["piercing_arrow", "wind_fury"],
 *   "boss_defeats": {
 *     "boss_wind": 3,
 *     "boss_basic": 1
 *   }
 * }
 */
export declare function rpcGetUnlockedModifiers(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Records a boss defeat for a player and unlocks associated modifier pools.
 * This function is called when a player defeats a boss in PvE.
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param bossId - ID of the boss that was defeated
 * @returns Object containing defeat count and newly unlocked modifiers
 */
export declare function recordBossDefeat(nk: Runtime.Nakama, ctx: Runtime.Context, logger: Runtime.Logger, bossId: string): {
    defeat_count: number;
    newly_unlocked_modifiers: string[];
};
/**
 * Request payload for stage completion with loot generation.
 *
 * @property stage_id - ID of the completed stage
 * @property boss_defeated - Whether a boss was defeated
 * @property difficulty - Difficulty level of the stage
 * @property boss_id - ID of the boss defeated (if any)
 * @property enemy_type - Type of enemy defeated (for modifier unlock tracking)
 */
export interface StageCompleteRequest {
    stage_id: string;
    boss_defeated: boolean;
    difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
    boss_id?: string;
    enemy_type?: string;
}
/**
 * Result of loot generation.
 *
 * @property dropped - Whether loot was dropped
 * @property gear - The generated gear item (if dropped)
 */
export interface LootResult {
    dropped: boolean;
    gear: GearItem | null;
}
/**
 * Calculates the drop rate based on stage difficulty and boss defeat.
 *
 * @param difficulty - Stage difficulty level
 * @param bossDefeated - Whether a boss was defeated
 * @returns Calculated drop rate between 0 and 1
 */
export declare function calculateDropRate(difficulty: string, bossDefeated: boolean): number;
/**
 * Registers the stage complete RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcStageComplete(initializer: Runtime.Initializer): void;
/**
 * Handle stage completion RPC
 *
 * @param ctx - Runtime context
 * @param logger - Logger instance
 * @param nk - Nakama instance
 * @param payload - Request payload
 * @returns Stage completion response
 */
export declare function rpcStageComplete(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
