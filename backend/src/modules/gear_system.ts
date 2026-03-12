/**
 * Gear System module.
 * @fileoverview Manages equipment generation, modification, and inventory.
 */

import { Runtime } from '../types/nakama';
import { getCacheManager } from '../utils/cache';
import { safeParse, createErrorResponse } from '../utils/safeParse';
import { logAudit } from './audit';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

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
 * @property type - Type of gear (weapon, armor, accessory)
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
  equipped_gear: { [slot: string]: string | null };
  unlocked_modifier_pools: string[];
}

const RARITIES: { [key: string]: GearRarity } = {
  common: {
    name: 'Common',
    stat_multiplier: 1.0,
    drop_chance: 0.7,
    color: '#ffffff',
  },
  rare: {
    name: 'Rare',
    stat_multiplier: 1.5,
    drop_chance: 0.25,
    color: '#0070dd',
  },
  legendary: {
    name: 'Legendary',
    stat_multiplier: 2.0,
    drop_chance: 0.05,
    color: '#ff8000',
  },
};

const GEAR_TYPES = ['weapon', 'armor', 'accessory'];

const BASE_STATS = {
  weapon: [
    { name: 'attack', base_value: 10 },
    { name: 'crit_rate', base_value: 5 },
  ],
  armor: [
    { name: 'defense', base_value: 10 },
    { name: 'health', base_value: 50 },
  ],
  accessory: [
    { name: 'dodge', base_value: 5 },
    { name: 'crit_rate', base_value: 3 },
  ],
};

const MODIFIER_POOLS: GearModifier[] = [
  {
    id: 'piercing_arrow',
    name: 'Piercing Arrow',
    description: 'Arrows penetrate through enemies',
    stat: 'attack',
    value_range: [5, 10],
    rarity: 'rare',
    boss_unlock: 'boss_wind',
  },
  {
    id: 'heavy_impact',
    name: 'Heavy Impact',
    description: 'Increased knockback on hit',
    stat: 'attack',
    value_range: [8, 15],
    rarity: 'rare',
    boss_unlock: 'boss_basic',
  },
  {
    id: 'vitality_boost',
    name: 'Vitality Boost',
    description: 'Increased maximum health',
    stat: 'health',
    value_range: [20, 40],
    rarity: 'common',
    boss_unlock: null,
  },
  {
    id: 'wind_fury',
    name: 'Wind Fury',
    description: 'Attack speed increased',
    stat: 'attack',
    value_range: [10, 20],
    rarity: 'legendary',
    boss_unlock: 'boss_wind',
  },
  {
    id: 'fortification',
    name: 'Fortification',
    description: 'Damage reduction',
    stat: 'defense',
    value_range: [5, 12],
    rarity: 'common',
    boss_unlock: null,
  },
];

/**
 * Maps boss IDs to their unlocked modifier pool IDs.
 * When a boss is defeated, all modifiers associated with that boss are unlocked.
 */
const BOSS_MODIFIER_UNLOCKS: { [bossId: string]: string[] } = {
  boss_basic: ['heavy_impact'],
  boss_wind: ['piercing_arrow', 'wind_fury'],
};

/**
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific boss.
 *
 * @param bossId - The ID of the defeated boss
 * @returns Array of modifier IDs unlocked by the boss
 */
export function getModifiersUnlockedByBoss(bossId: string): string[] {
  return BOSS_MODIFIER_UNLOCKS[bossId] || [];
}

/**
 * Applies gear modifiers to a base stat value.
 *
 * @param baseValue - The base stat value before modifiers
 * @param modifiers - Array of gear modifiers to apply
 * @param statName - The name of the stat to modify
 * @returns The final stat value after applying all modifiers
 */
export function applyModifiersToStat(
  baseValue: number,
  modifiers: GearModifier[],
  statName: string
): number {
  let finalValue = baseValue;

  for (const modifier of modifiers) {
    if (modifier.stat === statName && modifier.value_range) {
      // value_range is already resolved to a single value when gear is generated
      finalValue += modifier.value_range[0];
    }
  }

  return finalValue;
}

/**
 * Applies all gear modifiers to gear stats.
 *
 * @param stats - Array of gear stats to modify
 * @param modifiers - Array of gear modifiers to apply
 * @returns Modified gear stats with applied modifiers
 */
export function applyModifiersToGearStats(
  stats: GearStat[],
  modifiers: GearModifier[]
): GearStat[] {
  return stats.map((stat) => ({
    ...stat,
    value: applyModifiersToStat(stat.value, modifiers, stat.name),
  }));
}

/**
 * Calculates total stat bonuses from all equipped gear modifiers.
 *
 * @param inventory - Player inventory containing equipped gear
 * @returns Object with stat name as key and total bonus as value
 */
export function getEquippedGearModifierBonuses(inventory: PlayerInventory): { [statName: string]: number } {
  const bonuses: { [statName: string]: number } = {};

  // Get equipped gear items
  const equippedGearIds = Object.values(inventory.equipped_gear).filter(
    (id): id is string => id !== null
  );

  for (const gearId of equippedGearIds) {
    const gear = inventory.gear.find((g) => g.id === gearId);
    if (gear && gear.modifiers) {
      for (const modifier of gear.modifiers) {
        if (modifier.value_range && modifier.value_range[0]) {
          bonuses[modifier.stat] = (bonuses[modifier.stat] || 0) + modifier.value_range[0];
        }
      }
    }
  }

  return bonuses;
}

/**
 * Applies equipped gear modifier bonuses to player stats.
 * This should be called in combat calculations to account for gear modifiers.
 *
 * @param baseStats - Base player stats
 * @param inventory - Player inventory with equipped gear
 * @returns Modified stats with gear bonuses applied
 */
export function applyGearModifiersToPlayerStats(
  baseStats: { attack: number; defense: number; dodge: number; crit_rate: number },
  inventory: PlayerInventory
): { attack: number; defense: number; dodge: number; crit_rate: number } {
  const bonuses = getEquippedGearModifierBonuses(inventory);

  return {
    attack: baseStats.attack + (bonuses.attack || 0),
    defense: baseStats.defense + (bonuses.defense || 0),
    dodge: baseStats.dodge + (bonuses.dodge || 0),
    crit_rate: baseStats.crit_rate + (bonuses.crit_rate || 0),
  };
}

const GEAR_NAMES = {
  weapon: ['Iron Sword', 'Steel Blade', 'Ancient Bow', 'Staff of Elements', 'Battle Axe'],
  armor: ['Leather Vest', 'Chainmail', 'Plate Armor', 'Dragon Scale', 'Shadow Cloak'],
  accessory: ['Wooden Ring', 'Silver Amulet', 'Golden Charm', 'Mystic Stone', 'Spirit Orb'],
};

/**
 * Generates a unique gear ID.
 *
 * @returns Unique gear identifier string
 */
function generateGearId(): string {
  return `gear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Rolls a random gear rarity based on drop chances.
 *
 * @returns Randomly selected rarity string
 */
function rollRarity(): string {
  const roll = Math.random();

  if (roll < RARITIES.legendary.drop_chance) {
    return 'legendary';
  } else if (roll < RARITIES.legendary.drop_chance + RARITIES.rare.drop_chance) {
    return 'rare';
  } else {
    return 'common';
  }
}

/**
 * Gets a random item from an array.
 *
 * @param array - Array to select from
 * @returns Random element from the array
 */
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

interface GearDefinitions {
  rarities: { [key: string]: GearRarity };
  gearTypes: string[];
  baseStats: typeof BASE_STATS;
  modifierPools: GearModifier[];
  gearNames: typeof GEAR_NAMES;
}

/**
 * Retrieves gear definitions with caching.
 *
 * @param logger - Nakama logger instance
 * @returns Gear definitions object
 */
function getGearDefinitions(logger: Runtime.Logger): GearDefinitions {
  const cacheManager = getCacheManager(logger);
  const cachedDefinitions = cacheManager.get<GearDefinitions>('gear_definitions', 'all');

  if (cachedDefinitions !== undefined) {
    return cachedDefinitions;
  }

  const definitions: GearDefinitions = {
    rarities: RARITIES,
    gearTypes: GEAR_TYPES,
    baseStats: BASE_STATS,
    modifierPools: MODIFIER_POOLS,
    gearNames: GEAR_NAMES,
  };

  cacheManager.set('gear_definitions', 'all', definitions);
  return definitions;
}

/**
 * Generates a name for a gear item based on type and rarity.
 *
 * @param type - Type of gear (weapon, armor, accessory)
 * @param rarity - Rarity of the gear
 * @param logger - Nakama logger instance
 * @returns Generated gear name
 */
function getGearName(type: string, rarity: string, logger: Runtime.Logger): string {
  const definitions = getGearDefinitions(logger);
  const names = definitions.gearNames[type as keyof typeof GEAR_NAMES];
  const baseName = getRandomItem(names);

  if (rarity === 'legendary') {
    return baseName + ' of Legend';
  } else if (rarity === 'rare') {
    return baseName + ' ' + getRandomItem(['+1', '+2', 'of Power']);
  }

  return baseName;
}

/**
 * Generates gear stats based on type and rarity.
 *
 * @param type - Type of gear
 * @param rarity - Rarity of the gear
 * @param logger - Nakama logger instance
 * @returns Array of generated gear stats
 */
function generateGearStats(type: string, rarity: string, logger: Runtime.Logger): GearStat[] {
  const definitions = getGearDefinitions(logger);
  const rarityMultiplier = definitions.rarities[rarity].stat_multiplier;
  const baseStats = definitions.baseStats[type as keyof typeof definitions.baseStats];

  return baseStats.map((stat) => ({
    name: stat.name,
    base_value: stat.base_value,
    value: Math.floor(stat.base_value * rarityMultiplier),
  }));
}

/**
 * Generates gear modifiers based on rarity and unlocked pools.
 *
 * @param rarity - Rarity of the gear
 * @param unlockedPools - List of unlocked modifier pools
 * @param logger - Nakama logger instance
 * @returns Array of generated gear modifiers
 */
function generateModifiers(
  rarity: string,
  unlockedPools: string[],
  logger: Runtime.Logger
): GearModifier[] {
  const definitions = getGearDefinitions(logger);
  const availableModifiers = definitions.modifierPools.filter((mod) => {
    if (mod.boss_unlock && !unlockedPools.includes(mod.boss_unlock)) {
      return false;
    }
    if (mod.rarity !== rarity && mod.rarity !== 'common') {
      return false;
    }
    return true;
  });

  if (availableModifiers.length === 0) {
    return [];
  }

  const numModifiers = rarity === 'legendary' ? 2 : rarity === 'rare' ? 1 : 0;
  const modifiers: GearModifier[] = [];

  for (let i = 0; i < numModifiers; i++) {
    const mod = getRandomItem(availableModifiers);
    if (!modifiers.find((m) => m.id === mod.id)) {
      const valueRange = mod.value_range;
      const value = Math.floor(Math.random() * (valueRange[1] - valueRange[0] + 1)) + valueRange[0];

      modifiers.push({
        ...mod,
        value_range: [value, value],
      });
    }
  }

  return modifiers;
}

/**
 * Generates a gear item for stage completion rewards.
 * Exported for use by stage_tracking module.
 *
 * @param stageId - ID of the stage where gear is being generated
 * @param unlockedPools - List of unlocked modifier pools
 * @param logger - Nakama logger instance
 * @returns Generated gear item
 */
export function generateGearItem(
  stageId: string,
  unlockedPools: string[],
  logger: Runtime.Logger
): GearItem {
  const definitions = getGearDefinitions(logger);
  const rarity = rollRarity();
  const type = getRandomItem(definitions.gearTypes);
  const name = getGearName(type, rarity, logger);

  // Generate modifiers first (before applying to stats)
  const modifiers = generateModifiers(rarity, unlockedPools, logger);

  // Generate base stats
  const stats = generateGearStats(type, rarity, logger);

  // Apply modifiers to stats
  const modifiedStats = applyModifiersToGearStats(stats, modifiers);

  const gear: GearItem = {
    id: generateGearId(),
    name: name,
    rarity: rarity,
    type: type,
    stats: modifiedStats,
    modifiers: modifiers,
    level: 1,
    timestamp: Date.now(),
  };

  return gear;
}

/**
 * Registers the generate gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGenerateGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/generate_gear', rpcGenerateGear);
}

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
export function rpcGenerateGear(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Generate gear called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.generate_gear, payload, 'generate_gear');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
      'generate_gear',
      'player_inventory',
      { stage_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('generate_gear', validation.error);
  }

  const request = validation.data;

  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  let inventory: PlayerInventory;

  if (inventoryObjects.length === 0) {
    inventory = {
      user_id: ctx.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
    };
  } else {
    const value = inventoryObjects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerInventory>(value, null, logger, 'storage_data');
      if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse data');
        logAudit(
          nk,
          ctx.userId,
          `ctx.ipAddress ?? null`,
          'generate_gear',
          'player_inventory',
          { stage_id: request.stage_id },
          'failure',
          'Failed to parse inventory data'
        );
        return createErrorResponse('INVALID_DATA', 'Failed to parse data');
      }
      inventory = parseResult.data;
    } else {
      inventory = {
        user_id: ctx.userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [],
      };
    }
  }

  const gear = generateGearItem(request.stage_id, inventory.unlocked_modifier_pools, logger);
  inventory.gear.push(gear);

  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory),
    },
  ]);

  logger.info('Generated gear %s (%s) for user %s', gear.name, gear.rarity, ctx.userId);

  logAudit(
    nk,
    ctx.userId,
    `ctx.ipAddress ?? null`,
    'generate_gear',
    'player_inventory',
    {
      stage_id: request.stage_id,
      gear_id: gear.id,
      gear_rarity: gear.rarity,
      gear_type: gear.type,
      inventory_size: inventory.gear.length,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    gear: gear,
    inventory: {
      gear: inventory.gear,
      equipped_gear: inventory.equipped_gear,
    },
  });
}

/**
 * Registers the equip gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcEquipGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/equip_gear', rpcEquipGear);
}

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
 * { "gear_id": "gear_123", "slot": "weapon" }
 *
 * // Response
 * {
 *   "success": true,
 *   "equipped_gear": { ... },
 *   "gear": { ... }
 * }
 */
export function rpcEquipGear(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Equip gear called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.equip_gear, payload, 'equip_gear');
  if (!validation.success) {
    return createValidationErrorResponse('equip_gear', validation.error);
  }

  const request = validation.data;

  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      error: 'Player inventory not found',
    });
  }

  const value = inventoryObjects[0].value;
  if (!value) {
    return JSON.stringify({
      error: 'Invalid inventory data',
    });
  }

  const parseResult = safeParse<PlayerInventory>(value, null, logger, 'storage_data');
  if (!parseResult.success || !parseResult.data) {
    logger.error('Failed to parse data');
    return createErrorResponse('INVALID_DATA', 'Failed to parse data');
  }
  const inventory: PlayerInventory = parseResult.data;

  const gearIndex = inventory.gear.findIndex((g) => g.id === request.gear_id);
  if (gearIndex === -1) {
    return JSON.stringify({
      error: 'Gear not found in inventory',
    });
  }

  const gear = inventory.gear[gearIndex];

  if (gear.type !== request.slot) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
      'equip_gear',
      'player_inventory',
      { gear_id: request.gear_id, slot: request.slot, error: 'type_mismatch' },
      'failure',
      'Gear type does not match slot'
    );
    return JSON.stringify({
      error: 'Gear type does not match slot',
    });
  }

  inventory.equipped_gear[request.slot] = gear.id;

  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    `ctx.ipAddress ?? null`,
    'equip_gear',
    'player_inventory',
    {
      gear_id: gear.id,
      gear_name: gear.name,
      gear_type: gear.type,
      gear_rarity: gear.rarity,
      slot: request.slot,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    equipped_gear: inventory.equipped_gear,
    gear: gear,
  });
}

/**
 * Registers the unequip gear RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcUnequipGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/unequip_gear', rpcUnequipGear);
}

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
 * { "slot": "weapon" }
 *
 * // Response
 * {
 *   "success": true,
 *   "equipped_gear": { ... }
 * }
 */
export function rpcUnequipGear(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Unequip gear called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.unequip_gear, payload, 'unequip_gear');
  if (!validation.success) {
    return createValidationErrorResponse('unequip_gear', validation.error);
  }

  const request = validation.data;

  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      error: 'Player inventory not found',
    });
  }

  const value = inventoryObjects[0].value;
  if (!value) {
    return JSON.stringify({
      error: 'Invalid inventory data',
    });
  }

  const parseResult = safeParse<PlayerInventory>(value, null, logger, 'storage_data');
  if (!parseResult.success || !parseResult.data) {
    logger.error('Failed to parse data');
    return createErrorResponse('INVALID_DATA', 'Failed to parse data');
  }
  const inventory: PlayerInventory = parseResult.data;

  if (!inventory.equipped_gear[request.slot]) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
      'unequip_gear',
      'player_inventory',
      { slot: request.slot, error: 'no_gear_equipped' },
      'failure',
      'No gear equipped in this slot'
    );
    return JSON.stringify({
      error: 'No gear equipped in this slot',
    });
  }

  const slotToUnequip = request.slot;
  delete inventory.equipped_gear[request.slot];

  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    `ctx.ipAddress ?? null`,
    'unequip_gear',
    'player_inventory',
    { slot: slotToUnequip },
    'success'
  );

  return JSON.stringify({
    success: true,
    equipped_gear: inventory.equipped_gear,
  });
}

/**
 * Registers the get inventory RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetInventory(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_inventory', rpcGetInventory);
}

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
export function rpcGetInventory(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get inventory called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_inventory, payload, 'get_inventory');
  if (!validation.success) {
    return createValidationErrorResponse('get_inventory', validation.error);
  }

  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
    });
  }

  const value = inventoryObjects[0].value;
  if (value) {
    return value;
  }

  return JSON.stringify({
    gear: [],
    equipped_gear: {},
    unlocked_modifier_pools: [],
  });
}

/**
 * Registers the unlock modifier pool RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcUnlockModifierPool(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/unlock_modifier_pool', rpcUnlockModifierPool);
}

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
export function rpcUnlockModifierPool(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Unlock modifier pool called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.unlock_modifier_pool,
    payload,
    'unlock_modifier_pool'
  );
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
      'unlock_modifier_pool',
      'modifiers',
      { modifier_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('unlock_modifier_pool', validation.error);
  }

  const modifierId = validation.data.modifier_id;

  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  let inventory: PlayerInventory;

  if (inventoryObjects.length === 0) {
    inventory = {
      user_id: ctx.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [modifierId],
    };
  } else {
    const value = inventoryObjects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerInventory>(value, null, logger, 'storage_data');
      if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse data');
        return createErrorResponse('INVALID_DATA', 'Failed to parse data');
      }
      inventory = parseResult.data;
    } else {
      inventory = {
        user_id: ctx.userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [modifierId],
      };
    }
  }

  if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
    inventory.unlocked_modifier_pools.push(modifierId);
  }

  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory),
    },
  ]);

  logger.info('Unlocked modifier pool %s for user %s', modifierId, ctx.userId);

  logAudit(
    nk,
    ctx.userId,
    `ctx.ipAddress ?? null`,
    'unlock_modifier_pool',
    'modifiers',
    { modifier_id: modifierId, unlocked_pools: inventory.unlocked_modifier_pools },
    'success'
  );

  return JSON.stringify({
    success: true,
    unlocked_modifier_pools: inventory.unlocked_modifier_pools,
  });
}

/**
 * Request payload for stage completion with loot generation.
 *
 * @property stage_id - ID of the completed stage
 * @property boss_defeated - Whether a boss was defeated
 * @property difficulty - Difficulty level of the stage
 * @property boss_id - ID of the boss defeated (if any)
 */
export interface StageCompleteRequest {
  stage_id: string;
  boss_defeated: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  boss_id?: string;
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
 * Drop rate multipliers by difficulty.
 */
const DIFFICULTY_DROP_MULTIPLIERS: { [key: string]: number } = {
  easy: 0.5,
  medium: 1.0,
  hard: 1.5,
  nightmare: 2.0,
};

/**
 * Boss drop rate bonus.
 */
const BOSS_DROP_BONUS = 0.25;

/**
 * Base drop rate for any stage completion.
 */
const BASE_DROP_RATE = 0.3;

/**
 * Calculates the drop rate based on stage difficulty and boss defeat.
 *
 * @param difficulty - Stage difficulty level
 * @param bossDefeated - Whether a boss was defeated
 * @returns Calculated drop rate between 0 and 1
 */
function calculateDropRate(difficulty: string, bossDefeated: boolean): number {
  const multiplier = DIFFICULTY_DROP_MULTIPLIERS[difficulty] || 1.0;
  let dropRate = BASE_DROP_RATE * multiplier;

  if (bossDefeated) {
    dropRate += BOSS_DROP_BONUS;
  }

  // Cap at 100%
  return Math.min(dropRate, 1.0);
}

/**
 * Registers the stage complete RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcStageComplete(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/stage_complete', rpcStageComplete);
}

/**
 * Handles stage completion with server-side loot generation.
 * This prevents client-side drop-rate hacking by rolling drops server-side.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stage_id, boss_defeated, difficulty
 * @returns JSON string with stage completion result and loot
 *
 * @example
 * // Request payload
 * { "stage_id": "stage_123", "boss_defeated": true, "difficulty": "hard" }
 *
 * // Response (with loot)
 * {
 *   "success": true,
 *   "stage_id": "stage_123",
 *   "loot": {
 *     "dropped": true,
 *     "gear": { ... }
 *   }
 * }
 */
export function rpcStageComplete(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Stage complete called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.stage_complete, payload, 'stage_complete');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
      'stage_complete',
      'stage_progression',
      { stage_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('stage_complete', validation.error);
  }

  const request = validation.data;

  // Calculate drop rate server-side
  const dropRate = calculateDropRate(request.difficulty, request.boss_defeated);
  const roll = Math.random();

  logger.info(
    'Loot roll for user %s: roll=%f, dropRate=%f, difficulty=%s, bossDefeated=%s',
    ctx.userId,
    roll,
    dropRate,
    request.difficulty,
    request.boss_defeated
  );

  const lootResult: LootResult = {
    dropped: false,
    gear: null,
  };

  // Read or create player inventory
  const inventoryObjects = nk.storageRead([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  let inventory: PlayerInventory;

  if (inventoryObjects.length === 0) {
    inventory = {
      user_id: ctx.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [],
    };
  } else {
    const value = inventoryObjects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerInventory>(value, null, logger, 'storage_data');
      if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse inventory data');
        logAudit(
          nk,
          ctx.userId,
          `ctx.ipAddress ?? null`,
          'stage_complete',
          'player_inventory',
          { stage_id: request.stage_id },
          'failure',
          'Failed to parse inventory data'
        );
        return createErrorResponse('INVALID_DATA', 'Failed to parse data');
      }
      inventory = parseResult.data;
    } else {
      inventory = {
        user_id: ctx.userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [],
      };
    }
  }

  // Unlock modifier pools when boss is defeated
  if (request.boss_defeated && request.boss_id) {
    const modifiersToUnlock = getModifiersUnlockedByBoss(request.boss_id);
    for (const modifierId of modifiersToUnlock) {
      if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
        inventory.unlocked_modifier_pools.push(modifierId);
        logger.info('Unlocked modifier pool %s for user %s after defeating boss %s', modifierId, ctx.userId, request.boss_id);
      }
    }
  }

  // Roll for loot
  if (roll < dropRate) {
    const gear = generateGearItem(request.stage_id, inventory.unlocked_modifier_pools, logger);
    inventory.gear.push(gear);

    lootResult.dropped = true;
    lootResult.gear = gear;

    logger.info(
      'Loot dropped for user %s: %s (%s)',
      ctx.userId,
      gear.name,
      gear.rarity
    );
  }

  // Save inventory with new gear (if any)
  nk.storageWrite([
    {
      collection: 'player_inventory',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory),
    },
  ]);

  // Audit the stage completion
  logAudit(
    nk,
    ctx.userId,
    `ctx.ipAddress ?? null`,
    'stage_complete',
    'stage_progression',
    {
      stage_id: request.stage_id,
      difficulty: request.difficulty,
      boss_defeated: request.boss_defeated,
      boss_id: request.boss_id ?? null,
      loot_dropped: lootResult.dropped,
      loot_gear_id: lootResult.gear?.id ?? null,
      loot_gear_rarity: lootResult.gear?.rarity ?? null,
      unlocked_modifiers: request.boss_defeated ? getModifiersUnlockedByBoss(request.boss_id ?? '') : [],
      drop_rate_used: dropRate,
      roll_value: roll,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    stage_id: request.stage_id,
    loot: lootResult,
    drop_rate: dropRate,
    unlocked_modifier_pools: inventory.unlocked_modifier_pools,
  });
}
