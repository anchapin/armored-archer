import { createMockNakama } from '../nakama';

describe('shared Nakama mock method contract', () => {
  it('exposes the real plural leaderboard API and SQL query API', () => {
    const nk = createMockNakama();
    expect(nk.leaderboardRecordsList('season', [], 10, '', 0)).toEqual([]);
    expect(nk.sqlQuery('SELECT 1')).toEqual([]);
    expect(nk).not.toHaveProperty('dbQuery');
    expect(nk).not.toHaveProperty('leaderboardRecordList');
  });
});
