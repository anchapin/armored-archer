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
    if (query.includes('player_loadout') && query.includes('SELECT')) {
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
    if (query.includes('player_loadout') && query.includes('ON CONFLICT') && query.includes('INSERT') && params) {
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
    if (query.includes('player_loadout') && query.includes('INSERT') && !query.includes('ON CONFLICT') && params) {
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
    if (query.includes('player_loadout') && (query.includes('UPDATE') || query.includes('ON CONFLICT')) && params) {
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
    if (query.includes('player_loadout')) {
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
