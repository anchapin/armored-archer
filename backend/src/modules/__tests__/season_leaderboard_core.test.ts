/**
 * Core ranking-logic tests for season_leaderboard (issue #1071).
 *
 * The pre-existing suites covered pure decay math and RPC shapes; these
 * tests execute the ranking engine end-to-end against a mocked nk and
 * assert the behaviors the coverage gate depends on:
 * - applyDailyDecay: exact decay amounts, rating floor, skip rules
 * - getTopPlayers: ordering by DECAYED rating (incl. order flips), rank reassignment
 * - getPlayerRank: standing recomputed from decayed ratings, null when unranked
 * - recordSeasonCompletion / getSeasonHistory: season archival
 */

import { createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import {
  applyDailyDecay,
  getPlayerRank,
  getTopPlayers,
  getPlayersLastActiveBatch,
  getSeasonHistory,
  recordSeasonCompletion,
} from '../season_leaderboard';
import { Runtime } from '../../types/nakama';

/** Minimal shape of nk.leaderboardRecordList entries used by this module. */
interface MockLeaderboardRecord {
  ownerId: string;
  username: string;
  rank: number;
  score: number;
  metadata: string;
}

describe('season_leaderboard_core', () => {
  let mockLogger: Runtime.Logger;
  let mockNk: Runtime.Nakama;
  let storageMap: Map<string, string>;
  let records: MockLeaderboardRecord[];
  let writeCalls: {
    id: string;
    ownerId: string;
    username: string;
    score: number;
    metadata: Record<string, unknown>;
  }[];
  let storageWrites: { collection: string; key: string; userId: string; value: string }[];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const SEASON_ID = 'season_42';

  /** Leaderboard record factory; rank defaults to score-descending position. */
  const makeRecord = (
    ownerId: string,
    score: number,
    metadata: Record<string, unknown> = {},
    rank?: number
  ): MockLeaderboardRecord => ({
    ownerId,
    username: `user_${ownerId}`,
    rank: rank ?? 1,
    score,
    metadata: JSON.stringify(metadata),
  });

  /** Seed player activity storage; daysAgo = 0 means active now. */
  const setPlayerActive = (playerId: string, daysAgo: number): void => {
    storageMap.set(
      `player_last_active:${playerId}`,
      JSON.stringify({ last_active: Date.now() - daysAgo * DAY_MS })
    );
  };

  /** Seed user_metadata storage (used for winner username lookup). */
  const setUserMetadata = (playerId: string, data: Record<string, unknown>): void => {
    storageMap.set(`user_metadata:${playerId}`, JSON.stringify(data));
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockNk = createMockNakama();
    storageMap = new Map();
    records = [];
    writeCalls = [];
    storageWrites = [];

    // Route storage reads through the local map (same pattern as
    // season_leaderboard_rpc.test.ts, which owns the RPC-level coverage).
    mockNk.storageRead = jest.fn(
      (queries: { collection: string; key: string; userId?: string }[]) => {
        return queries
          .map((q) => {
            let lookupKey: string;
            if (q.collection === 'player_last_active') {
              lookupKey = `player_last_active:${q.userId ?? ''}`;
            } else if (q.collection === 'user_metadata') {
              lookupKey = `user_metadata:${q.key}`;
            } else {
              lookupKey = `${q.collection}:${q.key}`;
            }
            const value = storageMap.get(lookupKey);
            if (value === undefined) return null;
            return {
              collection: q.collection,
              key: q.key,
              userId: q.userId ?? '',
              value,
              version: '1',
              permissionRead: 1,
              permissionWrite: 1,
              createTime: Date.now(),
              updateTime: Date.now(),
            };
          })
          .filter(Boolean);
      }
    ) as any;

    mockNk.storageWrite = jest.fn(
      (objects: { collection: string; key: string; userId?: string; value: string }[]) => {
        objects.forEach((obj) => {
          storageWrites.push({
            collection: obj.collection,
            key: obj.key,
            userId: obj.userId ?? '',
            value: obj.value,
          });
          storageMap.set(`${obj.collection}:${obj.key}`, obj.value);
        });
      }
    ) as any;

    // Leaderboard list semantics: ownerIds filter when provided, else all
    // records (assumed pre-sorted by score desc), capped at limit.
    mockNk.leaderboardRecordList = jest.fn(
      (
        _id: string,
        ownerIds: string[],
        limit: number
      ): MockLeaderboardRecord[] => {
        const filtered =
          ownerIds && ownerIds.length > 0
            ? records.filter((r) => ownerIds.includes(r.ownerId))
            : records;
        return filtered.slice(0, limit);
      }
    ) as any;

    mockNk.leaderboardRecordWrite = jest.fn(
      (
        id: string,
        ownerId: string,
        username: string,
        score: number,
        _numScore: number,
        metadata: Record<string, unknown>
      ) => {
        writeCalls.push({ id, ownerId, username, score, metadata });
      }
    ) as any;
  });

  // ============================================
  // applyDailyDecay — decay amounts
  // ============================================
  describe('applyDailyDecay', () => {
    it('skips active players and players whose decay period has not elapsed', async () => {
      records = [
        makeRecord('active-player', 2000, {}, 1), // active now: 0 days
        makeRecord('ten-days', 2000, {}, 2), // 10d: floor((10-7)/7) = 0 periods -> no loss
      ];
      setPlayerActive('active-player', 0);
      setPlayerActive('ten-days', 10);

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 0, total_loss: 0 });
      expect(writeCalls).toHaveLength(0);
    });

    it('applies exactly 1% per decay period and records the loss in metadata', async () => {
      records = [makeRecord('lapsed', 2000, {}, 1)];
      setPlayerActive('lapsed', 15); // floor((15-7)/7) = 1 period @ 1% = 20 pts

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 1, total_loss: 20 });
      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0].ownerId).toBe('lapsed');
      expect(writeCalls[0].score).toBe(1980);
      expect(writeCalls[0].metadata).toMatchObject({
        decayed: 'true',
        original_rating: '2000',
        decay_amount: '20',
        days_inactive: '15',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Rating decay applied',
        expect.objectContaining({ player_id: 'lapsed', decay_amount: 20 })
      );
    });

    it('uses the 2% high-decay rate past the 30-day threshold', async () => {
      records = [makeRecord('gone', 2000, {}, 1)];
      setPlayerActive('gone', 36); // floor((36-7)/7) = 4 periods @ 2% = 160 pts

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 1, total_loss: 160 });
      expect(writeCalls[0].score).toBe(1840);
    });

    it('never decays a rating below minimum_rating (floor)', async () => {
      records = [makeRecord('low', 1010, {}, 1)];
      setPlayerActive('low', 100); // raw loss would be 1010*2%*13 = 262.6 -> capped 200

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      // 1010 - 200 = 810 clamps to the 1000 floor; actual loss is only 10.
      expect(result).toEqual({ affected: 1, total_loss: 10 });
      expect(writeCalls[0].score).toBe(1000);
      expect(writeCalls[0].metadata).toMatchObject({ decay_amount: '10' });
    });

    it('skips players already at or below the rating floor', async () => {
      records = [makeRecord('floor', 900, {}, 1)];
      setPlayerActive('floor', 50);

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 0, total_loss: 0 });
      expect(writeCalls).toHaveLength(0);
    });

    it('accumulates affected count and total loss across players', async () => {
      records = [
        makeRecord('a', 2000, {}, 2),
        makeRecord('b', 3000, {}, 1),
        makeRecord('c', 1000, {}, 3), // at floor, skipped
      ];
      setPlayerActive('a', 15); // 1% x1 = 20
      setPlayerActive('b', 15); // 1% x1 = 30
      setPlayerActive('c', 15);

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 2, total_loss: 50 });
      expect(writeCalls).toHaveLength(2);
    });

    it('honors a custom decay config from storage', async () => {
      storageMap.set(
        'rating_decay_config:rating_decay_config',
        JSON.stringify({
          inactive_days_threshold: 7,
          decay_rate_percent: 5,
          high_decay_threshold_days: 30,
          high_decay_rate_percent: 10,
          minimum_rating: 1000,
          max_decay_loss: 200,
        })
      );
      records = [makeRecord('custom', 2000, {}, 1)];
      setPlayerActive('custom', 15); // 1 period @ 5% = 100 pts

      const result = await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      expect(result).toEqual({ affected: 1, total_loss: 100 });
      expect(writeCalls[0].score).toBe(1900);
    });
  });

  // ============================================
  // getTopPlayers — ordering by decayed rating
  // ============================================
  describe('getTopPlayers', () => {
    it('orders by decayed rating and reassigns ranks, even when decay flips raw order', async () => {
      // Raw order: dormant (2000) > active (1900).
      // Decayed: dormant loses floor((36-7)/7)=4 periods @2% = 160 -> 1840,
      // so the active player must rank first.
      records = [
        makeRecord('dormant', 2000, {}, 1),
        makeRecord('active', 1900, {}, 2),
      ];
      setPlayerActive('dormant', 36);
      setPlayerActive('active', 0);

      const rankings = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(rankings.map((r) => r.player_id)).toEqual(['active', 'dormant']);
      expect(rankings.map((r) => r.rank)).toEqual([1, 2]);
      expect(rankings[0].decayed_rating).toBe(1900);
      expect(rankings[1].decayed_rating).toBe(1840);
      expect(rankings[1].rating).toBe(2000); // raw rating preserved
      expect(rankings[1].days_inactive).toBe(36);
    });

    it('keeps raw order when no decay applies', async () => {
      records = [
        makeRecord('top', 2100, {}, 1),
        makeRecord('mid', 2000, {}, 2),
        makeRecord('low', 1900, {}, 3),
      ];
      ['top', 'mid', 'low'].forEach((p) => setPlayerActive(p, 0));

      const rankings = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(rankings.map((r) => r.player_id)).toEqual(['top', 'mid', 'low']);
      expect(rankings.map((r) => r.rank)).toEqual([1, 2, 3]);
    });

    it('filters by mode when requested', async () => {
      records = [
        makeRecord('solo', 2100, { mode: '1v1' }, 1),
        makeRecord('duo', 2000, { mode: '2v2' }, 2),
      ];
      ['solo', 'duo'].forEach((p) => setPlayerActive(p, 0));

      const rankings = await getTopPlayers(mockNk, SEASON_ID, '2v2', 100);

      expect(rankings).toHaveLength(1);
      expect(rankings[0].player_id).toBe('duo');
      expect(rankings[0].mode).toBe('2v2');
    });

    it('defaults metadata-derived fields when metadata is empty', async () => {
      records = [makeRecord('bare', 1500, {}, 1)];
      setPlayerActive('bare', 0);

      const [ranking] = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(ranking).toMatchObject({
        player_id: 'bare',
        mode: '1v1',
        matches: 0,
        wins: 0,
        losses: 0,
        win_rate: 0,
        punch_up_wins: 0,
        rating: 1500,
        decayed_rating: 1500,
      });
    });

    it('parses match metadata into the ranking entry', async () => {
      records = [
        makeRecord('veteran', 1800, {
          mode: '2v2',
          matches: 20,
          wins: 15,
          losses: 5,
          win_rate: 0.75,
          punch_up_wins: 4,
        }, 1),
      ];
      setPlayerActive('veteran', 0);

      const [ranking] = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(ranking).toMatchObject({
        matches: 20,
        wins: 15,
        losses: 5,
        win_rate: 0.75,
        punch_up_wins: 4,
        mode: '2v2',
      });
    });
  });

  // ============================================
  // getPlayerRank — rank lookup
  // ============================================
  describe('getPlayerRank', () => {
    it('returns null when the player has no leaderboard record', async () => {
      records = [makeRecord('someone-else', 1500, {}, 1)];
      setPlayerActive('someone-else', 0);
      setPlayerActive('ghost', 0);

      const result = await getPlayerRank(mockNk, SEASON_ID, 'ghost');

      expect(result).toBeNull();
    });

    it('computes standing against DECAYED ratings of all other players', async () => {
      // target: active at 2000.
      // higher: active at 2200 -> above (1 player above).
      // faded: raw 2100 but 40d inactive -> floor((40-7)/7)=4 periods @2% = 168 -> 1932, below.
      records = [
        makeRecord('higher', 2200, {}, 1),
        makeRecord('faded', 2100, {}, 2),
        makeRecord('target', 2000, {}, 3),
      ];
      setPlayerActive('higher', 0);
      setPlayerActive('faded', 40);
      setPlayerActive('target', 0);

      const result = await getPlayerRank(mockNk, SEASON_ID, 'target');

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(2);
      expect(result!.entry).toMatchObject({
        player_id: 'target',
        rating: 2000,
        decayed_rating: 2000,
        days_inactive: 0,
      });
    });

    it('returns rank 1 when no decayed rating is higher', async () => {
      records = [
        makeRecord('target', 2000, {}, 2),
        makeRecord('faded', 2100, {}, 1),
      ];
      setPlayerActive('target', 0);
      setPlayerActive('faded', 40); // 2100 -> 1932

      const result = await getPlayerRank(mockNk, SEASON_ID, 'target');

      expect(result!.rank).toBe(1);
    });

    it('exposes match metadata on the returned entry', async () => {
      records = [
        makeRecord('target', 2000, {
          mode: '2v2',
          wins: 10,
          losses: 2,
          win_rate: 0.83,
        }, 1),
      ];
      setPlayerActive('target', 0);

      const result = await getPlayerRank(mockNk, SEASON_ID, 'target');

      expect(result!.entry).toMatchObject({
        mode: '2v2',
        wins: 10,
        losses: 2,
        win_rate: 0.83,
      });
    });
  });

  // ============================================
  // recordSeasonCompletion — season archival
  // ============================================
  describe('recordSeasonCompletion', () => {
    it('archives an empty season with parsed season number and no winner', async () => {
      const archive = await recordSeasonCompletion(mockNk, SEASON_ID, mockLogger);

      expect(archive).toMatchObject({
        season_id: SEASON_ID,
        season_number: 42,
        winner_id: '',
        winner_name: '',
        winner_rating: 0,
        total_players: 0,
        rewards_distributed: false,
      });
      // Season window comes from getCurrentSeasonInfo: a 30-day window around now.
      expect(archive.end_time - archive.start_time).toBe(30 * DAY_MS);
      expect(archive.start_time).toBeLessThanOrEqual(Date.now());
      expect(archive.end_time).toBeGreaterThan(Date.now());

      // The archive must be persisted under the system-user storage key.
      expect(storageWrites).toHaveLength(1);
      expect(storageWrites[0]).toMatchObject({
        collection: 'season_archive',
        key: 'season_archive',
        userId: '00000000-0000-0000-0000-000000000000',
      });
      const persisted = JSON.parse(storageWrites[0].value);
      expect(persisted[SEASON_ID]).toMatchObject({ season_number: 42, total_players: 0 });
      expect(mockLogger.info).toHaveBeenCalledWith('Season archived', expect.any(Object));
    });

    it('archives the season winner (name, raw rating) and player total', async () => {
      records = [
        makeRecord('champion', 2100, { wins: 30, losses: 2, win_rate: 0.94 }, 1),
        makeRecord('runner-up', 2000, { wins: 20, losses: 10, win_rate: 0.67 }, 2),
        makeRecord('also-ran', 1900, { wins: 1, losses: 5, win_rate: 0.17 }, 3),
      ];
      ['champion', 'runner-up', 'also-ran'].forEach((p) => setPlayerActive(p, 0));
      setUserMetadata('champion', { username: 'Bowmaster' });

      const archive = await recordSeasonCompletion(mockNk, SEASON_ID, mockLogger);

      expect(archive).toMatchObject({
        winner_id: 'champion',
        winner_name: 'Bowmaster',
        winner_rating: 2100,
        total_players: 3,
      });
      const persisted = JSON.parse(storageWrites[0].value);
      expect(persisted[SEASON_ID].winner_name).toBe('Bowmaster');
    });

    it('falls back to "Unknown" when the winner has no stored username', async () => {
      records = [makeRecord('anonymous', 2100, {}, 1)];
      setPlayerActive('anonymous', 0);

      const archive = await recordSeasonCompletion(mockNk, SEASON_ID, mockLogger);

      expect(archive.winner_id).toBe('anonymous');
      expect(archive.winner_name).toBe('Unknown');
    });

    it('merges the new archive into existing archived seasons', async () => {
      storageMap.set(
        'season_archive:season_archive',
        JSON.stringify({ season_41: { season_id: 'season_41', season_number: 41 } })
      );

      await recordSeasonCompletion(mockNk, SEASON_ID, mockLogger);

      const persisted = JSON.parse(storageWrites[0].value);
      expect(Object.keys(persisted).sort()).toEqual(['season_41', SEASON_ID]);
    });
  });

  // ============================================
  // getSeasonHistory — archived season reads
  // ============================================
  describe('getSeasonHistory', () => {
    const seedArchives = (): void => {
      storageMap.set(
        'season_archive:season_archive',
        JSON.stringify({
          season_1: { season_id: 'season_1', season_number: 1 },
          season_2: { season_id: 'season_2', season_number: 2 },
          season_3: { season_id: 'season_3', season_number: 3 },
        })
      );
    };

    it('returns archived seasons in descending season order', async () => {
      seedArchives();

      const history = await getSeasonHistory(mockNk, 10);

      expect(history.map((s) => s.season_number)).toEqual([3, 2, 1]);
    });

    it('respects the limit parameter', async () => {
      seedArchives();

      const history = await getSeasonHistory(mockNk, 2);

      expect(history.map((s) => s.season_number)).toEqual([3, 2]);
    });

    it('returns an empty array when nothing is archived', async () => {
      const history = await getSeasonHistory(mockNk, 10);

      expect(history).toEqual([]);
    });
  });

  // ============================================
  // getPlayerLastActive — storage fallbacks
  // ============================================
  describe('player activity fallbacks', () => {
    it('falls back to last_match_time when last_active is absent', async () => {
      const ts = Date.now() - 5 * DAY_MS;
      storageMap.set(
        'player_last_active:fallback',
        JSON.stringify({ last_match_time: ts })
      );
      records = [makeRecord('fallback', 2000, {}, 1)];

      const rankings = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(rankings[0].days_inactive).toBe(5);
    });

    it('treats missing activity storage as never-active (0 timestamp)', async () => {
      records = [makeRecord('never', 2000, {}, 1)];

      const rankings = await getTopPlayers(mockNk, SEASON_ID, null, 100);

      expect(rankings[0].days_inactive).toBeGreaterThanOrEqual(19000); // since epoch
      expect(rankings[0].decayed_rating).toBeGreaterThanOrEqual(1000); // decayed to floor-ish
    });
  });

  // ============================================
  // N+1 batched-storageRead regression guard (issue #1089)
  //
  // The leaderboard page is a hot path: rendering N entries previously
  // triggered N round-trips to the `player_last_active` collection
  // (one `getPlayerLastActive` call per row). Each test below wraps the
  // mock's `storageRead` in a spy and asserts that, regardless of how many
  // players the caller asked about, exactly one batched read targets the
  // `player_last_active` collection. A future refactor that re-introduces
  // the per-player fan-out will flip the assertion below.
  // ============================================
  describe('issue #1089 — batched player_last_active storageRead', () => {
    /** Number of `storageRead` calls in this test that targeted the
     *  `player_last_active` collection (the only collection that was
     *  fanning out before the fix). */
    const countLastActiveReads = (
      spy: jest.SpyInstance
    ): { calls: number; largestBatch: number } => {
      let calls = 0;
      let largestBatch = 0;
      for (const call of spy.mock.calls) {
        const queries = call[0] as { collection: string }[];
        const batchSize = queries.filter((q) => q.collection === 'player_last_active').length;
        if (batchSize > 0) {
          calls += 1;
          if (batchSize > largestBatch) largestBatch = batchSize;
        }
      }
      return { calls, largestBatch };
    };

    it('getTopPlayers issues exactly one player_last_active storageRead for 100+ players', async () => {
      // Seed 120 players — well past the page-100 fan-out pain point.
      const playerCount = 120;
      records = Array.from({ length: playerCount }, (_, i) =>
        makeRecord(`player-${i}`, 2000 - i, {}, i + 1)
      );
      records.forEach((_, i) => setPlayerActive(`player-${i}`, i % 30));

      const storageSpy = jest.spyOn(mockNk, 'storageRead');

      const rankings = await getTopPlayers(mockNk, SEASON_ID, null, 500);

      expect(rankings).toHaveLength(playerCount);
      const { calls, largestBatch } = countLastActiveReads(storageSpy);
      expect(calls).toBe(1);
      expect(largestBatch).toBe(playerCount);
      storageSpy.mockRestore();
    });

    it('applyDailyDecay issues exactly one player_last_active storageRead across the leaderboard', async () => {
      const playerCount = 150;
      records = Array.from({ length: playerCount }, (_, i) =>
        makeRecord(`decay-${i}`, 2000, {}, i + 1)
      );
      records.forEach((_, i) => setPlayerActive(`decay-${i}`, 15));

      const storageSpy = jest.spyOn(mockNk, 'storageRead');

      await applyDailyDecay(mockNk, SEASON_ID, mockLogger);

      const { calls, largestBatch } = countLastActiveReads(storageSpy);
      expect(calls).toBe(1);
      expect(largestBatch).toBe(playerCount);
      storageSpy.mockRestore();
    });

    it('getPlayerRank issues exactly one player_last_active storageRead against the full comparison set', async () => {
      // Bigger comparison set so the N+1 pattern would generate
      // many storageRead calls.
      const competitorCount = 200;
      records = Array.from({ length: competitorCount }, (_, i) =>
        makeRecord(`rival-${i}`, 1900 - i, {}, i + 1)
      );
      records.push(makeRecord('subject', 1800, {}, competitorCount + 1));
      records.forEach((_, i) => setPlayerActive(`rival-${i}`, 0));
      setPlayerActive('subject', 0);

      const storageSpy = jest.spyOn(mockNk, 'storageRead');

      const result = await getPlayerRank(mockNk, SEASON_ID, 'subject');

      expect(result).not.toBeNull();
      const { calls, largestBatch } = countLastActiveReads(storageSpy);
      // The batch must be a single call covering every ownerId the rank
      // computation consults (target + every competitor) — exactly one
      // player_last_active read, regardless of comparison-set size.
      expect(calls).toBe(1);
      expect(largestBatch).toBe(competitorCount + 1);
      storageSpy.mockRestore();
    });

    it('getPlayersLastActiveBatch collapses N inputs into one storageRead', async () => {
      const playerCount = 250;
      const ids = Array.from({ length: playerCount }, (_, i) => `batch-${i}`);
      ids.forEach((id) => setPlayerActive(id, 0));

      const storageSpy = jest.spyOn(mockNk, 'storageRead');

      const result = await getPlayersLastActiveBatch(mockNk, ids);

      const { calls, largestBatch } = countLastActiveReads(storageSpy);
      expect(calls).toBe(1);
      expect(largestBatch).toBe(playerCount);

      // And the helper still returns a usable map (every requested id
      // is present, regardless of whether the storage row existed).
      expect(result.size).toBe(playerCount);
      expect(result.get('batch-0')).toBeGreaterThan(0);
      storageSpy.mockRestore();
    });
  });
});
