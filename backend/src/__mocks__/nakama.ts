import { Runtime } from "../types/nakama";

export const createMockLogger = (): Runtime.Logger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

export const createMockContext = (overrides?: Partial<Runtime.Context>): Runtime.Context => ({
  userId: "test-user-123",
  username: "TestPlayer",
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
  const storage: Map<string, string> = new Map();
  const storageReadCalls: MockStorageObject[] = [];
  const storageWriteCalls: MockStorageObject[] = [];

  return {
    storageRead: jest.fn((objects: { collection: string; key: string; userId?: string }[]) => {
      return objects.map(obj => {
        const userId = obj.userId || "test-user-123";
        const key = `${obj.collection}:${obj.key}`;
        storageReadCalls.push({ 
          collection: obj.collection, 
          key: obj.key, 
          userId: userId, 
          value: storage.get(key) || "", 
          version: "1", 
          permissionRead: 1, 
          permissionWrite: 1, 
          createTime: Date.now(), 
          updateTime: Date.now() 
        });
        return {
          collection: obj.collection,
          key: obj.key,
          userId: userId,
          value: storage.get(key) ?? null,
          version: "1",
          permissionRead: 1,
          permissionWrite: 1,
          createTime: Date.now(),
          updateTime: Date.now(),
        };
      });
    }),
    storageWrite: jest.fn((objects: { collection: string; key: string; userId?: string; value: string }[]) => {
      objects.forEach(obj => {
        const userId = obj.userId || "test-user-123";
        const key = `${obj.collection}:${obj.key}`;
        storage.set(key, obj.value);
        storageWriteCalls.push({
          collection: obj.collection,
          key: obj.key,
          userId: userId,
          value: obj.value,
          version: "1",
          permissionRead: 1,
          permissionWrite: 1,
          createTime: Date.now(),
          updateTime: Date.now(),
        });
      });
    }),
    storageList: jest.fn((userId: string, collection: string, limit: number, cursor: string, _prefix: string) => {
      return [];
    }),
    leaderboardRecords: jest.fn((id: string, authoritative: boolean, sortOrder: string, operator: string, reset: string, metadata: { [key: string]: string }) => {
      return [];
    }),
    leaderboardRecordList: jest.fn((id: string, ownerIds: string[], limit: number, cursor: string, overrideLimit: number) => {
      return [];
    }),
    leaderboardRecordWrite: jest.fn((id: string, ownerId: string, username: string, score: number, metadata: Record<string, string>) => {
      return { ownerId, score };
    }),
    leaderboardCreate: jest.fn((id: string, authoritative: boolean, sortOrder: string, operator: string, reset: string, metadata: { [key: string]: string }) => {
      return { id };
    }),
    walletUpdate: jest.fn((userId: string, updates: Record<string, number>, metadata: Record<string, string>) => {
      return { updated: true };
    }),
    storageDelete: jest.fn((objects: { collection: string; key: string; userId?: string }[]) => {
      objects.forEach(obj => {
        const key = `${obj.collection}:${obj.key}`;
        storage.delete(key);
      });
    }),
  };
};