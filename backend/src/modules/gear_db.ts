/**
 * Gear Database Operations module.
 * @fileoverview Manages database operations for gear inventory and loadout.
 * Provides functions to insert, query, and update gear data in PostgreSQL.
 */

import { Runtime } from '../types/nakama';
import { GearItem, GearStat, GearModifier } from './gear_system';

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
    const statsJson = JSON.stringify(gear.stats.map((stat) => ({
      name: stat.name,
      base_value: stat.base_value,
      value: stat.value,
    })));

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
export function getPlayerGearFromDB(
  nk: Runtime.Nakama,
  userId: string
): GearItem[] {
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

export function getPlayerLoadoutFromDB(
  nk: Runtime.Nakama,
  userId: string
): Loadout {
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

export function getFullInventoryFromDB(
  nk: Runtime.Nakama,
  userId: string
): FullInventoryData {
  const gear = getPlayerGearFromDB(nk, userId);
  const loadout = getPlayerLoadoutFromDB(nk, userId);

  // Convert loadout to equipped_gear mapping
  const equipped_gear: { [slot: string]: string | null } = {
    helm: loadout.helm_item_id,
    armor: loadout.armor_item_id,
    bow: loadout.bow_item_id,
    arrow: loadout.arrow_item_id,
    amulet: loadout.amulet_item_id,
  };

  // Note: unlocked_modifier_pools is stored in Nakama storage for now
  // This can be migrated to a database table in a future update
  return {
    gear,
    equipped_gear,
    unlocked_modifier_pools: [],
  };
}
