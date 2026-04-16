/**
 * Gear Database Operations module.
 * @fileoverview Manages database operations for gear inventory and loadout.
 * Provides functions to insert, query, and update gear data in PostgreSQL.
 */

import { Runtime } from '../types/nakama';
import { GearItem } from './gear_system';

/**
 * Result of inserting a gear item into the database.
 */
export interface InsertGearResult {
  item_id?: string;
  success: boolean;
  error?: string;
}

/**
 * Inserts a gear item into the inventory_items table.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param gear - Gear item to insert
 * @returns Result with item_id or error
 */
export function insertGearItem(
  nk: Runtime.Nakama,
  userId: string,
  gear: GearItem
): InsertGearResult {
  const query = `
    INSERT INTO inventory_items (
      user_id,
      gear_type,
      name,
      rarity,
      level,
      stats,
      modifiers
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING item_id
  `;

  try {
    // Convert stats array to JSONB
    const statsJson = JSON.stringify(
      gear.stats.map((stat) => ({
        name: stat.name,
        base_value: stat.base_value,
        value: stat.value,
      }))
    );

    // Convert modifiers array to JSONB
    const modifiersJson = JSON.stringify(gear.modifiers);

    const result = nk.dbQuery(query, [
      userId,
      gear.type,
      gear.name,
      gear.rarity,
      gear.level,
      statsJson,
      modifiersJson,
    ]) as any[];

    if (result && result.length > 0) {
      return {
        item_id: result[0].item_id,
        success: true,
      };
    }

    return {
      success: false,
      error: 'Failed to insert gear item - no rows returned',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to insert gear item: ${String(error)}`,
    };
  }
}

/**
 * Retrieves all gear items for a player from the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Array of gear items
 */
export function getPlayerGearFromDB(nk: Runtime.Nakama, userId: string): GearItem[] {
  const query = `
    SELECT
      item_id,
      gear_type,
      name,
      rarity,
      level,
      stats,
      modifiers,
      created_at
    FROM inventory_items
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;

  try {
    const result = nk.dbQuery(query, [userId]) as any[];

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row: any) => ({
      id: row.item_id,
      type: row.gear_type,
      name: row.name,
      rarity: row.rarity,
      level: row.level,
      stats: Array.isArray(row.stats)
        ? row.stats.map((stat: any) => ({
            name: stat.name,
            base_value: stat.base_value,
            value: stat.value,
          }))
        : [],
      modifiers: Array.isArray(row.modifiers) ? row.modifiers : [],
      timestamp: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    console.error('Failed to retrieve player gear:', error);
    return [];
  }
}

/**
 * Retrieves the loadout for a player from the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Loadout object with item IDs for each slot
 */
export interface Loadout {
  helm_item_id: string | null;
  armor_item_id: string | null;
  bow_item_id: string | null;
  arrow_item_id: string | null;
  amulet_item_id: string | null;
}

export function getPlayerLoadoutFromDB(nk: Runtime.Nakama, userId: string): Loadout {
  const query = `
    SELECT
      helm_item_id,
      armor_item_id,
      bow_item_id,
      arrow_item_id,
      amulet_item_id
    FROM loadout
    WHERE user_id = $1
  `;

  try {
    const result = nk.dbQuery(query, [userId]) as any[];

    if (!result || result.length === 0) {
      return {
        helm_item_id: null,
        armor_item_id: null,
        bow_item_id: null,
        arrow_item_id: null,
        amulet_item_id: null,
      };
    }

    const row = result[0];
    return {
      helm_item_id: row.helm_item_id || null,
      armor_item_id: row.armor_item_id || null,
      bow_item_id: row.bow_item_id || null,
      arrow_item_id: row.arrow_item_id || null,
      amulet_item_id: row.amulet_item_id || null,
    };
  } catch (error) {
    console.error('Failed to retrieve player loadout:', error);
    return {
      helm_item_id: null,
      armor_item_id: null,
      bow_item_id: null,
      arrow_item_id: null,
      amulet_item_id: null,
    };
  }
}

/**
 * Updates the loadout for a player by equipping an item in a specific slot.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param itemId - ID of the item to equip
 * @param slot - Equipment slot (helm, armor, bow, arrow, amulet)
 * @returns Success status and error if any
 */
export interface UpdateLoadoutResult {
  success: boolean;
  error?: string;
}

export function equipItemInDB(
  nk: Runtime.Nakama,
  userId: string,
  itemId: string,
  slot: string
): UpdateLoadoutResult {
  const slotColumn = `${slot}_item_id`;

  // Verify the item exists and belongs to the player
  const verifyQuery = `
    SELECT gear_type FROM inventory_items
    WHERE item_id = $1 AND user_id = $2
  `;

  let gearType: string | null = null;
  try {
    const verifyResult = nk.dbQuery(verifyQuery, [itemId, userId]) as any[];
    if (!verifyResult || verifyResult.length === 0) {
      return {
        success: false,
        error: 'Item not found or does not belong to player',
      };
    }
    gearType = verifyResult[0].gear_type;

    // Verify the item type matches the slot
    if (gearType !== slot) {
      return {
        success: false,
        error: `Item type ${gearType} does not match slot ${slot}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify item: ${String(error)}`,
    };
  }

  // Upsert the loadout
  const upsertQuery = `
    INSERT INTO loadout (
      user_id,
      ${slotColumn}
    ) VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE
    SET ${slotColumn} = $2,
        updated_at = NOW()
  `;

  try {
    nk.dbQuery(upsertQuery, [userId, itemId]);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update loadout: ${String(error)}`,
    };
  }
}

/**
 * Unequips an item from a specific slot.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param slot - Equipment slot to clear
 * @returns Success status and error if any
 */
export function unequipItemInDB(
  nk: Runtime.Nakama,
  userId: string,
  slot: string
): UpdateLoadoutResult {
  const slotColumn = `${slot}_item_id`;

  const query = `
    UPDATE loadout
    SET ${slotColumn} = NULL,
        updated_at = NOW()
    WHERE user_id = $1
  `;

  try {
    nk.dbQuery(query, [userId]);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to unequip item: ${String(error)}`,
    };
  }
}

/**
 * Gets full inventory data including gear and loadout from database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Object with gear array, equipped_gear mapping, and unlocked_modifier_pools
 */
export interface FullInventoryData {
  gear: GearItem[];
  equipped_gear: { [slot: string]: string | null };
  unlocked_modifier_pools: string[];
}

export function getFullInventoryFromDB(nk: Runtime.Nakama, userId: string): FullInventoryData {
  const gear = getPlayerGearFromDB(nk, userId);
  const loadout = getPlayerLoadoutFromDB(nk, userId);
  const unlockedModifierPools = getUnlockedModifierPoolsFromDB(nk, userId);

  // Convert loadout to equipped_gear mapping
  const equipped_gear: { [slot: string]: string | null } = {
    helm: loadout.helm_item_id,
    armor: loadout.armor_item_id,
    bow: loadout.bow_item_id,
    arrow: loadout.arrow_item_id,
    amulet: loadout.amulet_item_id,
  };

  // Return empty object if all slots are null (new player with no loadout)
  if (Object.values(equipped_gear).every((value) => value === null)) {
    return {
      gear,
      equipped_gear: {},
      unlocked_modifier_pools: unlockedModifierPools,
    };
  }

  return {
    gear,
    equipped_gear,
    unlocked_modifier_pools: unlockedModifierPools,
  };
}

/**
 * Records a boss defeat for a player in the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param bossId - ID of the defeated boss
 * @returns Object with defeat count, whether it was a first defeat, and error if any
 */
export interface RecordBossDefeatResult {
  success: boolean;
  defeat_count: number;
  first_defeat: boolean;
  error?: string;
}

export function recordBossDefeatInDB(
  nk: Runtime.Nakama,
  userId: string,
  bossId: string
): RecordBossDefeatResult {
  // Check if this is the first defeat
  const checkQuery = `
    SELECT defeat_count FROM boss_defeats
    WHERE user_id = $1 AND boss_id = $2
  `;

  let isFirstDefeat = false;
  let defeatCount = 1;

  try {
    const checkResult = nk.dbQuery(checkQuery, [userId, bossId]) as any[];

    if (checkResult && checkResult.length > 0) {
      defeatCount = checkResult[0].defeat_count + 1;
    } else {
      isFirstDefeat = true;
    }

    // Upsert the boss defeat record
    const upsertQuery = `
      INSERT INTO boss_defeats (user_id, boss_id, defeat_count, first_defeated_at, last_defeated_at)
      VALUES ($1, $2, 1, NOW(), NOW())
      ON CONFLICT (user_id, boss_id) DO UPDATE
      SET defeat_count = boss_defeats.defeat_count + 1,
          last_defeated_at = NOW(),
          updated_at = NOW()
      RETURNING defeat_count
    `;

    const upsertResult = nk.dbQuery(upsertQuery, [userId, bossId]) as any[];
    if (upsertResult && upsertResult.length > 0) {
      defeatCount = upsertResult[0].defeat_count;
    }

    return {
      success: true,
      defeat_count: defeatCount,
      first_defeat: isFirstDefeat,
    };
  } catch (error) {
    return {
      success: false,
      defeat_count: 0,
      first_defeat: false,
      error: `Failed to record boss defeat: ${String(error)}`,
    };
  }
}

/**
 * Gets the list of boss IDs that a player has defeated.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Array of boss IDs that have been defeated
 */
export function getDefeatedBossesFromDB(nk: Runtime.Nakama, userId: string): string[] {
  const query = `
    SELECT boss_id FROM boss_defeats
    WHERE user_id = $1
    ORDER BY first_defeated_at ASC
  `;

  try {
    const result = nk.dbQuery(query, [userId]) as any[];
    if (!result || result.length === 0) {
      return [];
    }
    return result.map((row: any) => row.boss_id);
  } catch (error) {
    console.error('Failed to retrieve defeated bosses:', error);
    return [];
  }
}

/**
 * Gets the defeat count for a specific boss.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param bossId - ID of the boss to check
 * @returns Number of times the boss has been defeated, or 0 if never defeated
 */
export function getBossDefeatCount(nk: Runtime.Nakama, userId: string, bossId: string): number {
  const query = `
    SELECT defeat_count FROM boss_defeats
    WHERE user_id = $1 AND boss_id = $2
  `;

  try {
    const result = nk.dbQuery(query, [userId, bossId]) as any[];
    if (result && result.length > 0) {
      return result[0].defeat_count;
    }
    return 0;
  } catch (error) {
    console.error('Failed to retrieve boss defeat count:', error);
    return 0;
  }
}

/**
 * Unlocks a modifier pool for a player in the database.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param modifierId - ID of the modifier pool to unlock
 * @param unlockReason - Reason for unlocking (boss_defeat, enemy_defeat, purchase, event)
 * @param sourceBossId - Optional ID of the boss that unlocked this modifier
 * @returns Success status, whether it was newly unlocked, and error if any
 */
export interface UnlockModifierPoolResult {
  success: boolean;
  newly_unlocked: boolean;
  error?: string;
}

export function unlockModifierPoolInDB(
  nk: Runtime.Nakama,
  userId: string,
  modifierId: string,
  unlockReason: string = 'boss_defeat',
  sourceBossId?: string
): UnlockModifierPoolResult {
  // Check if already unlocked
  const checkQuery = `
    SELECT modifier_id FROM unlocked_modifier_pools
    WHERE user_id = $1 AND modifier_id = $2
  `;

  try {
    const checkResult = nk.dbQuery(checkQuery, [userId, modifierId]) as any[];

    if (checkResult && checkResult.length > 0) {
      return {
        success: true,
        newly_unlocked: false,
      };
    }

    // Insert new unlock record
    const insertQuery = `
      INSERT INTO unlocked_modifier_pools (user_id, modifier_id, unlock_reason, source_boss_id)
      VALUES ($1, $2, $3, $4)
    `;

    nk.dbQuery(insertQuery, [userId, modifierId, unlockReason, sourceBossId || null]);

    return {
      success: true,
      newly_unlocked: true,
    };
  } catch (error) {
    return {
      success: false,
      newly_unlocked: false,
      error: `Failed to unlock modifier pool: ${String(error)}`,
    };
  }
}

/**
 * Gets the list of unlocked modifier pools for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Array of unlocked modifier pool IDs
 */
export function getUnlockedModifierPoolsFromDB(nk: Runtime.Nakama, userId: string): string[] {
  const query = `
    SELECT modifier_id FROM unlocked_modifier_pools
    WHERE user_id = $1
    ORDER BY unlocked_at ASC
  `;

  try {
    const result = nk.dbQuery(query, [userId]) as any[];
    if (!result || result.length === 0) {
      return [];
    }
    return result.map((row: any) => row.modifier_id);
  } catch (error) {
    console.error('Failed to retrieve unlocked modifier pools:', error);
    return [];
  }
}

/**
 * Checks if a modifier pool is unlocked for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param modifierId - ID of the modifier pool to check
 * @returns True if the modifier pool is unlocked
 */
export function isModifierPoolUnlocked(
  nk: Runtime.Nakama,
  userId: string,
  modifierId: string
): boolean {
  const query = `
    SELECT 1 FROM unlocked_modifier_pools
    WHERE user_id = $1 AND modifier_id = $2
  `;

  try {
    const result = nk.dbQuery(query, [userId, modifierId]) as any[];
    return result && result.length > 0;
  } catch (error) {
    console.error('Failed to check if modifier pool is unlocked:', error);
    return false;
  }
}
