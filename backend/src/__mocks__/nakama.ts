import { Runtime } from '../types/nakama';

// Module-level storage map for test data sharing
export const testStorage: Map<string, string> = new Map();

// Helper function to set up test inventory data
export const setTestInventory = (inventory: any): void => {
  testStorage.set('player_inventory:test-user', JSON.stringify(inventory));
};

export const createMockLogger = (): Runtime.Logger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

export const createMockContext = (overrides?: Partial<Runtime.Context>): Runtime.Context => ({
  userId: 'test-user',
  username: 'TestPlayer',
  variables: {},
  env: {},
  sessionExpiry: Date.now() + 3600000,
  ...overrides,
});

export interface MockStorageObject {
  collection: string;
  key: string;
  userId: string;
  value: string;
  version: string;
  permissionRead: number;
  permissionWrite: number;
  createTime: number;
  updateTime: number;
}

export const createMockNakama = (): Runtime.Nakama => {
  const storageWriteCalls: MockStorageObject[] = [];

  const storageReadMock = jest.fn((objects: { collection: string; key: string; userId?: string }[]) => {
    return objects
      .map((obj) => {
        const userId = obj.userId ?? 'test-user';
        const key = `${obj.collection}:${obj.key}`;
        const value = testStorage.get(key);
        if (value === undefined) return null;

        return {
          collection: obj.collection,
          key: obj.key,
          userId: userId,
          value: value,
          version: '1',
          permissionRead: 1,
          permissionWrite: 1,
          createTime: Date.now(),
          updateTime: Date.now(),
        };
      })
      .filter(Boolean);
  }) as any;

  // Override mockReturnValue to also update testStorage
  const originalMockReturnValue = storageReadMock.mockReturnValue;
  storageReadMock.mockReturnValue = function(this: any, value: any) {
    // Update testStorage with the mockReturnValue data
    if (Array.isArray(value) && value.length > 0 && value[0]?.collection === 'player_inventory' && value[0]?.value) {
      const inventoryData = value[0];
      const key = `${inventoryData.collection}:${inventoryData.key}`;
      testStorage.set(key, inventoryData.value);
    }
    return originalMockReturnValue.call(this, value);
  };

  const dbQueryMock = jest.fn((query: string, params?: unknown[]) => {
    // Handle basic database queries for testing
    // Check module-level storage for inventory data
    const inventoryKey = 'player_inventory:test-user';
    if (query.includes('inventory_items') && query.includes('SELECT')) {
      if (testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          if (inventory.gear) {
            // Convert gear to db format
            return inventory.gear.map((g: any) => ({
              item_id: g.id,
              gear_type: g.type,
              name: g.name,
              rarity: g.rarity,
              level: g.level,
              stats: g.stats,
              modifiers: g.modifiers,
              created_at: new Date(g.timestamp).toISOString(),
            }));
          }
        } catch {
          // Ignore parse errors
        }
      }
      return [];
    }
    if (query.includes('loadout') && query.includes('SELECT')) {
      if (testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          // Convert equipped_gear to db format
          const equipped = inventory.equipped_gear || {};
          return [{
            user_id: 'test-user',
            helm_item_id: equipped.helm || null,
            armor_item_id: equipped.armor || null,
            bow_item_id: equipped.bow || null,
            arrow_item_id: equipped.arrow || null,
            amulet_item_id: equipped.amulet || null,
          }];
        } catch {
          // Ignore parse errors
        }
      }
      return [{
        user_id: 'test-user',
        helm_item_id: null,
        armor_item_id: null,
        bow_item_id: null,
        arrow_item_id: null,
        amulet_item_id: null,
      }];
    }
    // Handle INSERT ... ON CONFLICT UPDATE (upsert) - check for ON CONFLICT first
    if (query.includes('loadout') && query.includes('ON CONFLICT') && query.includes('INSERT') && params) {
      const paramsArray = Array.isArray(params) ? params : [params];
      if (testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          // Determine which slot to update based on the query
          let slot: string | null = null;
          if (query.includes('helm_item_id')) slot = 'helm';
          else if (query.includes('armor_item_id')) slot = 'armor';
          else if (query.includes('bow_item_id')) slot = 'bow';
          else if (query.includes('arrow_item_id')) slot = 'arrow';
          else if (query.includes('amulet_item_id')) slot = 'amulet';

          if (slot) {
            // For upsert: INSERT ... ON CONFLICT UPDATE
            // params are [userId, itemId] where itemId is paramsArray[1]
            inventory.equipped_gear = {
              ...(inventory.equipped_gear || {}),
              [slot]: paramsArray[1] || null,
            };
          }
          testStorage.set(inventoryKey, JSON.stringify(inventory));
        } catch {
          // Ignore parse errors
        }
      }
      return [];
    }
    if (query.includes('loadout') && query.includes('INSERT') && !query.includes('ON CONFLICT') && params) {
      // Handle INSERT for new loadout (without ON CONFLICT)
      const paramsArray = Array.isArray(params) ? params : [params];
      const userId = paramsArray[1];
      if (userId === 'test-user' && testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          // Update inventory with new loadout
          inventory.equipped_gear = {
            helm: paramsArray[2] || null,
            armor: paramsArray[3] || null,
            bow: paramsArray[4] || null,
            arrow: paramsArray[5] || null,
            amulet: paramsArray[6] || null,
          };
          testStorage.set(inventoryKey, JSON.stringify(inventory));
        } catch {
          // Ignore parse errors
        }
      }
      return [];
    }
    if (query.includes('loadout') && (query.includes('UPDATE') || query.includes('ON CONFLICT')) && params) {
      // Handle UPDATE for existing loadout (including INSERT ... ON CONFLICT UPDATE)
      const paramsArray = Array.isArray(params) ? params : [params];
      if (testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          // Determine which slot to update based on the query
          let slot: string | null = null;
          if (query.includes('helm_item_id')) slot = 'helm';
          else if (query.includes('armor_item_id')) slot = 'armor';
          else if (query.includes('bow_item_id')) slot = 'bow';
          else if (query.includes('arrow_item_id')) slot = 'arrow';
          else if (query.includes('amulet_item_id')) slot = 'amulet';

          if (slot) {
            // Update the inventory with the updated loadout
            // For INSERT ... ON CONFLICT UPDATE, params are [userId, itemId]
            // For UPDATE, params are different
            if (query.includes('INSERT')) {
              inventory.equipped_gear = {
                ...(inventory.equipped_gear || {}),
                [slot]: paramsArray[1] || null,
              };
            } else {
              // UPDATE query params are different
              // First param is the value being set
              // Check if it's a NULL update (for unequip)
              const newValue = paramsArray[0];
              if (newValue === null || newValue === 'NULL' || query.includes('SET')) {
                // This is likely an unequip operation setting slot to NULL
                inventory.equipped_gear = {
                  ...(inventory.equipped_gear || {}),
                  [slot]: null,
                };
              } else {
                // Regular update setting a value
                inventory.equipped_gear = {
                  ...(inventory.equipped_gear || {}),
                  [slot]: newValue || null,
                };
              }
            }
          }
          testStorage.set(inventoryKey, JSON.stringify(inventory));
        } catch {
          // Ignore parse errors
        }
      }
      return [];
    }
    if (query.includes('inventory_items') && query.includes('SELECT') && query.includes('gear_type')) {
      if (testStorage.has(inventoryKey)) {
        try {
          const inventoryValue = testStorage.get(inventoryKey);
          const inventory = JSON.parse(inventoryValue as string);
          if (inventory.gear) {
            const paramsArray = Array.isArray(params) ? params : [params];
            const gearId = paramsArray[0];
            const userId = paramsArray[1];
            const gear = inventory.gear.find((g: any) => g.id === gearId);
            if (gear && userId === 'test-user') {
              return [{
                gear_type: gear.type,
              }];
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
      return [];
    }
    if (query.includes('inventory_items')) {
      return [];
    }
    if (query.includes('loadout')) {
      return [];
    }

    // Handle boss_defeats table queries
    if (query.includes('boss_defeats')) {
      const userId = params && params.length > 0 ? params[0] as string : 'test-user';
      const bossDefeatsKey = 'boss_defeats:' + userId;
      const bossDefeatsData: { [bossId: string]: { defeat_count: number; first_defeated_at: number } } = {};

      if (testStorage.has(bossDefeatsKey)) {
        try {
          const stored = JSON.parse(testStorage.get(bossDefeatsKey) as string);
          Object.assign(bossDefeatsData, stored);
        } catch {
          // Ignore parse errors
        }
      }

      // SELECT defeat_count FROM boss_defeats WHERE user_id = $1 AND boss_id = $2
      if (query.includes('defeat_count') && query.includes('WHERE') && params && params.length >= 2) {
        const bossId = params[1] as string;
        if (bossDefeatsData[bossId]) {
          return [{ defeat_count: bossDefeatsData[bossId].defeat_count }];
        }
        return [];
      }

      // SELECT boss_id FROM boss_defeats WHERE user_id = $1
      if (query.includes('boss_id') && query.includes('ORDER BY')) {
        return Object.keys(bossDefeatsData).map((bossId) => ({ boss_id: bossId }));
      }

      // INSERT ... ON CONFLICT UPDATE for boss_defeats
      if (query.includes('INSERT') && query.includes('ON CONFLICT')) {
        const bossId = params && params[1] ? params[1] as string : 'unknown';
        const now = Date.now();
        if (bossDefeatsData[bossId]) {
          bossDefeatsData[bossId].defeat_count++;
          bossDefeatsData[bossId].first_defeated_at = now;
        } else {
          bossDefeatsData[bossId] = { defeat_count: 1, first_defeated_at: now };
        }
        testStorage.set(bossDefeatsKey, JSON.stringify(bossDefeatsData));
        return [{ defeat_count: bossDefeatsData[bossId].defeat_count }];
      }

      return [];
    }

    // Handle unlocked_modifier_pools table queries
    if (query.includes('unlocked_modifier_pools')) {
      const userId = params && params.length > 0 ? params[0] as string : 'test-user';
      const unlockedPoolsKey = 'unlocked_modifier_pools:' + userId;
      const unlockedPools: string[] = [];

      if (testStorage.has(unlockedPoolsKey)) {
        try {
          const stored = JSON.parse(testStorage.get(unlockedPoolsKey) as string);
          if (Array.isArray(stored)) {
            unlockedPools.push(...stored);
          }
        } catch {
          // Ignore parse errors
        }
      }

      // SELECT modifier_id FROM unlocked_modifier_pools WHERE user_id = $1 AND modifier_id = $2
      // This is used to check if a modifier is already unlocked
      if (query.includes('SELECT modifier_id') && query.includes('WHERE user_id =') && query.includes('AND modifier_id =') && params && params.length >= 2) {
        const modifierId = params[1] as string;
        if (unlockedPools.includes(modifierId)) {
          return [{ modifier_id: modifierId }];
        }
        return [];
      }

      // SELECT 1 FROM unlocked_modifier_pools WHERE user_id = $1 AND modifier_id = $2
      if (query.includes('SELECT 1') && query.includes('modifier_id') && query.includes('AND modifier_id =') && params && params.length >= 2) {
        const modifierId = params[1] as string;
        if (unlockedPools.includes(modifierId)) {
          return [1];
        }
        return [];
      }

      // SELECT modifier_id FROM unlocked_modifier_pools WHERE user_id = $1 ORDER BY unlocked_at ASC
      // This is used to get all unlocked modifier pools for a user
      if (query.includes('SELECT modifier_id') && query.includes('FROM unlocked_modifier_pools') && query.includes('ORDER BY')) {
        return unlockedPools.map((modifierId) => ({ modifier_id: modifierId }));
      }

      // INSERT INTO unlocked_modifier_pools
      if (query.includes('INSERT') && query.includes('unlocked_modifier_pools')) {
        const modifierId = params && params[1] ? params[1] as string : 'unknown';
        if (!unlockedPools.includes(modifierId)) {
          unlockedPools.push(modifierId);
          testStorage.set(unlockedPoolsKey, JSON.stringify(unlockedPools));
        }
        return [];
      }

      return [];
    }

    return [];
  });

  return {
    storageRead: storageReadMock,
    dbQuery: dbQueryMock,
    notificationSend: jest.fn(),
    storageWrite: jest.fn(
      (objects: { collection: string; key: string; userId?: string; value: string }[]) => {
        objects.forEach((obj) => {
          const userId = obj.userId ?? 'test-user';
          const key = `${obj.collection}:${obj.key}`;
          testStorage.set(key, obj.value);
          storageWriteCalls.push({
            collection: obj.collection,
            key: obj.key,
            userId: userId,
            value: obj.value,
            version: '1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: Date.now(),
            updateTime: Date.now(),
          });
        });
      }
    ),
    storageList: jest.fn(
      (_userId: string, _collection: string, _limit: number, _cursor: string, _prefix: string) => {
        return [];
      }
    ),
    leaderboardRecordList: jest.fn(
      (
        _id: string,
        _ownerIds: string[],
        _limit: number,
        _cursor: string,
        _overrideLimit: number
      ) => {
        return [];
      }
    ),
    leaderboardRecordWrite: jest.fn(
      (
        _id: string,
        ownerId: string,
        _username: string,
        score: number,
        _subScore: number,
        _metadata: Record<string, string>
      ) => {
        return { ownerId, score };
      }
    ),
    leaderboardCreate: jest.fn(
      (
        id: string,
        _authoritative: boolean,
        _sortOrder: string,
        _operator: string,
        _reset: string,
        _metadata: { [key: string]: string }
      ) => {
        return { id };
      }
    ),
    walletUpdate: jest.fn((_userId: string, _changes: { [key: string]: number }) => {
      return { updated: true };
    }),
  } as unknown as Runtime.Nakama;
};

// Simple exported mocks for convenience in tests
export const mockLogger = createMockLogger;
export const mockContext = createMockContext;
export const mockNakama = createMockNakama;
