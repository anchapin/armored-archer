import { resolveCurrentSeason, publishCurrentSeason } from '../current-season';

describe('current season authority', () => {
  it('bootstraps from the clock only when no published state exists', () => {
    const nk = { storageRead: jest.fn(() => []) } as any;
    const season = resolveCurrentSeason(nk);
    expect(season.season_id).toBe(`season_${season.season_number}`);
    expect(season.end_time - season.start_time).toBe(28 * 86400000);
  });
  it('reads a successor in a different runtime instead of recomputing the old season', () => {
    let value: unknown;
    const nk = {
      storageWrite: jest.fn((writes) => {
        value = writes[0].value;
      }),
      storageRead: jest.fn(() => (value ? [{ value }] : [])),
    } as any;
    const old = resolveCurrentSeason(nk);
    const next = {
      ...old,
      season_id: `season_${old.season_number + 1}`,
      season_number: old.season_number + 1,
      start_time: Date.now(),
      end_time: Date.now() + 28 * 86400000,
    };
    publishCurrentSeason(nk, next);
    const otherRuntime = { storageRead: nk.storageRead } as any;
    expect(resolveCurrentSeason(otherRuntime)).toEqual(next);
    expect(nk.storageWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: '00000000-0000-0000-0000-000000000000',
        permissionRead: 0,
        permissionWrite: 0,
      }),
    ]);
  });
  it('does not silently revert to clock state when a published record is corrupted', () => {
    expect(() => resolveCurrentSeason({ storageRead: () => [{ value: {} }] } as any)).toThrow(
      'Invalid current season state'
    );
  });
});
