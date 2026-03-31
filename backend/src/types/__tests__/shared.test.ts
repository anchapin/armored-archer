import {
  LoggerArgs,
  StorageMetadata,
  NotificationContent,
  LeaderboardMetadata,
  WalletUpdateMetadata,
  MatchParams,
  BeforeAfterData,
  LeaderboardRecord,
  StreamUserListResult,
  MatchResult,
  CacheValueType,
  RpcResponse,
} from '../shared';

describe('LoggerArgs interface', () => {
  test('should accept dynamic key-value pairs', () => {
    const args: LoggerArgs = {
      userId: '123',
      action: 'login',
      timestamp: Date.now(),
    };

    expect(args.userId).toBe('123');
    expect(args.action).toBe('login');
  });

  test('should handle empty object', () => {
    const args: LoggerArgs = {};
    expect(Object.keys(args)).toHaveLength(0);
  });
});

describe('StorageMetadata interface', () => {
  test('should accept dynamic metadata', () => {
    const metadata: StorageMetadata = {
      version: 2,
      lastModified: '2024-01-01',
      author: 'system',
    };

    expect(metadata.version).toBe(2);
    expect(metadata.author).toBe('system');
  });
});

describe('NotificationContent interface', () => {
  test('should accept notification content', () => {
    const content: NotificationContent = {
      title: 'New Reward',
      body: 'You earned 100 gems!',
      type: 'reward',
      data: { amount: 100, currency: 'gems' },
    };

    expect(content.title).toBe('New Reward');
    expect((content.data as any).amount).toBe(100);
  });
});

describe('LeaderboardMetadata interface', () => {
  test('should accept leaderboard metadata', () => {
    const metadata: LeaderboardMetadata = {
      season: 5,
      region: 'global',
      resetDate: '2024-12-31',
    };

    expect(metadata.season).toBe(5);
    expect(metadata.region).toBe('global');
  });
});

describe('WalletUpdateMetadata interface', () => {
  test('should accept wallet update metadata', () => {
    const metadata: WalletUpdateMetadata = {
      reason: 'purchase',
      productId: 'gem_pack_100',
      transactionId: 'txn_123',
    };

    expect(metadata.reason).toBe('purchase');
    expect(metadata.transactionId).toBe('txn_123');
  });
});

describe('MatchParams interface', () => {
  test('should accept match parameters', () => {
    const params: MatchParams = {
      matchType: 'ranked',
      minRank: 1000,
      maxRank: 2000,
      region: 'us-east',
    };

    expect(params.matchType).toBe('ranked');
    expect(params.minRank).toBe(1000);
  });
});

describe('BeforeAfterData interface', () => {
  test('should accept before/after comparison data', () => {
    const data: BeforeAfterData = {
      before: { health: 100, mana: 50 },
      after: { health: 80, mana: 30 },
      action: 'combat',
    };

    expect(data.action).toBe('combat');
    expect((data.after as any).health).toBe(80);
  });
});

describe('LeaderboardRecord interface', () => {
  test('should accept full leaderboard record', () => {
    const record: LeaderboardRecord = {
      ownerId: 'player_123',
      username: 'TestPlayer',
      rank: 1,
      score: 10000,
      metadata: '{"season": 5}',
      expiry: 1735689600000,
      maxNumScore: 100,
      numScore: 50,
    };

    expect(record.ownerId).toBe('player_123');
    expect(record.username).toBe('TestPlayer');
    expect(record.rank).toBe(1);
    expect(record.score).toBe(10000);
    expect(record.metadata).toBe('{"season": 5}');
    expect(record.numScore).toBe(50);
  });

  test('should work with required fields only', () => {
    const record: LeaderboardRecord = {
      ownerId: 'player_456',
      username: 'MinimalPlayer',
      rank: 99,
      score: 500,
    };

    expect(record.ownerId).toBe('player_456');
    expect(record.metadata).toBeUndefined();
    expect(record.expiry).toBeUndefined();
  });
});

describe('StreamUserListResult interface', () => {
  test('should accept stream user result', () => {
    const result: StreamUserListResult = {
      userId: 'user_789',
      presence: { sessionId: 'session_123', status: 'online' },
    };

    expect(result.userId).toBe('user_789');
    expect((result.presence as any).status).toBe('online');
  });
});

describe('MatchResult interface', () => {
  test('should accept successful match result', () => {
    const result: MatchResult = {
      success: true,
      matchId: 'match_123',
      duration: 300,
    };

    expect(result.success).toBe(true);
    expect(result.matchId).toBe('match_123');
  });

  test('should accept failed match result', () => {
    const result: MatchResult = {
      success: false,
      reason: 'timeout',
    };

    expect(result.success).toBe(false);
    expect(result.reason).toBe('timeout');
  });
});

describe('CacheValueType type', () => {
  test('should accept string values', () => {
    const value: CacheValueType = 'test';
    expect(value).toBe('test');
  });

  test('should accept number values', () => {
    const value: CacheValueType = 42;
    expect(value).toBe(42);
  });

  test('should accept boolean values', () => {
    const value: CacheValueType = true;
    expect(value).toBe(true);
  });

  test('should accept null', () => {
    const value: CacheValueType = null;
    expect(value).toBeNull();
  });

  test('should accept undefined', () => {
    const value: CacheValueType = undefined;
    expect(value).toBeUndefined();
  });

  test('should accept object values', () => {
    const value: CacheValueType = { key: 'value' };
    expect((value as Record<string, unknown>).key).toBe('value');
  });

  test('should accept array values', () => {
    const value: CacheValueType = [1, 2, 3];
    expect((value as unknown[])).toEqual([1, 2, 3]);
  });
});

describe('RpcResponse interface', () => {
  test('should accept success response', () => {
    const response: RpcResponse = {
      success: true,
      data: { level: 10 },
    };

    expect(response.success).toBe(true);
    expect((response as any).data.level).toBe(10);
  });

  test('should accept error response', () => {
    const response: RpcResponse = {
      success: false,
      error: 'Something went wrong',
    };

    expect(response.success).toBe(false);
    expect(response.error).toBe('Something went wrong');
  });

  test('should accept response without success flag', () => {
    const response: RpcResponse = {
      result: 'ok',
      count: 5,
    };

    expect(response.success).toBeUndefined();
    expect((response as any).count).toBe(5);
  });

  test('should handle empty response', () => {
    const response: RpcResponse = {};
    expect(response.success).toBeUndefined();
    expect(response.error).toBeUndefined();
  });
});
