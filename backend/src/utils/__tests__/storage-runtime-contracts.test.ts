import { Runtime } from '../../types/nakama';
import {
  normalizeStorageList,
  parseRecordMetadata,
  getStorageRawValue,
  toStorageValue,
  readPvpMatch,
} from '../storage-helpers';

describe('Nakama storage runtime contracts', () => {
  it('normalizes real storageList pages and legacy arrays', () => {
    const objects = [{ value: { score: 10 } }];
    expect(normalizeStorageList(objects)).toBe(objects);
    expect(normalizeStorageList({ objects, cursor: 'next' })).toBe(objects);
    expect(normalizeStorageList({ objects: null })).toEqual([]);
    expect(normalizeStorageList(null)).toEqual([]);
  });
  it('keeps object metadata and decodes string metadata without throwing', () => {
    const object = { season: 1 };
    expect(parseRecordMetadata(object)).toBe(object);
    expect(parseRecordMetadata('{"season":1}')).toEqual(object);
    for (const value of [null, undefined, '', 42, 'false', 'invalid']) {
      expect(parseRecordMetadata(value)).toEqual({});
    }
  });
  it('normalizes storage values without double-encoding object writes', () => {
    const object = { gems: 10 };
    expect(toStorageValue(object)).toBe(object);
    expect(toStorageValue('{"gems":10}')).toEqual(object);
    expect(toStorageValue('[1,2]')).toEqual({ value: [1, 2] });
    expect(toStorageValue('invalid')).toEqual({ value: 'invalid' });
    expect(toStorageValue(null)).toEqual({ value: null });
    expect(getStorageRawValue(object)).toBe('{"gems":10}');
    expect(getStorageRawValue('raw')).toBe('raw');
    expect(getStorageRawValue(null)).toBeNull();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(getStorageRawValue(cycle)).toBeNull();
  });
  it('reads creator-owned matches without a database lookup', () => {
    const own = [{ value: { creator: 'user' } }];
    const storageRead = jest.fn().mockReturnValue(own);
    const sqlQuery = jest.fn();
    expect(
      readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')
    ).toBe(own);
    expect(sqlQuery).not.toHaveBeenCalled();
  });
  it('resolves another participant match owner and reads that record', () => {
    const match = [{ value: { creator: 'creator' } }];
    const storageRead = jest.fn().mockReturnValueOnce([]).mockReturnValueOnce(match);
    const sqlQuery = jest.fn().mockReturnValue([{ user_id: 'creator' }]);
    expect(
      readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'opponent')
    ).toBe(match);
    expect(storageRead).toHaveBeenLastCalledWith([
      { collection: 'pvp_matches', key: 'match', userId: 'creator' },
    ]);
  });
  it('fails closed when owner resolution is unavailable or fails', () => {
    const storageRead = jest.fn().mockReturnValue([]);
    expect(readPvpMatch({ storageRead } as unknown as Runtime.Nakama, 'match', 'user')).toEqual([]);
    for (const rows of [[], [{ user_id: null }], [{ user_id: 'user' }]]) {
      const sqlQuery = jest.fn().mockReturnValue(rows);
      expect(
        readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')
      ).toEqual([]);
    }
    const sqlQuery = jest.fn().mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(
      readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')
    ).toEqual([]);
  });
});

describe('match owner SQL failure observability', () => {
  it.each([
    'armored_archer/submit_combat_action',
    'armored_archer/get_match_state',
    'armored_archer/player_disconnect',
    'armored_archer/accept_match',
    'armored_archer/complete_match',
  ])('records a safe error and metric for %s while preserving the failed lookup', (rpc) => {
    const runtimeLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const storageRead = jest.fn(() => []);
    const sqlQuery = jest.fn(() => {
      throw new Error('private driver details');
    });
    const metricsCounterAdd = jest.fn();
    const nk = { storageRead, sqlQuery, metricsCounterAdd } as unknown as Runtime.Nakama;
    expect(
      readPvpMatch(nk, 'private-match', 'private-user', { rpc, logger: runtimeLogger })
    ).toEqual([]);
    expect(runtimeLogger.error).toHaveBeenCalledTimes(1);
    expect(runtimeLogger.error).toHaveBeenCalledWith(
      'Database query failed: rpc=%s op=%s',
      rpc,
      'pvp_matches.owner_lookup'
    );
    expect(metricsCounterAdd).toHaveBeenCalledWith(
      'db_errors_total',
      { op: 'pvp_matches.owner_lookup', rpc },
      1
    );
    expect(storageRead).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(runtimeLogger.error.mock.calls)).not.toContain('private');
  });

  it('preserves the lookup failure when the metric API fails', () => {
    const runtimeLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const nk = {
      storageRead: jest.fn(() => []),
      sqlQuery: jest.fn(() => {
        throw new Error('database unavailable');
      }),
      metricsCounterAdd: jest.fn(() => {
        throw new Error('metric unavailable');
      }),
    } as unknown as Runtime.Nakama;
    expect(
      readPvpMatch(nk, 'match', 'user', {
        rpc: 'armored_archer/get_match_state',
        logger: runtimeLogger,
      })
    ).toEqual([]);
    expect(runtimeLogger.error).toHaveBeenCalledTimes(1);
  });
});
