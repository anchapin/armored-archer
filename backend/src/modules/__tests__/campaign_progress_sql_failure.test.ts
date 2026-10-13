import { createMockContext, createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import { getDefeatedBossesFromDB } from '../gear_db';
import { rpcGetCampaignProgress } from '../stage_tracking';

const RPC = 'armored_archer/get_campaign_progress';
const OP = 'gear_db.getDefeatedBossesFromDB';
const PRIVATE_ERROR = 'private driver SQL user token details';

describe('campaign progress SQL failure contract through the real boss read', () => {
  it.each([false, true])('fails safely on SQL error with metric failure=%s', (metricFails) => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    (nk.storageRead as jest.Mock).mockReturnValue([]);
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error(PRIVATE_ERROR);
    });
    nk.metricsCounterAdd = jest.fn(() => {
      if (metricFails) throw new Error('metric unavailable');
    });
    const result = JSON.parse(rpcGetCampaignProgress(createMockContext(), logger, nk, '{}'));
    expect(result).toEqual({
      success: false,
      error: 'Failed to retrieve campaign progress',
      error_code: 'INTERNAL_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, OP);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op: OP, rpc: RPC }, 1);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      PRIVATE_ERROR
    );
    expect(nk.storageWrite).not.toHaveBeenCalled();
  });

  it.each([{ rows: [] }, { rows: [{ boss_id: 'boss_dragon' }] }])(
    'keeps actual boss rows successful: %j',
    ({ rows }) => {
      const nk = createMockNakama();
      const logger = createMockLogger();
      (nk.storageRead as jest.Mock).mockReturnValue([]);
      (nk.sqlQuery as jest.Mock).mockReturnValue(rows);
      nk.metricsCounterAdd = jest.fn();
      const ctx = createMockContext();
      const result = JSON.parse(rpcGetCampaignProgress(ctx, logger, nk, '{}'));
      expect(result).toEqual({
        success: true,
        completed_stages: [],
        unlocked_stages: ['1_1'],
        bosses_defeated: rows.map((row) => row.boss_id),
        unlocked_chapters: ['chapter_1'],
      });
      expect(nk.sqlQuery).toHaveBeenCalledTimes(1);
      expect(nk.sqlQuery).toHaveBeenCalledWith(expect.stringContaining('FROM boss_defeats'), [
        ctx.userId,
      ]);
      expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
    }
  );

  it('does not change legacy helper callers that omit a strict read context', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy SQL failure');
    });
    expect(getDefeatedBossesFromDB(nk, 'user')).toEqual([]);
  });

  it('does not query SQL for unauthenticated callers', () => {
    const nk = createMockNakama();
    const result = JSON.parse(
      rpcGetCampaignProgress({ ...createMockContext(), userId: '' }, createMockLogger(), nk, '{}')
    );
    expect(result.error_code).toBe('UNAUTHORIZED');
    expect(nk.sqlQuery).not.toHaveBeenCalled();
  });
});
