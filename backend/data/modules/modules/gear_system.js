"use strict";
/**
 * Gear System module.
 * @fileoverview Manages equipment generation, modification, and inventory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModifiersUnlockedByBoss = getModifiersUnlockedByBoss;
exports.getModifiersUnlockedByEnemy = getModifiersUnlockedByEnemy;
exports.applyModifiersToStat = applyModifiersToStat;
exports.applyModifiersToGearStats = applyModifiersToGearStats;
exports.getEquippedGearModifierBonuses = getEquippedGearModifierBonuses;
exports.applyGearModifiersToPlayerStats = applyGearModifiersToPlayerStats;
exports.generateGearItem = generateGearItem;
exports.registerRpcGenerateGear = registerRpcGenerateGear;
exports.rpcGenerateGear = rpcGenerateGear;
exports.registerRpcEquipGear = registerRpcEquipGear;
exports.rpcEquipGear = rpcEquipGear;
exports.registerRpcUnequipGear = registerRpcUnequipGear;
exports.rpcUnequipGear = rpcUnequipGear;
exports.registerRpcGetInventory = registerRpcGetInventory;
exports.getPlayerInventory = getPlayerInventory;
exports.rpcGetInventory = rpcGetInventory;
exports.registerRpcUnlockModifierPool = registerRpcUnlockModifierPool;
exports.rpcUnlockModifierPool = rpcUnlockModifierPool;
exports.registerRpcGetUnlockedModifiers = registerRpcGetUnlockedModifiers;
exports.rpcGetUnlockedModifiers = rpcGetUnlockedModifiers;
exports.recordBossDefeat = recordBossDefeat;
exports.calculateDropRate = calculateDropRate;
exports.registerRpcStageComplete = registerRpcStageComplete;
exports.rpcStageComplete = rpcStageComplete;
const cache_1 = require("../utils/cache");
const safeParse_1 = require("../utils/safeParse");
const audit_1 = require("./audit");
const validation_1 = require("./validation");
const RARITIES = {
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
const MODIFIER_POOLS = [
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
const BOSS_MODIFIER_UNLOCKS = {
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
const ENEMY_MODIFIER_UNLOCKS = {
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
function getModifiersUnlockedByBoss(bossId) {
    return BOSS_MODIFIER_UNLOCKS[bossId] || [];
}
/**
 * Retrieves the list of modifier IDs that are unlocked by defeating a specific enemy.
 *
 * @param enemyId - The ID of the defeated enemy
 * @returns Array of modifier IDs unlocked by the enemy
 */
function getModifiersUnlockedByEnemy(enemyId) {
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
function applyModifiersToStat(baseValue, modifiers, statName) {
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
function applyModifiersToGearStats(stats, modifiers) {
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
function getEquippedGearModifierBonuses(inventory) {
    const bonuses = {};
    // Safety check: Ensure inventory and equipped_gear exist
    if (!inventory || !inventory.equipped_gear) {
        return bonuses;
    }
    // Get equipped gear items
    const equippedGearIds = Object.values(inventory.equipped_gear).filter((id) => id !== null);
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
function applyGearModifiersToPlayerStats(baseStats, inventory) {
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
function generateGearId() {
    return `gear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Rolls a random gear rarity based on drop chances.
 *
 * @returns Randomly selected rarity string
 */
function rollRarity() {
    const roll = Math.random();
    if (roll < RARITIES.legendary.drop_chance) {
        return 'legendary';
    }
    else if (roll < RARITIES.legendary.drop_chance + RARITIES.epic.drop_chance) {
        return 'epic';
    }
    else if (roll <
        RARITIES.legendary.drop_chance + RARITIES.epic.drop_chance + RARITIES.rare.drop_chance) {
        return 'rare';
    }
    else {
        return 'common';
    }
}
/**
 * Gets a random item from an array.
 *
 * @param array - Array to select from
 * @returns Random element from the array
 */
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}
/**
 * Retrieves gear definitions with caching.
 *
 * @param logger - Nakama logger instance
 * @returns Gear definitions object
 */
function getGearDefinitions(logger) {
    const cacheManager = (0, cache_1.getCacheManager)(logger);
    const cachedDefinitions = cacheManager.get('gear_definitions', 'all');
    if (cachedDefinitions !== undefined) {
        return cachedDefinitions;
    }
    const definitions = {
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
function getGearName(type, rarity, logger) {
    const definitions = getGearDefinitions(logger);
    const names = definitions.gearNames[type];
    const baseName = getRandomItem(names);
    if (rarity === 'legendary') {
        return baseName + ' of Legend';
    }
    else if (rarity === 'rare') {
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
function generateGearStats(type, rarity, logger) {
    const definitions = getGearDefinitions(logger);
    const rarityMultiplier = definitions.rarities[rarity].stat_multiplier;
    const baseStats = definitions.baseStats[type];
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
function generateModifiers(rarity, unlockedPools, logger) {
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
    const numModifiers = rarity === 'legendary' ? 2 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0;
    const modifiers = [];
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
function generateGearItem(stageId, unlockedPools, logger) {
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
    const gear = {
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
function registerRpcGenerateGear(initializer) {
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
function rpcGenerateGear(ctx, logger, nk, payload) {
    logger.info('Generate gear called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.generate_gear, payload, 'generate_gear');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'generate_gear', 'player_inventory', { stage_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('generate_gear', validation.error);
    }
    const request = validation.data;
    const inventoryObjects = nk.storageRead([
        {
            collection: 'player_inventory',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    let inventory;
    if (inventoryObjects.length === 0) {
        inventory = {
            user_id: ctx.userId,
            gear: [],
            equipped_gear: {},
            unlocked_modifier_pools: [],
        };
    }
    else {
        const value = inventoryObjects[0].value;
        if (value) {
            const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
            if (!parseResult.success || !parseResult.data) {
                logger.error('Failed to parse data');
                (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'generate_gear', 'player_inventory', { stage_id: request.stage_id }, 'failure', 'Failed to parse inventory data');
                return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse data');
            }
            inventory = parseResult.data;
        }
        else {
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
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'generate_gear', 'player_inventory', {
        stage_id: request.stage_id,
        gear_id: gear.id,
        gear_rarity: gear.rarity,
        gear_type: gear.type,
        inventory_size: inventory.gear.length,
    }, 'success');
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
function registerRpcEquipGear(initializer) {
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
function rpcEquipGear(ctx, logger, nk, payload) {
    logger.info('Equip gear called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.equip_gear, payload, 'equip_gear');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('equip_gear', validation.error);
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
    const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
    if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse data');
        return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse data');
    }
    const inventory = parseResult.data;
    const gearIndex = inventory.gear.findIndex((g) => g.id === request.gear_id);
    if (gearIndex === -1) {
        return JSON.stringify({
            error: 'Gear not found in inventory',
        });
    }
    const gear = inventory.gear[gearIndex];
    if (gear.type !== request.slot) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_gear', 'player_inventory', { gear_id: request.gear_id, slot: request.slot, error: 'type_mismatch' }, 'failure', 'Gear type does not match slot');
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
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_gear', 'player_inventory', {
        gear_id: gear.id,
        gear_name: gear.name,
        gear_type: gear.type,
        gear_rarity: gear.rarity,
        slot: request.slot,
    }, 'success');
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
function registerRpcUnequipGear(initializer) {
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
function rpcUnequipGear(ctx, logger, nk, payload) {
    logger.info('Unequip gear called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.unequip_gear, payload, 'unequip_gear');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('unequip_gear', validation.error);
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
    const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
    if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse data');
        return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse data');
    }
    const inventory = parseResult.data;
    if (!inventory.equipped_gear[request.slot]) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'unequip_gear', 'player_inventory', { slot: request.slot, error: 'no_gear_equipped' }, 'failure', 'No gear equipped in this slot');
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
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'unequip_gear', 'player_inventory', { slot: slotToUnequip }, 'success');
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
function registerRpcGetInventory(initializer) {
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
 * Retrieves player inventory from storage.
 * Exported for use by combat_system module.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Player inventory or default inventory if not found
 */
function getPlayerInventory(nk, userId, logger) {
    const inventoryObjects = nk.storageRead([
        {
            collection: 'player_inventory',
            key: userId,
            userId: userId,
        },
    ]);
    if (inventoryObjects.length === 0) {
        return {
            user_id: userId,
            gear: [],
            equipped_gear: {},
            unlocked_modifier_pools: [],
        };
    }
    const value = inventoryObjects[0].value;
    if (value) {
        const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
        if (parseResult.success && parseResult.data) {
            return parseResult.data;
        }
    }
    return {
        user_id: userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [],
    };
}
/**
 *
 */
function rpcGetInventory(ctx, logger, nk, payload) {
    logger.info('Get inventory called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_inventory, payload, 'get_inventory');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_inventory', validation.error);
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
function registerRpcUnlockModifierPool(initializer) {
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
function rpcUnlockModifierPool(ctx, logger, nk, payload) {
    logger.info('Unlock modifier pool called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.unlock_modifier_pool, payload, 'unlock_modifier_pool');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'unlock_modifier_pool', 'modifiers', { modifier_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('unlock_modifier_pool', validation.error);
    }
    const modifierId = validation.data.modifier_id;
    const inventoryObjects = nk.storageRead([
        {
            collection: 'player_inventory',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    let inventory;
    if (inventoryObjects.length === 0) {
        inventory = {
            user_id: ctx.userId,
            gear: [],
            equipped_gear: {},
            unlocked_modifier_pools: [modifierId],
        };
    }
    else {
        const value = inventoryObjects[0].value;
        if (value) {
            const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
            if (!parseResult.success || !parseResult.data) {
                logger.error('Failed to parse data');
                return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse data');
            }
            inventory = parseResult.data;
        }
        else {
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
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'unlock_modifier_pool', 'modifiers', { modifier_id: modifierId, unlocked_pools: inventory.unlocked_modifier_pools }, 'success');
    return JSON.stringify({
        success: true,
        unlocked_modifier_pools: inventory.unlocked_modifier_pools,
    });
}
/**
 * Registers the get unlocked modifiers RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetUnlockedModifiers(initializer) {
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
function rpcGetUnlockedModifiers(ctx, logger, nk, payload) {
    logger.info('Get unlocked modifiers called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_unlocked_modifiers, payload, 'get_unlocked_modifiers');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_unlocked_modifiers', validation.error);
    }
    // Get player inventory to retrieve unlocked modifier pools
    const inventory = getPlayerInventory(nk, ctx.userId, logger);
    // Get boss defeat tracking data
    const bossDefeatData = getBossDefeatData(nk, ctx.userId, logger);
    return JSON.stringify({
        success: true,
        unlocked_modifier_pools: inventory.unlocked_modifier_pools,
        boss_defeats: bossDefeatData.defeats,
    });
}
/**
 * Retrieves boss defeat data for a player from storage.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Boss defeat data with defeat counts and unlocked modifiers
 */
function getBossDefeatData(nk, userId, logger) {
    const objects = nk.storageRead([
        {
            collection: 'boss_defeat_tracking',
            key: userId,
            userId: userId,
        },
    ]);
    if (objects.length === 0) {
        return {
            user_id: userId,
            defeats: {},
            unlocked_modifiers: [],
        };
    }
    const value = objects[0].value;
    if (value) {
        const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'boss_defeat_data');
        if (parseResult.success && parseResult.data) {
            return parseResult.data;
        }
    }
    return {
        user_id: userId,
        defeats: {},
        unlocked_modifiers: [],
    };
}
/**
 * Saves boss defeat data for a player to storage.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param data - Boss defeat data to save
 * @param logger - Nakama logger instance
 */
function saveBossDefeatData(nk, userId, data, logger) {
    nk.storageWrite([
        {
            collection: 'boss_defeat_tracking',
            key: userId,
            userId: userId,
            value: JSON.stringify(data),
        },
    ]);
    logger.debug('Saved boss defeat data for user: %s', userId);
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
function recordBossDefeat(nk, ctx, logger, bossId) {
    const bossDefeatData = getBossDefeatData(nk, ctx.userId, logger);
    const inventory = getPlayerInventory(nk, ctx.userId, logger);
    // Increment defeat count for this boss
    const previousDefeatCount = bossDefeatData.defeats[bossId] || 0;
    bossDefeatData.defeats[bossId] = previousDefeatCount + 1;
    // Get modifiers unlocked by this boss
    const modifiersToUnlock = getModifiersUnlockedByBoss(bossId);
    const newlyUnlockedModifiers = [];
    // Unlock any new modifier pools
    for (const modifierId of modifiersToUnlock) {
        if (!bossDefeatData.unlocked_modifiers.includes(modifierId)) {
            bossDefeatData.unlocked_modifiers.push(modifierId);
            newlyUnlockedModifiers.push(modifierId);
        }
        if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
            inventory.unlocked_modifier_pools.push(modifierId);
        }
    }
    // Save updated data
    saveBossDefeatData(nk, ctx.userId, bossDefeatData, logger);
    // Save inventory with new modifiers
    nk.storageWrite([
        {
            collection: 'player_inventory',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(inventory),
        },
    ]);
    logger.info('User %s defeated boss %s (total: %d), unlocked modifiers: %s', ctx.userId, bossId, bossDefeatData.defeats[bossId], newlyUnlockedModifiers.join(', '));
    // Audit the boss defeat
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'boss_defeat', 'boss_defeat_tracking', {
        boss_id: bossId,
        defeat_count: bossDefeatData.defeats[bossId],
        newly_unlocked_modifiers: newlyUnlockedModifiers,
        all_unlocked_modifiers: bossDefeatData.unlocked_modifiers,
    }, 'success');
    return {
        defeat_count: bossDefeatData.defeats[bossId],
        newly_unlocked_modifiers: newlyUnlockedModifiers,
    };
}
/**
 * Drop rate multipliers by difficulty.
 */
const DIFFICULTY_DROP_MULTIPLIERS = {
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
function calculateDropRate(difficulty, bossDefeated) {
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
function registerRpcStageComplete(initializer) {
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
function unlockModifierPools(inventory, logger, ctxUserId, bossId, enemyType) {
    const newlyUnlocked = [];
    // Unlock modifier pools when boss is defeated
    if (bossId) {
        const modifiersToUnlock = getModifiersUnlockedByBoss(bossId);
        for (const modifierId of modifiersToUnlock) {
            if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
                inventory.unlocked_modifier_pools.push(modifierId);
                newlyUnlocked.push(modifierId);
                logger.info('Unlocked modifier pool %s for user %s after defeating boss %s', modifierId, ctxUserId, bossId);
            }
        }
    }
    // Unlock modifier pools when enemy is defeated (for future drop chances)
    if (enemyType) {
        const enemyModifiersToUnlock = getModifiersUnlockedByEnemy(enemyType);
        for (const modifierId of enemyModifiersToUnlock) {
            if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
                inventory.unlocked_modifier_pools.push(modifierId);
                newlyUnlocked.push(modifierId);
                logger.info('Unlocked modifier pool %s for user %s after defeating enemy type %s', modifierId, ctxUserId, enemyType);
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
function rpcStageComplete(ctx, logger, nk, payload) {
    logger.info('Stage complete called for user: %s', ctx.userId);
    // Validate payload
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.stage_complete, payload, 'stage_complete');
    if (!validation.success) {
        return handleValidationFailure(nk, ctx, validation.error);
    }
    const request = validation.data;
    // Process stage completion
    const result = processStageCompletion(nk, ctx, logger, request);
    // Audit the stage completion
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'stage_complete', 'stage_progression', buildAuditData(request, result), 'success');
    return JSON.stringify({
        success: true,
        stage_id: request.stage_id,
        loot: result.lootResult,
        drop_rate: result.dropRate,
        unlocked_modifier_pools: result.inventory.unlocked_modifier_pools,
        boss_defeat_count: result.bossDefeatResult?.defeat_count,
        newly_unlocked_modifiers: result.allUnlockedModifiers,
    });
}
/**
 * Handle validation failure
 */
function handleValidationFailure(nk, ctx, error) {
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'stage_complete', 'stage_progression', { stage_id: 'unknown' }, 'failure', error);
    return (0, validation_1.createValidationErrorResponse)('stage_complete', error);
}
/**
 * Process stage completion logic
 */
function processStageCompletion(nk, ctx, logger, request) {
    // Calculate drop rate and roll for loot
    const dropRate = calculateDropRate(request.difficulty, request.boss_defeated);
    const roll = Math.random();
    logger.info('Loot roll for user %s: roll=%f, dropRate=%f, difficulty=%s, bossDefeated=%s', ctx.userId, roll, dropRate, request.difficulty, request.boss_defeated);
    // Process boss defeat if applicable
    const bossDefeatResult = request.boss_defeated && request.boss_id
        ? recordBossDefeat(nk, ctx, logger, request.boss_id)
        : undefined;
    // Get player inventory (after boss defeat to get updated modifier pools)
    const inventory = getPlayerInventory(nk, ctx.userId, logger);
    // Unlock modifier pools
    const newlyUnlockedModifiers = unlockModifierPools(inventory, logger, ctx.userId, undefined, request.enemy_type);
    // Combine modifiers
    const allUnlockedModifiers = [
        ...(bossDefeatResult?.newly_unlocked_modifiers || []),
        ...newlyUnlockedModifiers,
    ];
    // Roll for loot
    const lootResult = roll < dropRate
        ? generateLootResult(request.stage_id, inventory, logger)
        : { dropped: false, gear: null };
    // Save inventory with new gear (if any)
    if (lootResult.gear) {
        nk.storageWrite([
            {
                collection: 'player_inventory',
                key: ctx.userId,
                userId: ctx.userId,
                value: JSON.stringify(inventory),
            },
        ]);
    }
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
function buildAuditData(request, result) {
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
        unlocked_modifiers_from_enemy: result.allUnlockedModifiers.filter((m) => request.enemy_type ? getModifiersUnlockedByEnemy(request.enemy_type).includes(m) : false),
        all_unlocked_modifiers: result.inventory.unlocked_modifier_pools,
        drop_rate_used: result.dropRate,
        roll_value: result.roll,
    };
}
/**
 * Generate loot result for stage completion
 *
 * @param stageId - Stage identifier
 * @param inventory - Player inventory
 * @param logger - Logger instance
 * @returns Loot result
 */
function generateLootResult(stageId, inventory, logger) {
    const gear = generateGearItem(stageId, inventory.unlocked_modifier_pools, logger);
    inventory.gear.push(gear);
    logger.info('Loot dropped for user: %s (%s)', gear.name, gear.rarity);
    return { dropped: true, gear };
}
