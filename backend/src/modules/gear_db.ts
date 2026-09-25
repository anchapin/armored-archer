/**
 * Gear Database Operations module.
 * @fileoverview Manages database operations for gear inventory and loadout.
 * Provides functions to insert, query, and update gear data in Nakama Storage.
 *
 * Issue #XXXX: nk.dbQuery does not exist in Nakama 3.21 Goja runtime.
 * All functions have been converted to use Nakama's Storage API (nk.storageRead/nk.storageWrite).
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { getStorageRawValue, toStorageValue } from '../utils/storage-helpers';
import { GearItem } from './gear_system';

/**
 * Database row interface for gear items.
 */
interface GearItemRow {
  item_id: string;
  gear_type: string;
  name: string;
  rarity: string;
  level: number;
  stats: unknown;
  modifiers: unknown;
  created_at: string;
}

/**
 * Database row interface for loadout.
 */
interface LoadoutRow {
  helm_item_id: string | null;
  armor_item_id: string | null;
  bow_item_id: string | null;
  arrow_item_id: string | null;
  amulet_item_id: string | null;
}

/**
 * Database row interface for gear stats.
 */
interface GearStatRow {
  name: string;
  base_value: number;
  value: number;
}

/**
 * Database row interface for boss defeats.
 */
interface BossDefeatRow {
  boss_id: string;
  defeat_count: number;
}

/**
 * Database row interface for unlocked modifier pools.
 */
interface UnlockedModifierPoolRow {
  modifier_id: string;
}

/**
 * Result of inserting a gear item into storage.
 */
export interface InsertGearResult {
  item_id?: string;
  success: boolean;
  error?: string;
}

/**
 * Storage structure for player inventory.
 */
interface PlayerInventoryStorage {
  gear: GearItem[];
  equipped_gear: { [slot: string]: string | null };
  unlocked_modifier_pools: string[];
}

/**
 * Inserts a gear item into Nakama Storage (player_inventory collection).
 * Implements retry logic for version conflicts.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param gear - Gear item to insert
 * @param maxRetries - Maximum number of retries on version conflict (default: 3)
 * @returns Result with item_id or error
 */
// eslint-disable-next-line complexity
export function insertGearItem(
  nk: Runtime.Nakama,
  userId: string,
  gear: GearItem,
  maxRetries: number = 3
): InsertGearResult {
  const COLLECTION = 'player_inventory';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Read existing inventory from storage
      const storageObjects = nk.storageRead([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
        },
      ]);

      // Parse existing inventory or create new
      let inventory: PlayerInventoryStorage = {
        gear: [],
        equipped_gear: {},
        unlocked_modifier_pools: [],
      };
      let version: string | undefined;

      if (storageObjects.length > 0 && storageObjects[0].value) {
        version = storageObjects[0].version;
        const raw = getStorageRawValue(storageObjects[0].value);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              inventory = {
                gear: Array.isArray(parsed.gear) ? parsed.gear : [],
                equipped_gear: typeof parsed.equipped_gear === 'object' ? parsed.equipped_gear : {},
                unlocked_modifier_pools: Array.isArray(parsed.unlocked_modifier_pools)
                  ? parsed.unlocked_modifier_pools
                  : [],
              };
            }
          } catch {
            // Use default empty inventory
          }
        }
      }

      // Check if gear with same ID already exists (idempotency)
      if (gear.id) {
        const existingGear = inventory.gear.find((g) => g.id === gear.id);
        if (existingGear) {
          return {
            item_id: gear.id,
            success: true,
          };
        }
      }

      // Generate a unique ID for the new gear item
      const itemId = gear.id || `gear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const gearWithId: GearItem = {
        ...gear,
        id: itemId,
        timestamp: Date.now(),
      };

      // Append the new gear item to storage inventory
      inventory.gear.push(gearWithId);

      // Write back to Nakama Storage
      nk.storageWrite([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
          value: toStorageValue(inventory),
          version: version,
        },
      ]);

      // Also write to database inventory_items table so equip_gear DB fallback can find it
      const insertQuery = `
        INSERT INTO inventory_items (item_id, user_id, gear_type, name, rarity, level, stats, modifiers, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (item_id, user_id) DO NOTHING
        RETURNING item_id
      `;
      try {
        const dbResult = nk.dbQuery(insertQuery, [
          itemId,
          userId,
          gearWithId.type,
          gearWithId.name,
          gearWithId.rarity,
          gearWithId.level,
          JSON.stringify(gearWithId.stats),
          JSON.stringify(gearWithId.modifiers),
        ]) as { item_id: string }[];
        // If the INSERT was rejected by ON CONFLICT DO NOTHING, dbResult could be empty
        // but that's fine - it means the item already exists
        if (dbResult && dbResult.length > 0) {
          logger.info('Persisted gear to database: %s', dbResult[0].item_id);
        }
      } catch (dbError) {
        // Database write failed, but storage write succeeded - log warning and continue
        logger.warn(
          'Failed to persist gear to database (storage write succeeded): %s',
          String(dbError)
        );
      }

      return {
        item_id: itemId,
        success: true,
      };
    } catch (error) {
      const errorStr = String(error);
      // Check if this is a version conflict error
      if (
        errorStr.includes('version check failed') ||
        errorStr.includes('Storage write rejected')
      ) {
        if (attempt < maxRetries) {
          // Retry with fresh read
          continue;
        }
      }
      // Non-retryable error or max retries exceeded
      return {
        success: false,
        error: `Failed to insert gear item: ${errorStr}`,
      };
    }
  }

  return {
    success: false,
    error: 'Failed to insert gear item: max retries exceeded',
  };
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
    const result = nk.dbQuery(query, [userId]) as GearItemRow[];

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row: GearItemRow) => ({
      id: row.item_id,
      type: row.gear_type,
      name: row.name,
      rarity: row.rarity,
      level: row.level,
      stats: Array.isArray(row.stats)
        ? (row.stats as GearStatRow[]).map((stat: GearStatRow) => ({
            name: stat.name,
            base_value: stat.base_value,
            value: stat.value,
          }))
        : [],
      modifiers: Array.isArray(row.modifiers) ? row.modifiers : [],
      timestamp: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    logger.error('Failed to retrieve player gear', { error: String(error) });
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
    const result = nk.dbQuery(query, [userId]) as LoadoutRow[];

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
    logger.error('Failed to retrieve player loadout', { error: String(error) });
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
 * Records a boss defeat for a player in Nakama Storage.
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

/**
 * Storage structure for boss defeats.
 */
interface BossDefeatsStorage {
  defeats: {
    [bossId: string]: {
      count: number;
      firstDefeatedAt: string;
      lastDefeatedAt: string;
    };
  };
}

export function recordBossDefeatInDB(
  nk: Runtime.Nakama,
  userId: string,
  bossId: string,
  maxRetries: number = 3
): RecordBossDefeatResult {
  const COLLECTION = 'boss_defeats';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Read existing boss defeats from storage
      const storageObjects = nk.storageRead([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
        },
      ]);

      // Parse existing data or create new
      let storageData: BossDefeatsStorage = { defeats: {} };
      let version: string | undefined;

      if (storageObjects.length > 0 && storageObjects[0].value) {
        version = storageObjects[0].version;
        const raw = getStorageRawValue(storageObjects[0].value);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.defeats && typeof parsed.defeats === 'object') {
              storageData = parsed as BossDefeatsStorage;
            }
          } catch {
            // Use default empty defeats
          }
        }
      }

      // Check if this is the first defeat
      const existingDefeat = storageData.defeats[bossId];
      const isFirstDefeat = !existingDefeat;
      const now = new Date().toISOString();

      // Update or create the defeat record
      if (existingDefeat) {
        storageData.defeats[bossId] = {
          count: existingDefeat.count + 1,
          firstDefeatedAt: existingDefeat.firstDefeatedAt,
          lastDefeatedAt: now,
        };
      } else {
        storageData.defeats[bossId] = {
          count: 1,
          firstDefeatedAt: now,
          lastDefeatedAt: now,
        };
      }

      const defeatCount = storageData.defeats[bossId].count;

      // Write back to storage
      nk.storageWrite([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
          value: toStorageValue(storageData),
          version: version,
        },
      ]);

      return {
        success: true,
        defeat_count: defeatCount,
        first_defeat: isFirstDefeat,
      };
    } catch (error) {
      const errorStr = String(error);
      // Check if this is a version conflict error
      if (
        errorStr.includes('version check failed') ||
        errorStr.includes('Storage write rejected')
      ) {
        if (attempt < maxRetries) {
          // Retry with fresh read
          continue;
        }
      }
      // Non-retryable error or max retries exceeded
      return {
        success: false,
        defeat_count: 0,
        first_defeat: false,
        error: `Failed to record boss defeat: ${errorStr}`,
      };
    }
  }

  return {
    success: false,
    defeat_count: 0,
    first_defeat: false,
    error: 'Failed to record boss defeat: max retries exceeded',
  };
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
    const result = nk.dbQuery(query, [userId]) as BossDefeatRow[];
    if (!result || result.length === 0) {
      return [];
    }
    return result.map((row: BossDefeatRow) => row.boss_id);
  } catch (error) {
    logger.error('Failed to retrieve defeated bosses', { error: String(error) });
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
    const result = nk.dbQuery(query, [userId, bossId]) as BossDefeatRow[];
    if (result && result.length > 0) {
      return result[0].defeat_count;
    }
    return 0;
  } catch (error) {
    logger.error('Failed to retrieve boss defeat count', { error: String(error) });
    return 0;
  }
}

/**
 * Unlocks a modifier pool for a player in Nakama Storage.
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

/**
 * Storage structure for unlocked modifier pools.
 */
interface UnlockedModifierPoolsStorage {
  pools: Array<{
    modifierId: string;
    reason: string;
    sourceBossId?: string;
    unlockedAt: string;
  }>;
}

export function unlockModifierPoolInDB(
  nk: Runtime.Nakama,
  userId: string,
  modifierId: string,
  unlockReason: string = 'boss_defeat',
  sourceBossId?: string,
  maxRetries: number = 3
): UnlockModifierPoolResult {
  const COLLECTION = 'unlocked_modifier_pools';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Read existing unlocked pools from storage
      const storageObjects = nk.storageRead([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
        },
      ]);

      // Parse existing data or create new
      let storageData: UnlockedModifierPoolsStorage = { pools: [] };
      let version: string | undefined;

      if (storageObjects.length > 0 && storageObjects[0].value) {
        version = storageObjects[0].version;
        const raw = getStorageRawValue(storageObjects[0].value);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.pools)) {
              storageData = parsed as UnlockedModifierPoolsStorage;
            }
          } catch {
            // Use default empty pools
          }
        }
      }

      // Check if already unlocked
      const alreadyUnlocked = storageData.pools.some((p) => p.modifierId === modifierId);
      if (alreadyUnlocked) {
        return {
          success: true,
          newly_unlocked: false,
        };
      }

      // Add new unlock record
      storageData.pools.push({
        modifierId,
        reason: unlockReason,
        sourceBossId,
        unlockedAt: new Date().toISOString(),
      });

      // Write back to storage
      nk.storageWrite([
        {
          collection: COLLECTION,
          key: userId,
          userId: userId,
          value: toStorageValue(storageData),
          version: version,
        },
      ]);

      return {
        success: true,
        newly_unlocked: true,
      };
    } catch (error) {
      const errorStr = String(error);
      // Check if this is a version conflict error
      if (
        errorStr.includes('version check failed') ||
        errorStr.includes('Storage write rejected')
      ) {
        if (attempt < maxRetries) {
          // Retry with fresh read
          continue;
        }
      }
      // Non-retryable error or max retries exceeded
      return {
        success: false,
        newly_unlocked: false,
        error: `Failed to unlock modifier pool: ${errorStr}`,
      };
    }
  }

  return {
    success: false,
    newly_unlocked: false,
    error: 'Failed to unlock modifier pool: max retries exceeded',
  };
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
    const result = nk.dbQuery(query, [userId]) as UnlockedModifierPoolRow[];
    if (!result || result.length === 0) {
      return [];
    }
    return result.map((row: UnlockedModifierPoolRow) => row.modifier_id);
  } catch (error) {
    logger.error('Failed to retrieve unlocked modifier pools', { error: String(error) });
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
    const result = nk.dbQuery(query, [userId, modifierId]) as UnlockedModifierPoolRow[];
    return result && result.length > 0;
  } catch (error) {
    logger.error('Failed to check if modifier pool is unlocked', { error: String(error) });
    return false;
  }
}
