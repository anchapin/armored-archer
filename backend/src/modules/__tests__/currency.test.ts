/**
 * Currency ledger tests (issue #860).
 *
 * Covers the unified currency ledger contract:
 * - All earned currency lands in the `player_currency` storage record
 * - Balances are visible via get_currency and spendable via spend_gems
 * - The one-time legacy wallet bridge folds pre-fix wallet balances with
 *   zero loss and never double-counts
 * - No code path dual-writes to the Nakama wallet anymore
 */

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((name, fn) => fn()),
  createCircuitBreaker: jest.fn(),
  getCircuitBreaker: jest.fn(),
  resetAllCircuits: jest.fn(),
}));

import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
  testWallets,
} from '../../__mocks__/nakama';
import {
  getCurrency,
  applyCurrencyDelta,
  MAX_GEM_BALANCE,
  PLAYER_CURRENCY_COLLECTION,
  PlayerCurrency,
} from '../currency';
import { rpcGetCurrency, rpcSpendGems } from '../store';
import { Runtime } from '../../types/nakama';

describe('currency ledger (issue #860)', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const readLedger = (userId: string): PlayerCurrency | undefined => {
    const raw = testStorage.get(`${PLAYER_CURRENCY_COLLECTION}:${userId}`);
    return raw ? (JSON.parse(raw) as PlayerCurrency) : undefined;
  };

  const writeLedger = (currency: PlayerCurrency): void => {
    testStorage.set(`${PLAYER_CURRENCY_COLLECTION}:${currency.user_id}`, JSON.stringify(currency));
  };

  beforeEach(() => {
    testStorage.clear();
    testWallets.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user' });
    mockNk = createMockNakama();
  });

  describe('getCurrency', () => {
    it('returns zero balances for a fresh player without creating a record', () => {
      const currency = getCurrency(mockNk, 'fresh-user', mockLogger);

      expect(currency).toEqual({ user_id: 'fresh-user', gems: 0, gold: 0 });
      // Empty wallet + no existing record → nothing to bridge or persist
      expect(readLedger('fresh-user')).toBeUndefined();
    });

    it('returns the stored ledger record for an existing player', () => {
      writeLedger({ user_id: 'test-user', gems: 120, gold: 340 });

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(120);
      expect(currency.gold).toBe(340);
    });

    it('falls back to zero balances on a corrupt record', () => {
      testStorage.set(`${PLAYER_CURRENCY_COLLECTION}:test-user`, 'not-json{');

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(0);
      expect(currency.gold).toBe(0);
    });
  });

  describe('applyCurrencyDelta', () => {
    it('credits earned gems and coins to the storage ledger', () => {
      const result = applyCurrencyDelta(mockNk, 'test-user', { gems: 7, gold: 50 }, 'match_rewards', mockLogger);

      expect(result.gems).toBe(7);
      expect(result.gold).toBe(50);

      const stored = readLedger('test-user');
      expect(stored).toBeDefined();
      expect(stored!.gems).toBe(7);
      expect(stored!.gold).toBe(50);
      expect(stored!.user_id).toBe('test-user');
    });

    it('accumulates across multiple awards', () => {
      applyCurrencyDelta(mockNk, 'test-user', { gems: 3, gold: 50 }, 'match_rewards', mockLogger);
      applyCurrencyDelta(mockNk, 'test-user', { gems: 4, gold: 10 }, 'match_rewards', mockLogger);

      const stored = readLedger('test-user');
      expect(stored!.gems).toBe(7);
      expect(stored!.gold).toBe(60);
    });

    it('debits and floors balances at zero', () => {
      writeLedger({ user_id: 'test-user', gems: 5, gold: 20 });

      const result = applyCurrencyDelta(mockNk, 'test-user', { gems: -9, gold: -30 }, 'respec_stats', mockLogger);

      expect(result.gems).toBe(0);
      expect(result.gold).toBe(0);
    });

    it('performs no storage write for an empty delta', () => {
      const storageWriteSpy = jest.spyOn(mockNk, 'storageWrite');

      const result = applyCurrencyDelta(mockNk, 'test-user', {}, 'match_rewards', mockLogger);

      expect(result).toEqual({ user_id: 'test-user', gems: 0, gold: 0 });
      expect(storageWriteSpy).not.toHaveBeenCalled();
    });

    it('caps gem credits at MAX_GEM_BALANCE', () => {
      writeLedger({ user_id: 'test-user', gems: MAX_GEM_BALANCE - 1, gold: 0 });

      const result = applyCurrencyDelta(mockNk, 'test-user', { gems: 100 }, 'season_end_distribution', mockLogger);

      expect(result.gems).toBe(MAX_GEM_BALANCE);
    });

    it('retries once when the version-guarded write conflicts', () => {
      const originalWrite = mockNk.storageWrite;
      let ledgerWriteCount = 0;
      mockNk.storageWrite = jest.fn((writes: unknown[]) => {
        const isLedgerWrite = Array.isArray(writes) && writes.length > 0 &&
          (writes[0] as { collection?: string }).collection === PLAYER_CURRENCY_COLLECTION;
        if (isLedgerWrite) {
          ledgerWriteCount++;
          if (ledgerWriteCount === 1) {
            throw new Error('storage write rejected: version check failed');
          }
        }
        return (originalWrite as (w: unknown[]) => void)(writes);
      }) as never;

      const result = applyCurrencyDelta(mockNk, 'test-user', { gems: 5 }, 'match_rewards', mockLogger);

      expect(result.gems).toBe(5);
      // First attempt conflicted, second attempt succeeded
      expect(ledgerWriteCount).toBe(2);
    });

    it('never writes to the Nakama wallet', () => {
      applyCurrencyDelta(mockNk, 'test-user', { gems: 7, gold: 50 }, 'match_rewards', mockLogger);

      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });
  });

  describe('legacy wallet bridge (zero balance loss)', () => {
    it('folds pre-existing wallet gems and coins into the ledger on first read', () => {
      // Pre-fix state: match/season rewards accumulated in the wallet
      // while the storage ledger stayed empty.
      testWallets.set('test-user', JSON.stringify({ gems: 23, coins: 450 }));

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(23);
      expect(currency.gold).toBe(450);

      const stored = readLedger('test-user');
      expect(stored!.gems).toBe(23);
      expect(stored!.gold).toBe(450);
      expect(stored!.wallet_bridged).toBe(true);
    });

    it('adds wallet balances on top of existing ledger balances', () => {
      writeLedger({ user_id: 'test-user', gems: 100, gold: 1000 });
      testWallets.set('test-user', JSON.stringify({ gems: 23, coins: 450 }));

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(123);
      expect(currency.gold).toBe(1450);
    });

    it('never double-counts: second read is stable', () => {
      testWallets.set('test-user', JSON.stringify({ gems: 23, coins: 450 }));

      const first = getCurrency(mockNk, 'test-user', mockLogger);
      const second = getCurrency(mockNk, 'test-user', mockLogger);
      const third = getCurrency(mockNk, 'test-user', mockLogger);

      expect(first).toEqual(second);
      expect(second).toEqual(third);
      expect(third.gems).toBe(23);
      expect(third.gold).toBe(450);
    });

    it('ignores the legacy `gem` (singular) respec debt key and negative balances', () => {
      testWallets.set(
        'test-user',
        JSON.stringify({ gems: 10, coins: 20, gem: -500, gold: -1000 })
      );

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      // `gem` is ignored entirely; negative values are clamped away
      expect(currency.gems).toBe(10);
      expect(currency.gold).toBe(20);
    });

    it('bridges a player who has wallet balances but no storage record', () => {
      testWallets.set('stranded-user', JSON.stringify({ gems: 600, coins: 8500 }));

      const currency = getCurrency(mockNk, 'stranded-user', mockLogger);

      expect(currency.gems).toBe(600);
      expect(currency.gold).toBe(8500);
      expect(readLedger('stranded-user')!.wallet_bridged).toBe(true);
    });

    it('treats an unparseable wallet as empty', () => {
      testWallets.set('test-user', '}{ not json');
      writeLedger({ user_id: 'test-user', gems: 40, gold: 60 });

      const currency = getCurrency(mockNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(40);
      expect(currency.gold).toBe(60);
    });

    it('skips bridging when accountGetId is unavailable', () => {
      // Hand-rolled mocks (and runtimes without account read access) must
      // still get a working ledger read.
      const limitedNk = {
        storageRead: mockNk.storageRead,
        storageWrite: mockNk.storageWrite,
      } as unknown as Runtime.Nakama;
      writeLedger({ user_id: 'test-user', gems: 15, gold: 25 });

      const currency = getCurrency(limitedNk, 'test-user', mockLogger);

      expect(currency.gems).toBe(15);
      expect(currency.gold).toBe(25);
    });
  });

  describe('earn → display → spend round trip (acceptance criteria)', () => {
    it('makes punch-up gems earned via matches visible and spendable', () => {
      // Punch-up underdog win rewards (3-10 gems) — previously written to
      // the wallet where spend_gems could not see them.
      applyCurrencyDelta(mockNk, 'test-user', { gems: 8, gold: 50 }, 'match_rewards', mockLogger);

      // Displayed via get_currency
      const displayed = JSON.parse(rpcGetCurrency(mockCtx, mockLogger, mockNk, '{}'));
      expect(displayed.gems).toBe(8);
      expect(displayed.gold).toBe(50);

      // Spendable via spend_gems
      const spent = JSON.parse(
        rpcSpendGems(mockCtx, mockLogger, mockNk, JSON.stringify({ amount: 6 }))
      );
      expect(spent.success).toBe(true);
      expect(spent.new_balance).toBe(2);

      // Ledger reflects the spend
      expect(readLedger('test-user')!.gems).toBe(2);
    });

    it('makes season coins and gems visible via get_currency', () => {
      // Season end distribution (rank ≤ 10: 8500 coins, 600 gems)
      applyCurrencyDelta(
        mockNk,
        'test-user',
        { gems: 600, gold: 8500 },
        'season_end_distribution',
        mockLogger
      );

      const displayed = JSON.parse(rpcGetCurrency(mockCtx, mockLogger, mockNk, '{}'));
      expect(displayed.gems).toBe(600);
      expect(displayed.gold).toBe(8500);
    });

    it('spends gems that arrived via the legacy wallet bridge', () => {
      // Player with stranded wallet gems from before the fix
      testWallets.set('test-user', JSON.stringify({ gems: 600, coins: 0 }));

      // First read triggers the bridge
      getCurrency(mockNk, 'test-user', mockLogger);

      const spent = JSON.parse(
        rpcSpendGems(mockCtx, mockLogger, mockNk, JSON.stringify({ amount: 600 }))
      );
      expect(spent.success).toBe(true);
      expect(spent.new_balance).toBe(0);
    });
  });

  describe('no dual-write regressions (store paths)', () => {
    it('get_currency and spend_gems never touch the wallet', () => {
      applyCurrencyDelta(mockNk, 'test-user', { gems: 100 }, 'match_rewards', mockLogger);

      rpcGetCurrency(mockCtx, mockLogger, mockNk, '{}');
      rpcSpendGems(mockCtx, mockLogger, mockNk, JSON.stringify({ amount: 10 }));

      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });
  });
});
