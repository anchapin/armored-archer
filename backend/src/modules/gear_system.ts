import { Runtime } from "../types/nakama";
import { safeParse, safeParsePayload, createErrorResponse } from "../utils/safeParse";

export interface GearRarity {
  name: string;
  stat_multiplier: number;
  drop_chance: number;
  color: string;
}

export interface GearModifier {
  id: string;
  name: string;
  description: string;
  stat: string;
  value_range: [number, number];
  rarity: string;
  boss_unlock: string | null;
}

export interface GearStat {
  name: string;
  base_value: number;
  value: number;
}

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

export interface GenerateGearRequest {
  stage_id: string;
  boss_defeated: boolean;
}

export interface EquipGearRequest {
  gear_id: string;
  slot: string;
}

export interface UnequipGearRequest {
  slot: string;
}

export interface PlayerInventory {
  user_id: string;
  gear: GearItem[];
  equipped_gear: { [slot: string]: string | null };
  unlocked_modifier_pools: string[];
}

const RARITIES: { [key: string]: GearRarity } = {
  common: {
    name: "Common",
    stat_multiplier: 1.0,
    drop_chance: 0.70,
    color: "#ffffff"
  },
  rare: {
    name: "Rare",
    stat_multiplier: 1.5,
    drop_chance: 0.25,
    color: "#0070dd"
  },
  legendary: {
    name: "Legendary",
    stat_multiplier: 2.0,
    drop_chance: 0.05,
    color: "#ff8000"
  }
};

const GEAR_TYPES = ["weapon", "armor", "accessory"];

const BASE_STATS = {
  weapon: [
    { name: "attack", base_value: 10 },
    { name: "crit_rate", base_value: 5 }
  ],
  armor: [
    { name: "defense", base_value: 10 },
    { name: "health", base_value: 50 }
  ],
  accessory: [
    { name: "dodge", base_value: 5 },
    { name: "crit_rate", base_value: 3 }
  ]
};

const MODIFIER_POOLS: GearModifier[] = [
  {
    id: "piercing_arrow",
    name: "Piercing Arrow",
    description: "Arrows penetrate through enemies",
    stat: "attack",
    value_range: [5, 10],
    rarity: "rare",
    boss_unlock: "boss_wind"
  },
  {
    id: "heavy_impact",
    name: "Heavy Impact",
    description: "Increased knockback on hit",
    stat: "attack",
    value_range: [8, 15],
    rarity: "rare",
    boss_unlock: "boss_basic"
  },
  {
    id: "vitality_boost",
    name: "Vitality Boost",
    description: "Increased maximum health",
    stat: "health",
    value_range: [20, 40],
    rarity: "common",
    boss_unlock: null
  },
  {
    id: "wind_fury",
    name: "Wind Fury",
    description: "Attack speed increased",
    stat: "attack",
    value_range: [10, 20],
    rarity: "legendary",
    boss_unlock: "boss_wind"
  },
  {
    id: "fortification",
    name: "Fortification",
    description: "Damage reduction",
    stat: "defense",
    value_range: [5, 12],
    rarity: "common",
    boss_unlock: null
  }
];

const GEAR_NAMES = {
  weapon: ["Iron Sword", "Steel Blade", "Ancient Bow", "Staff of Elements", "Battle Axe"],
  armor: ["Leather Vest", "Chainmail", "Plate Armor", "Dragon Scale", "Shadow Cloak"],
  accessory: ["Wooden Ring", "Silver Amulet", "Golden Charm", "Mystic Stone", "Spirit Orb"]
};

function prdRandom(n: number): number {
  let chance: number = n;
  const roll: number = Math.random();
  
  if (roll < chance) {
    chance = 0.25;
  } else {
    chance = Math.min(1.0, chance + 0.25);
  }
  
  return chance;
}

function generateGearId(): string {
  return `gear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function rollRarity(): string {
  const roll = Math.random();
  
  if (roll < RARITIES.legendary.drop_chance) {
    return "legendary";
  } else if (roll < RARITIES.legendary.drop_chance + RARITIES.rare.drop_chance) {
    return "rare";
  } else {
    return "common";
  }
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getGearName(type: string, rarity: string): string {
  const names = GEAR_NAMES[type as keyof typeof GEAR_NAMES];
  const baseName = getRandomItem(names);
  
  if (rarity === "legendary") {
    return baseName + " of Legend";
  } else if (rarity === "rare") {
    return baseName + " " + getRandomItem(["+1", "+2", "of Power"]);
  }
  
  return baseName;
}

function generateGearStats(type: string, rarity: string): GearStat[] {
  const rarityMultiplier = RARITIES[rarity].stat_multiplier;
  const baseStats = BASE_STATS[type as keyof typeof BASE_STATS];
  
  return baseStats.map(stat => ({
    name: stat.name,
    base_value: stat.base_value,
    value: Math.floor(stat.base_value * rarityMultiplier)
  }));
}

function generateModifiers(rarity: string, unlockedPools: string[]): GearModifier[] {
  const availableModifiers = MODIFIER_POOLS.filter(mod => {
    if (mod.boss_unlock && !unlockedPools.includes(mod.boss_unlock)) {
      return false;
    }
    if (mod.rarity !== rarity && mod.rarity !== "common") {
      return false;
    }
    return true;
  });
  
  if (availableModifiers.length === 0) {
    return [];
  }
  
  const numModifiers = rarity === "legendary" ? 2 : (rarity === "rare" ? 1 : 0);
  const modifiers: GearModifier[] = [];
  
  for (let i = 0; i < numModifiers; i++) {
    const mod = getRandomItem(availableModifiers);
    if (!modifiers.find(m => m.id === mod.id)) {
      const valueRange = mod.value_range;
      const value = Math.floor(Math.random() * (valueRange[1] - valueRange[0] + 1)) + valueRange[0];
      
      modifiers.push({
        ...mod,
        value_range: [value, value]
      });
    }
  }
  
  return modifiers;
}

function generateGearItem(stageId: string, unlockedPools: string[]): GearItem {
  const rarity = rollRarity();
  const type = getRandomItem(GEAR_TYPES);
  const name = getGearName(type, rarity);
  
  const gear: GearItem = {
    id: generateGearId(),
    name: name,
    rarity: rarity,
    type: type,
    stats: generateGearStats(type, rarity),
    modifiers: generateModifiers(rarity, unlockedPools),
    level: 1,
    timestamp: Date.now()
  };
  
  return gear;
}

export function registerRpcGenerateGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/generate_gear", rpcGenerateGear);
}

function rpcGenerateGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Generate gear called for user: %s", ctx.userId);
  
  const request = safeParsePayload<GenerateGearRequest>(payload, logger, "generate_gear");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }
  
  const inventoryObjects = nk.storageRead([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);
  
  let inventory: PlayerInventory;
  
  if (inventoryObjects.length === 0) {
    inventory = {
      user_id: ctx.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: []
    };
  } else {
    const value = inventoryObjects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerInventory>(value, null, logger, "player_inventory");
      if (!parseResult.success || !parseResult.data) {
        logger.error("Failed to parse player inventory for user: %s", ctx.userId);
        return createErrorResponse("INVALID_DATA", "Failed to parse player inventory");
      }
      inventory = parseResult.data;
    } else {
      inventory = {
        user_id: ctx.userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: []
      };
    }
  }
  
  const gear = generateGearItem(request.stage_id, inventory.unlocked_modifier_pools);
  inventory.gear.push(gear);
  
  nk.storageWrite([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory)
    }
  ]);
  
  logger.info("Generated gear %s (%s) for user %s", gear.name, gear.rarity, ctx.userId);
  
  return JSON.stringify({
    success: true,
    gear: gear,
    inventory: {
      gear: inventory.gear,
      equipped_gear: inventory.equipped_gear
    }
  });
}

export function registerRpcEquipGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/equip_gear", rpcEquipGear);
}

function rpcEquipGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Equip gear called for user: %s", ctx.userId);
  
  const request = safeParsePayload<EquipGearRequest>(payload, logger, "equip_gear");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }
  
  const inventoryObjects = nk.storageRead([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);
  
  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      error: "Player inventory not found"
    });
  }
  
  const value = inventoryObjects[0].value;
  if (!value) {
    return JSON.stringify({
      error: "Invalid inventory data"
    });
  }
  
  const parseResult = safeParse<PlayerInventory>(value, null, logger, "player_inventory");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player inventory for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player inventory");
  }
  const inventory: PlayerInventory = parseResult.data;
  
  const gearIndex = inventory.gear.findIndex(g => g.id === request.gear_id);
  if (gearIndex === -1) {
    return JSON.stringify({
      error: "Gear not found in inventory"
    });
  }
  
  const gear = inventory.gear[gearIndex];
  
  if (gear.type !== request.slot) {
    return JSON.stringify({
      error: "Gear type does not match slot"
    });
  }
  
  inventory.equipped_gear[request.slot] = gear.id;
  
  nk.storageWrite([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory)
    }
  ]);
  
  return JSON.stringify({
    success: true,
    equipped_gear: inventory.equipped_gear,
    gear: gear
  });
}

export function registerRpcUnequipGear(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/unequip_gear", rpcUnequipGear);
}

function rpcUnequipGear(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Unequip gear called for user: %s", ctx.userId);
  
  const request = safeParsePayload<UnequipGearRequest>(payload, logger, "unequip_gear");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }
  
  const inventoryObjects = nk.storageRead([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);
  
  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      error: "Player inventory not found"
    });
  }
  
  const value = inventoryObjects[0].value;
  if (!value) {
    return JSON.stringify({
      error: "Invalid inventory data"
    });
  }
  
  const parseResult = safeParse<PlayerInventory>(value, null, logger, "player_inventory");
  if (!parseResult.success || !parseResult.data) {
    logger.error("Failed to parse player inventory for user: %s", ctx.userId);
    return createErrorResponse("INVALID_DATA", "Failed to parse player inventory");
  }
  const inventory: PlayerInventory = parseResult.data;
  
  if (!inventory.equipped_gear[request.slot]) {
    return JSON.stringify({
      error: "No gear equipped in this slot"
    });
  }
  
  delete inventory.equipped_gear[request.slot];
  
  nk.storageWrite([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory)
    }
  ]);
  
  return JSON.stringify({
    success: true,
    equipped_gear: inventory.equipped_gear
  });
}

export function registerRpcGetInventory(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/get_inventory", rpcGetInventory);
}

function rpcGetInventory(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Get inventory called for user: %s", ctx.userId);
  
  const inventoryObjects = nk.storageRead([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);
  
  if (inventoryObjects.length === 0) {
    return JSON.stringify({
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: []
    });
  }
  
  const value = inventoryObjects[0].value;
  if (value) {
    return value;
  }
  
  return JSON.stringify({
    gear: [],
    equipped_gear: {},
    unlocked_modifier_pools: []
  });
}

export function registerRpcUnlockModifierPool(initializer: Runtime.Initializer): void {
  initializer.registerRpc("armored_archer/unlock_modifier_pool", rpcUnlockModifierPool);
}

function rpcUnlockModifierPool(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
  logger.info("Unlock modifier pool called for user: %s", ctx.userId);
  
  const request = safeParsePayload<{ modifier_id: string }>(payload, logger, "unlock_modifier_pool");
  
  if (!request) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON payload");
  }
  
  const modifierId = request.modifier_id;
  
  const inventoryObjects = nk.storageRead([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId
    }
  ]);
  
  let inventory: PlayerInventory;
  
  if (inventoryObjects.length === 0) {
    inventory = {
      user_id: ctx.userId,
      gear: [],
      equipped_gear: {},
      unlocked_modifier_pools: [modifierId]
    };
  } else {
    const value = inventoryObjects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerInventory>(value, null, logger, "player_inventory");
      if (!parseResult.success || !parseResult.data) {
        logger.error("Failed to parse player inventory for user: %s", ctx.userId);
        return createErrorResponse("INVALID_DATA", "Failed to parse player inventory");
      }
      inventory = parseResult.data;
    } else {
      inventory = {
        user_id: ctx.userId,
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [modifierId]
      };
    }
  }
  
  if (!inventory.unlocked_modifier_pools.includes(modifierId)) {
    inventory.unlocked_modifier_pools.push(modifierId);
  }
  
  nk.storageWrite([
    {
      collection: "player_inventory",
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(inventory)
    }
  ]);
  
  logger.info("Unlocked modifier pool %s for user %s", modifierId, ctx.userId);
  
  return JSON.stringify({
    success: true,
    unlocked_modifier_pools: inventory.unlocked_modifier_pools
  });
}
