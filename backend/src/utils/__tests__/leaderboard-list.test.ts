import { Runtime } from '../../types/nakama';
import { listLeaderboardRecords, listAllLeaderboardRecords } from '../leaderboard-list';

function runtime(fn: jest.Mock, legacy = false): Runtime.Nakama {
  return { [legacy ? 'leaderboardRecordList' : 'leaderboardRecordsList']: fn } as unknown as Runtime.Nakama;
}

describe('Nakama leaderboard runtime contracts', () => {
  it('uses the real plural API and clamps oversized limits', () => {
    const records = [{ rank: 1 }];
    const fn = jest.fn().mockReturnValue({ records, nextCursor: 'next' });
    expect(listLeaderboardRecords(runtime(fn), 'season', [], 5000)).toEqual({ records, nextCursor: 'next' });
    expect(fn).toHaveBeenCalledWith('season', [], 1000, '', 0);
  });
  it('selects owner records and clamps a zero limit', () => {
    const owners = [{ ownerId: 'user' }];
    const fn = jest.fn().mockReturnValue({ records: [], ownerRecords: owners });
    expect(listLeaderboardRecords(runtime(fn), 'season', ['user'], 0).records).toEqual(owners);
    expect(fn).toHaveBeenCalledWith('season', ['user'], 1, '', 0);
  });
  it('supports legacy mock arrays and rank cursors', () => {
    const fn = jest.fn().mockReturnValue([{ rank: 1 }, { rank: 2 }]);
    expect(listLeaderboardRecords(runtime(fn, true), 'season', [], 2).nextCursor).toBe('2');
    expect(listLeaderboardRecords(runtime(fn, true), 'season', [], 3).nextCursor).toBe('');
  });
  it('returns an empty page only for missing leaderboards', () => {
    const fn = jest.fn().mockImplementation(() => { throw new Error('Leaderboard not found'); });
    expect(listLeaderboardRecords(runtime(fn), 'new-season')).toEqual({ records: [], nextCursor: '' });
    fn.mockImplementation(() => { throw new Error('database offline'); });
    expect(() => listLeaderboardRecords(runtime(fn), 'season')).toThrow('database offline');
    expect(() => listLeaderboardRecords({} as Runtime.Nakama, 'season')).toThrow('no leaderboardRecordsList');
  });
  it('normalizes null pages and missing owner records', () => {
    const fn = jest.fn().mockReturnValue(null);
    expect(listLeaderboardRecords(runtime(fn), 'season').records).toEqual([]);
    fn.mockReturnValue({ records: [{ rank: 1 }], ownerRecords: null });
    expect(listLeaderboardRecords(runtime(fn), 'season', ['absent']).records).toEqual([]);
  });
  it('follows page cursors and enforces the overall record cap', () => {
    const fn = jest.fn().mockReturnValueOnce({ records: [{ rank: 1 }], nextCursor: 'two' })
      .mockReturnValueOnce({ records: [{ rank: 2 }, { rank: 3 }], nextCursor: 'three' });
    expect(listAllLeaderboardRecords(runtime(fn), 'season', 2, 1)).toEqual([{ rank: 1 }, { rank: 2 }]);
    expect(fn).toHaveBeenNthCalledWith(2, 'season', [], 1, 'two', 0);
  });
  it('stops on an empty page even if the server gives a cursor', () => {
    const fn = jest.fn().mockReturnValue({ records: [], nextCursor: 'stale' });
    expect(listAllLeaderboardRecords(runtime(fn), 'season')).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
