import { Runtime } from '../../types/nakama';
import { normalizeStorageList, parseRecordMetadata, getStorageRawValue, toStorageValue, readPvpMatch } from '../storage-helpers';

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
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(getStorageRawValue(cycle)).toBeNull();
  });
  it('reads creator-owned matches without a database lookup', () => {
    const own = [{ value: { creator: 'user' } }];
    const storageRead = jest.fn().mockReturnValue(own);
    const sqlQuery = jest.fn();
    expect(readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')).toBe(own);
    expect(sqlQuery).not.toHaveBeenCalled();
  });
  it('resolves another participant match owner and reads that record', () => {
    const match = [{ value: { creator: 'creator' } }];
    const storageRead = jest.fn().mockReturnValueOnce([]).mockReturnValueOnce(match);
    const sqlQuery = jest.fn().mockReturnValue([{ user_id: 'creator' }]);
    expect(readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'opponent')).toBe(match);
    expect(storageRead).toHaveBeenLastCalledWith([{ collection: 'pvp_matches', key: 'match', userId: 'creator' }]);
  });
  it('fails closed when owner resolution is unavailable or fails', () => {
    const storageRead = jest.fn().mockReturnValue([]);
    expect(readPvpMatch({ storageRead } as unknown as Runtime.Nakama, 'match', 'user')).toEqual([]);
    for (const rows of [[], [{ user_id: null }], [{ user_id: 'user' }]]) {
      const sqlQuery = jest.fn().mockReturnValue(rows);
      expect(readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')).toEqual([]);
    }
    const sqlQuery = jest.fn().mockImplementation(() => { throw new Error('unavailable'); });
    expect(readPvpMatch({ storageRead, sqlQuery } as unknown as Runtime.Nakama, 'match', 'user')).toEqual([]);
  });
});
