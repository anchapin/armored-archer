import { Runtime } from '../types/nakama';

export const createMockLogger = (): Runtime.Logger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

export const createMockContext = (overrides?: Partial<Runtime.Context>): Runtime.Context => ({
  userId: 'test-user-123',
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
  const storage: Map<string, string> = new Map();
  const storageReadCalls: MockStorageObject[] = [];
  const storageWriteCalls: MockStorageObject[] = [];

  return {
    storageRead: jest.fn((objects: { collection: string; key: string; userId?: string }[]) => {
      return objects.map((obj) => {
        const userId = obj.userId ?? 'test-user-123';
        const key = `${obj.collection}:${obj.key}`;
        storageReadCalls.push({
          collection: obj.collection,
          key: obj.key,
          userId: userId,
          value: storage.get(key) ?? '',
          version: '1',
          permissionRead: 1,
          permissionWrite: 1,
          createTime: Date.now(),
          updateTime: Date.now(),
        });
        return {
          collection: obj.collection,
          key: obj.key,
          userId: userId,
          value: storage.get(key) ?? '',
          version: '1',
          permissionRead: 1,
          permissionWrite: 1,
          createTime: Date.now(),
          updateTime: Date.now(),
        };
      });
    }),
    storageWrite: jest.fn(
      (objects: { collection: string; key: string; userId?: string; value: string }[]) => {
        objects.forEach((obj) => {
          const userId = obj.userId ?? 'test-user-123';
          const key = `${obj.collection}:${obj.key}`;
          storage.set(key, obj.value);
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
