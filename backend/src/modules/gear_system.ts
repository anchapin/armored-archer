/**
 * Gear System module.
 * @fileoverview Manages equipment generation, modification, and inventory.
 */

import { Runtime } from '../types/nakama';
import { getCacheManager } from '../utils/cache';
import { safeParse, createErrorResponse } from '../utils/safeParse';
import { logAudit } from './audit';
import * as fs from 'fs';
import * as path from 'path';
import {
  insertGearItem,
  getPlayerGearFromDB,
  getPlayerLoadoutFromDB,
  equipItemInDB,
  unequipItemInDB,
  getFullInventoryFromDB,
  recordBossDefeatInDB,
  getDefeatedBossesFromDB,
  getBossDefeatCount,
  unlockModifierPoolInDB,
  getUnlockedModifierPoolsFromDB,
} from './gear_db';
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
  equipped_gear: { [slot: string]: string | null };
  unlocked_modifier_pools: string[];
}

const RARITIES: { [key: string]: GearRarity } = {
  common: {
    name: 'Common',
    stat_multiplier: 1.0,
    drop_chance: 0.6,
    color: '#ffffff',
  },
  rare: {
    name: 'Rare',
    stat_multiplier: 1.5,
    drop_chance: 0.25,
    color: '#00ff00',
  },
  epic: {
    name: 'Epic',
    stat_multiplier: 1.8,
    drop_chance: 0.1,
    color: '#9b30ff',
  },
  legendary: {
    name: 'Legendary',
    stat_multiplier: 2.0,
    drop_chance: 0.05,
    color: '#ffa500',
  },
};

const GEAR_TYPES = ['helm', 'armor', 'bow', 'arrow', 'amulet'];

const BASE_STATS = {
  helm: [
    { name: 'defense', base_value: 10 },
    { name: 'health', base_value: 50 },
  ],
  armor: [
    { name: 'defense', base_value: 10 },
    { name: 'health', base_value: 50 },
  ],
  bow: [
    { name: 'attack', base_value: 10 },
    { name: 'crit_rate', base_value: 5 },
  ],
  arrow: [
    { name: 'attack', base_value: 10 },
    { name: 'crit_rate', base_value: 5 },
  ],
  amulet: [
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
  {
    id: 'fire_arrow',
    name: 'Fire Arrow',
    description: 'Arrows deal fire damage',
    stat: 'attack',
    value_range: [8, 15],
    rarity: 'rare',
    boss_unlock: 'boss_fire',
  },
  {
    id: 'lightning_damage',
    name: 'Lightning Damage',
    description: 'Chance to deal bonus lightning damage',
    stat: 'attack',
    value_range: [10, 18],
    rarity: 'rare',
    boss_unlock: 'boss_electric',
  },
  {
    id: 'ice_arrow',
    name: 'Ice Arrow',
    description: 'Arrows slow enemies on hit',
    stat: 'attack',
    value_range: [6, 12],
    rarity: 'rare',
    boss_unlock: 'boss_ice',
  },
  {
    id: 'earth_arrow',
    name: 'Earth Arrow',
    description: 'Arrows have chance to stun',
    stat: 'attack',
    value_range: [7, 14],
    rarity: 'rare',
    boss_unlock: 'boss_earth',
  },
  {
    id: 'iron_forged',
    name: 'Iron Forged',
    description: 'Increased defense',
    stat: 'defense',
    value_range: [10, 20],
    rarity: 'legendary',
    boss_unlock: 'boss_iron',
  },
  {
    id: 'royal_blessing',
    name: 'Royal Blessing',
    description: 'All stats increased',
    stat: 'health',
    value_range: [30, 50],
    rarity: 'legendary',
    boss_unlock: 'boss_king',
  },
  {
    id: 'nightmare_essence',
    name: 'Nightmare Essence',
    description: 'Increased critical hit damage',
    stat: 'attack',
    value_range: [15, 25],
    rarity: 'legendary',
    boss_unlock: 'boss_nightmare',
  },
  {
    id: 'shadow_touched',
    name: 'Shadow Touched',
    description: 'Chance to bypass enemy defense',
    stat: 'attack',
    value_range: [12, 22],
    rarity: 'legendary',
    boss_unlock: 'boss_shadow',
  },
];

/**
 * Maps boss IDs to their unlocked modifier pool IDs.
 * When a boss is defeated, all modifiers associated with that boss are unlocked.
 */
const BOSS_MODIFIER_UNLOCKS: { [bossId: string]: string[] } = {
  boss_basic: ['heavy_impact'],
  boss_wind: ['piercing_arrow', 'wind_fury'],
  boss_fire: ['fire_arrow'],
  boss_electric: ['lightning_damage'],
  boss_ice: ['ice_arrow'],
  boss_earth: ['earth_arrow'],
  boss_iron: ['iron_forged'],
  boss_king: ['royal_blessing'],
  boss_nightmare: ['nightmare_essence'],
  boss_shadow: ['shadow_touched'],
};

/**
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific enemy.
 *
 * @param enemyId - The ID of the defeated enemy
 * @returns Array of modifier IDs unlocked by the enemy
 */
const ENEMY_MODIFIER_UNLOCKS: { [enemyId: string]: string[] } = {
  goblin: ['vitality_boost'],
  skeleton: ['fortification'],
  orc: ['heavy_impact'],
  dragon: ['piercing_arrow', 'wind_fury'],
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
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific enemy.
 *
 * @param enemyId - The ID of the defeated enemy
 * @returns Array of modifier IDs unlocked by the enemy
 */
export function getModifiersUnlockedByEnemy(enemyId: string): string[] {
  return ENEMY_MODIFIER_UNLOCKS[enemyId] || [];
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
export function getEquippedGearModifierBonuses(inventory: PlayerInventory): {
  [statName: string]: number;
} {
  const bonuses: { [statName: string]: number } = {};

  // Safety check: Ensure inventory and equipped_gear exist
  if (!inventory || !inventory.equipped_gear) {
    return bonuses;
  }

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
  helm: ['Iron Helm', 'Steel Casque', 'Ancient Crown', 'Dragon Helm', 'Shadow Hood'],
  armor: ['Leather Vest', 'Chainmail', 'Plate Armor', 'Dragon Scale', 'Shadow Cloak'],
  bow: ['Short Bow', 'Long Bow', 'Composite Bow', 'Dragon Bow', 'Shadow Arc'],
  arrow: ['Iron Arrow', 'Steel Bolt', 'Flame Arrow', 'Dragon Fang', 'Shadow Spike'],
  amulet: ['Wooden Charm', 'Silver Amulet', 'Golden Pendant', 'Dragon Eye', 'Shadow Gem'],
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
 * Stage-specific rarity weights from campaigns.json
 * Used to scale drop chances based on stage progression
 */
const STAGE_RARITY_WEIGHTS: { [stageId: string]: { common: number; rare: number; epic: number; legendary: number } } = {};

/**
 * Loads stage-specific rarity weights from campaigns.json
 * Maps campaigns.json rarity_weights to our internal rarity format
 */
function loadStageRarityWeights(): void {
  const campaignsPath = path.join(__dirname, '../../data/campaigns.json');
  try {
    const campaignsData = JSON.parse(fs.readFileSync(campaignsPath, 'utf8'));

    if (campaignsData.campaigns) {
      for (const campaign of campaignsData.campaigns) {
        for (const stage of campaign.stages || []) {
          const stageId = stage.id;
          const lootWeights = stage.loot?.rarity_weights || {};
          const weights = {
            common: (lootWeights.common || 0) / 100,
            rare: (lootWeights.rare || 0) / 100,
            epic: (lootWeights.epic || 0) / 100,
            legendary: (lootWeights.legendary || 0) / 100,
          };
          STAGE_RARITY_WEIGHTS[stageId] = weights;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load stage rarity weights:', error);
  }
}

/**
 * Rolls a random gear rarity based on drop chances.
 *
 * @param stageId - Optional stage ID to use stage-specific weights
 * @returns Randomly selected rarity string
 */
function rollRarity(stageId?: string): string {
  const roll = Math.random();

  // If stage-specific weights are provided, use those
  if (stageId && STAGE_RARITY_WEIGHTS[stageId]) {
    const weights = STAGE_RARITY_WEIGHTS[stageId];
    const commonThreshold = weights.common / 100;
    const epicThreshold = commonThreshold + (weights.epic / 100);
    const rareThreshold = epicThreshold + (weights.rare / 100);
    const legendaryThreshold = rareThreshold + (weights.legendary / 100);

    if (roll < legendaryThreshold) {
      return 'legendary';
    } else if (roll < rareThreshold) {
      return 'rare';
    } else if (roll < epicThreshold) {
      return 'epic';
    } else {
      return 'common';
    }
  }

  // Fall back to default rarity weights
  if (roll < RARITIES.legendary.drop_chance) {
    return 'legendary';
  } else if (roll < RARITIES.legendary.drop_chance + RARITIES.epic.drop_chance) {
    return 'epic';
  } else if (
    roll <
    RARITIES.legendary.drop_chance + RARITIES.epic.drop_chance + RARITIES.rare.drop_chance
  ) {
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
 * @param type - Type of gear (helm, armor, bow, arrow, amulet)
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

  const numModifiers =
    rarity === 'legendary' ? 2 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0;
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
  const rarity = rollRarity(stageId);
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
  // Load stage-specific rarity weights on module registration
  loadStageRarityWeights();
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
      ctx.ipAddress ?? null,
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
          ctx.ipAddress ?? null,
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
    ctx.ipAddress ?? null,
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
 * { "gear_id": "gear_123", "slot": "helm" }
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

  // Get gear from database
  const gear = getPlayerGearFromDB(nk, ctx.userId).find((g) => g.id === request.gear_id);

  if (!gear) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_gear',
      'player_inventory',
      { gear_id: request.gear_id, slot: request.slot, error: 'not_found' },
      'failure',
      'Gear not found in inventory'
    );
    return JSON.stringify({
      error: 'Gear not found in inventory',
    });
  }

  if (gear.type !== request.slot) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
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

  // Equip item in database
  const equipResult = equipItemInDB(nk, ctx.userId, request.gear_id, request.slot);

  if (!equipResult.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_gear',
      'player_inventory',
      { gear_id: request.gear_id, slot: request.slot, error: equipResult.error },
      'failure',
      equipResult.error || 'Failed to equip gear'
    );
    return JSON.stringify({
      error: equipResult.error || 'Failed to equip gear',
    });
  }

  // Get updated loadout from database
  const updatedLoadout = getPlayerLoadoutFromDB(nk, ctx.userId);

  // Convert to equipped_gear format
  const equipped_gear: { [slot: string]: string | null } = {
    helm: updatedLoadout.helm_item_id,
    armor: updatedLoadout.armor_item_id,
    bow: updatedLoadout.bow_item_id,
    arrow: updatedLoadout.arrow_item_id,
    amulet: updatedLoadout.amulet_item_id,
  };

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
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
    equipped_gear: equipped_gear,
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
 * { "slot": "helm" }
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

  // Check if gear is equipped in the slot
  const currentLoadout = getPlayerLoadoutFromDB(nk, ctx.userId);
  const slotItemKey = `${request.slot}_item_id` as keyof typeof currentLoadout;

  if (!currentLoadout[slotItemKey]) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
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

  // Unequip item from database
  const unequipResult = unequipItemInDB(nk, ctx.userId, request.slot);

  if (!unequipResult.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'unequip_gear',
      'player_inventory',
      { slot: request.slot, error: unequipResult.error },
      'failure',
      unequipResult.error || 'Failed to unequip gear'
    );
    return JSON.stringify({
      error: unequipResult.error || 'Failed to unequip gear',
    });
  }

  // Get updated loadout from database
  const updatedLoadout = getPlayerLoadoutFromDB(nk, ctx.userId);

  // Convert to equipped_gear format
  const equipped_gear: { [slot: string]: string | null } = {
    helm: updatedLoadout.helm_item_id,
    armor: updatedLoadout.armor_item_id,
    bow: updatedLoadout.bow_item_id,
    arrow: updatedLoadout.arrow_item_id,
    amulet: updatedLoadout.amulet_item_id,
  };

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'unequip_gear',
    'player_inventory',
    { slot: request.slot },
    'success'
  );

  return JSON.stringify({
    success: true,
    equipped_gear: equipped_gear,
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
/**
 * Retrieves player inventory from database.
 * Exported for use by combat_system module.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Player inventory or default inventory if not found
 */
export function getPlayerInventory(
  nk: Runtime.Nakama,
  userId: string,
  _logger: Runtime.Logger
): PlayerInventory {
  // Get gear, loadout, and unlocked modifier pools from database
  const dbInventory = getFullInventoryFromDB(nk, userId);

  return {
    user_id: userId,
    gear: dbInventory.gear,
    equipped_gear: dbInventory.equipped_gear,
    unlocked_modifier_pools: dbInventory.unlocked_modifier_pools,
  };
}

/**
 * Retrieves unlocked modifier pools from Nakama storage.
 * This function is kept for backwards compatibility but now delegates to database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Array of unlocked modifier pool IDs
 */
function getUnlockedModifierPoolsFromStorage(
  nk: Runtime.Nakama,
  userId: string,
  _logger: Runtime.Logger
): string[] {
  // Now delegates to database function for consistency
  return getUnlockedModifierPoolsFromDB(nk, userId);
}

/**
 * Retrieves player's inventory from database and Nakama storage.
 * Returns gear items, equipped loadout, and unlocked modifier pools.
 *
 * @param ctx - Runtime context
 * @param logger - Logger instance
 * @param nk - Nakama instance
 * @param payload - Request payload (empty)
 * @returns Inventory response with gear, equipped_gear, and unlocked_modifier_pools
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

  // Get gear and loadout from database
  const dbInventory = getFullInventoryFromDB(nk, ctx.userId);

  // Get unlocked modifier pools from Nakama storage
  const unlockedModifierPools = getUnlockedModifierPoolsFromStorage(nk, ctx.userId, logger);

  return JSON.stringify({
    gear: dbInventory.gear,
    equipped_gear: dbInventory.equipped_gear,
    unlocked_modifier_pools: unlockedModifierPools,
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
      ctx.ipAddress ?? null,
      'unlock_modifier_pool',
      'modifiers',
      { modifier_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('unlock_modifier_pool', validation.error);
  }

  const modifierId = validation.data.modifier_id;

  // Unlock modifier pool using database function
  const unlockResult = unlockModifierPoolInDB(nk, ctx.userId, modifierId, 'manual');

  if (!unlockResult.success) {
    logger.error('Failed to unlock modifier pool: %s', unlockResult.error);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'unlock_modifier_pool',
      'modifiers',
      { modifier_id: modifierId },
      'failure',
      unlockResult.error
    );
    return createErrorResponse('INTERNAL_ERROR', 'Failed to unlock modifier pool');
  }

  // Get all unlocked modifier pools from database
  const unlockedPools = getUnlockedModifierPoolsFromDB(nk, ctx.userId);

  logger.info('Unlocked modifier pool %s for user %s', modifierId, ctx.userId);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'unlock_modifier_pool',
    'modifiers',
    { modifier_id: modifierId, unlocked_pools: unlockedPools },
    'success'
  );

  return JSON.stringify({
    success: true,
    unlocked_modifier_pools: unlockedPools,
  });
}

/**
 * Boss defeat tracking data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property defeats - Map of boss_id to defeat count
 * @property unlocked_modifiers - List of unlocked modifier IDs
 */
export interface BossDefeatData {
  user_id: string;
  defeats: { [bossId: string]: number };
  unlocked_modifiers: string[];
}

/**
 * Registers the get unlocked modifiers RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetUnlockedModifiers(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_unlocked_modifiers', rpcGetUnlockedModifiers);
}

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
export function rpcGetUnlockedModifiers(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get unlocked modifiers called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.get_unlocked_modifiers,
    payload,
    'get_unlocked_modifiers'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_unlocked_modifiers', validation.error);
  }

  // Get unlocked modifier pools from database
  const unlockedModifierPools = getUnlockedModifierPoolsFromDB(nk, ctx.userId);

  // Get defeated bosses from database
  const defeatedBosses = getDefeatedBossesFromDB(nk, ctx.userId);

  // Build boss defeat count object
  const bossDefeats: { [bossId: string]: number } = {};
  for (const bossId of defeatedBosses) {
    bossDefeats[bossId] = getBossDefeatCount(nk, ctx.userId, bossId);
  }

  return JSON.stringify({
    success: true,
    unlocked_modifier_pools: unlockedModifierPools,
    boss_defeats: bossDefeats,
  });
}

/**
 * Retrieves boss defeat data for a player from database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Boss defeat data with defeat counts and unlocked modifiers
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _getBossDefeatData(
  nk: Runtime.Nakama,
  userId: string,
  _logger: Runtime.Logger
): BossDefeatData {
  const defeatedBosses = getDefeatedBossesFromDB(nk, userId);
  const defeats: { [bossId: string]: number } = {};

  for (const bossId of defeatedBosses) {
    defeats[bossId] = getBossDefeatCount(nk, userId, bossId);
  }

  return {
    user_id: userId,
    defeats: defeats,
    unlocked_modifiers: getUnlockedModifierPoolsFromDB(nk, userId),
  };
}

/**
 * Saves boss defeat data for a player to database.
 * This function is kept for backward compatibility but does nothing
 * since boss defeats are now tracked directly in the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param data - Boss defeat data to save (unused)
 * @param logger - Nakama logger instance
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _saveBossDefeatData(
  nk: Runtime.Nakama,
  userId: string,
  data: BossDefeatData,
  logger: Runtime.Logger
): void {
  // This function is kept for backward compatibility
  // Boss defeats are now tracked directly in the database via recordBossDefeatInDB
  logger.debug('saveBossDefeatData called (deprecated, no-op)');
}

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
export function recordBossDefeat(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  bossId: string
): { defeat_count: number; newly_unlocked_modifiers: string[] } {
  // Record the boss defeat in the database
  const defeatResult = recordBossDefeatInDB(nk, ctx.userId, bossId);

  if (!defeatResult.success) {
    logger.error('Failed to record boss defeat: %s', defeatResult.error);
    return {
      defeat_count: 0,
      newly_unlocked_modifiers: [],
    };
  }

  // Get modifiers unlocked by this boss
  const modifiersToUnlock = getModifiersUnlockedByBoss(bossId);
  const newlyUnlockedModifiers: string[] = [];

  // Unlock modifier pools using database functions
  for (const modifierId of modifiersToUnlock) {
    const unlockResult = unlockModifierPoolInDB(nk, ctx.userId, modifierId, 'boss_defeat', bossId);

    if (unlockResult.success && unlockResult.newly_unlocked) {
      newlyUnlockedModifiers.push(modifierId);
      logger.info(
        'Unlocked modifier pool %s for user %s after defeating boss %s',
        modifierId,
        ctx.userId,
        bossId
      );
    }
  }

  logger.info(
    'User %s defeated boss %s (total: %d), unlocked modifiers: %s',
    ctx.userId,
    bossId,
    defeatResult.defeat_count,
    newlyUnlockedModifiers.join(', ')
  );

  // Get all unlocked modifiers for audit
  const allUnlockedModifiers = getUnlockedModifierPoolsFromDB(nk, ctx.userId);

  // Audit the boss defeat
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'boss_defeat',
    'boss_defeat_tracking',
    {
      boss_id: bossId,
      defeat_count: defeatResult.defeat_count,
      first_defeat: defeatResult.first_defeat,
      newly_unlocked_modifiers: newlyUnlockedModifiers,
      all_unlocked_modifiers: allUnlockedModifiers,
    },
    'success'
  );

  return {
    defeat_count: defeatResult.defeat_count,
    newly_unlocked_modifiers: newlyUnlockedModifiers,
  };
}

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
 * Tuned to provide better early progression experience.
 */
const BASE_DROP_RATE = 0.4;

/**
 * XP gain constants for stage completion.
 */
const BASE_STAGE_XP = 50;
const BOSS_XP_BONUS = 50;

/**
 * Calculates XP gain for stage completion.
 *
 * @param bossDefeated - Whether a boss was defeated
 * @param difficulty - Difficulty of the stage
 * @returns XP gained
 */
function calculateStageXPGain(bossDefeated: boolean, difficulty: string): number {
  const baseXP = BASE_STAGE_XP;
  const bossBonus = bossDefeated ? BOSS_XP_BONUS : 0;
  const difficultyMultiplier = DIFFICULTY_DROP_MULTIPLIERS[difficulty] || 1.0;
  return Math.round((baseXP + bossBonus) * difficultyMultiplier);
}

/**
 * Calculates the drop rate based on stage difficulty and boss defeat.
 *
 * @param difficulty - Stage difficulty level
 * @param bossDefeated - Whether a boss was defeated
 * @returns Calculated drop rate between 0 and 1
 */
export function calculateDropRate(difficulty: string, bossDefeated: boolean): number {
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
/**
 * Unlocks modifier pools for a player based on defeated enemies.
 * Returns the list of newly unlocked modifier IDs.
 */
function unlockModifierPools(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger,
  enemyType?: string
): string[] {
  const newlyUnlocked: string[] = [];

  // Unlock modifier pools when enemy is defeated (for future drop chances)
  if (enemyType) {
    const enemyModifiersToUnlock = getModifiersUnlockedByEnemy(enemyType);
    for (const modifierId of enemyModifiersToUnlock) {
      const unlockResult = unlockModifierPoolInDB(
        nk,
        userId,
        modifierId,
        'enemy_defeat',
        undefined
      );

      if (unlockResult.success && unlockResult.newly_unlocked) {
        newlyUnlocked.push(modifierId);
        logger.info(
          'Unlocked modifier pool %s for user %s after defeating enemy type %s',
          modifierId,
          userId,
          enemyType
        );
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Handle stage completion RPC
 *
 * @param ctx - Runtime context
 * @param logger - Logger instance
 * @param nk - Nakama instance
 * @param payload - Request payload
 * @returns Stage completion response
 */
export function rpcStageComplete(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Stage complete called for user: %s', ctx.userId);

  // Validate payload
  const validation = validatePayload(ZodSchemas.stage_complete, payload, 'stage_complete');
  if (!validation.success) {
    return handleValidationFailure(nk, ctx, validation.error);
  }

  const request = validation.data;

  // Process stage completion
  const result = processStageCompletion(nk, ctx, logger, request);

  // Audit the stage completion
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'stage_complete',
    'stage_progression',
    buildAuditData(request, result),
    'success'
  );

  // Calculate XP gained for stage completion
  const xpGained = calculateStageXPGain(request.boss_defeated, request.difficulty);

  return JSON.stringify({
    success: true,
    stage_id: request.stage_id,
    loot: result.lootResult,
    drop_rate: result.dropRate,
    unlocked_modifier_pools: result.inventory.unlocked_modifier_pools,
    boss_defeat_count: result.bossDefeatResult?.defeat_count,
    newly_unlocked_modifiers: result.allUnlockedModifiers,
    // Client expects these fields at top level for contract compatibility
    xp_gained: xpGained,
    gear_dropped: result.lootResult.gear,
  });
}

/**
 * Handle validation failure
 */
function handleValidationFailure(nk: Runtime.Nakama, ctx: Runtime.Context, error: string): string {
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'stage_complete',
    'stage_progression',
    { stage_id: 'unknown' },
    'failure',
    error
  );
  return createValidationErrorResponse('stage_complete', error);
}

/**
 * Process stage completion logic
 */
function processStageCompletion(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  request: StageCompleteRequest
): {
  inventory: PlayerInventory;
  lootResult: LootResult;
  dropRate: number;
  bossDefeatResult?: { defeat_count: number; newly_unlocked_modifiers: string[] };
  allUnlockedModifiers: string[];
  roll: number;
} {
  // Calculate drop rate and roll for loot
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

  // Process boss defeat if applicable
  const bossDefeatResult =
    request.boss_defeated && request.boss_id
      ? recordBossDefeat(nk, ctx, logger, request.boss_id)
      : undefined;

  // Get player inventory (after boss defeat to get updated modifier pools)
  const inventory = getPlayerInventory(nk, ctx.userId, logger);

  // Unlock modifier pools from enemy defeats
  const newlyUnlockedModifiers = unlockModifierPools(nk, ctx.userId, logger, request.enemy_type);

  // Combine modifiers
  const allUnlockedModifiers = [
    ...(bossDefeatResult?.newly_unlocked_modifiers || []),
    ...newlyUnlockedModifiers,
  ];

  // Roll for loot
  const lootResult =
    roll < dropRate
      ? generateLootResult(nk, ctx.userId, request.stage_id, inventory, logger)
      : { dropped: false, gear: null };

  return {
    inventory,
    lootResult,
    dropRate,
    bossDefeatResult,
    allUnlockedModifiers,
    roll,
  };
}

/**
 * Build audit data object
 */
function buildAuditData(
  request: StageCompleteRequest,
  result: {
    inventory: PlayerInventory;
    lootResult: LootResult;
    dropRate: number;
    allUnlockedModifiers: string[];
    roll: number;
    bossDefeatResult?: { defeat_count: number; newly_unlocked_modifiers: string[] };
  }
): Record<string, unknown> {
  return {
    stage_id: request.stage_id,
    difficulty: request.difficulty,
    boss_defeated: request.boss_defeated,
    boss_id: request.boss_id ?? null,
    boss_defeat_count: result.bossDefeatResult?.defeat_count ?? null,
    enemy_type: request.enemy_type ?? null,
    loot_dropped: result.lootResult.dropped,
    loot_gear_id: result.lootResult.gear?.id ?? null,
    loot_gear_rarity: result.lootResult.gear?.rarity ?? null,
    unlocked_modifiers_from_boss: result.bossDefeatResult?.newly_unlocked_modifiers ?? [],
    unlocked_modifiers_from_enemy: result.allUnlockedModifiers.filter((m: string) =>
      request.enemy_type ? getModifiersUnlockedByEnemy(request.enemy_type).includes(m) : false
    ),
    all_unlocked_modifiers: result.inventory.unlocked_modifier_pools,
    drop_rate_used: result.dropRate,
    roll_value: result.roll,
  };
}

/**
 * Generate loot result for stage completion and persist to database
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param stageId - Stage identifier
 * @param inventory - Player inventory
 * @param logger - Logger instance
 * @returns Loot result
 */
function generateLootResult(
  nk: Runtime.Nakama,
  userId: string,
  stageId: string,
  inventory: PlayerInventory,
  logger: Runtime.Logger
): LootResult {
  const gear = generateGearItem(stageId, inventory.unlocked_modifier_pools, logger);

  // Persist gear to database
  const insertResult = insertGearItem(nk, userId, gear);

  if (insertResult.success && insertResult.item_id) {
    // Update gear ID with the database-generated ID
    gear.id = insertResult.item_id;
    inventory.gear.push(gear);
    logger.info(
      'Loot dropped and persisted for user %s: %s (%s) [DB ID: %s]',
      userId,
      gear.name,
      gear.rarity,
      insertResult.item_id
    );
    return { dropped: true, gear };
  } else {
    logger.error('Failed to persist gear to database: %s', insertResult.error);
    // Still return the gear even if persistence failed (data is lost but client receives it)
    inventory.gear.push(gear);
    return { dropped: true, gear };
  }
}

/**
 * Save unlocked modifier pools to Nakama storage.
 * This function is kept for backward compatibility but does nothing
 * since modifier pools are now tracked directly in the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param pools - Array of unlocked modifier pool IDs (unused)
 * @param logger - Logger instance
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _saveUnlockedModifierPools(
  nk: Runtime.Nakama,
  userId: string,
  pools: string[],
  logger: Runtime.Logger
): void {
  // This function is kept for backward compatibility
  // Modifier pools are now tracked directly in the database via unlockModifierPoolInDB
  logger.debug('saveUnlockedModifierPools called (deprecated, no-op)');
}
