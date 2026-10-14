import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { recordBossDefeatInDB } from '../gear_db';
import { rpcStageComplete } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const RPC = 'armored_archer/stage_complete';
const OP = 'gear_db.recordBossDefeatInDB';
const payload =
  '{"stage_id":"stage_boss","boss_defeated":true,"boss_id":"boss_fire","difficulty":"hard"}';

describe('stage boss defeat SQL failure through real helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['SELECT defeat_count', 'INSERT INTO boss_defeats'])(
    'fails the RPC safely on %s',
    (query) => {
      const nk = createMockNakama();
      const logger = createMockLogger();
      const ctx = createMockContext();
      (nk.sqlQuery as jest.Mock).mockImplementation((statement: string, params: unknown[]) => {
        if (statement.includes(query)) throw new Error('private driver SQL token');
        if (statement.includes('boss_defeats')) return [];
        return [];
      });
      nk.metricsCounterAdd = jest.fn();
      const response = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
      expect(response).toEqual({
        success: false,
        error: 'Failed to process stage completion',
        error_code: 'INTERNAL_ERROR',
      });
      expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, OP);
      expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
      expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op: OP, rpc: RPC }, 1);
      const calls = (nk.sqlQuery as jest.Mock).mock.calls;
      const queryCount = calls.length;
      expect(
        calls.every(
          ([statement, params]) =>
            statement.includes('boss_defeats') &&
            params[0] === ctx.userId &&
            params[1] === 'boss_fire'
        )
      ).toBe(true);
      expect(calls).toHaveLength(query.startsWith('SELECT') ? 1 : 2);
      const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
      expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
      expect(writes.some((r: any) => r.collection === 'stage_completion')).toBe(true);
      expect(writes.some((r: any) => r.collection === 'player_stats')).toBe(false);
      expect(writes.some((r: any) => r.value?.action === 'boss_defeat')).toBe(false);
      expect(
        writes.some(
          (r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'failure'
        )
      ).toBe(true);
      expect(
        JSON.stringify([response, (logger.error as jest.Mock).mock.calls, writes])
      ).not.toContain('private');
      expect(JSON.parse(rpcStageComplete(ctx, logger, nk, payload)).error_code).toBe(
        'DUPLICATE_COMPLETION'
      );
      expect(nk.sqlQuery).toHaveBeenCalledTimes(queryCount);
    }
  );

  it('preserves genuine first defeat, pool unlock and XP success', () => {
    const nk = createMockNakama();
    nk.metricsCounterAdd = jest.fn();
    const response = JSON.parse(
      rpcStageComplete(createMockContext(), createMockLogger(), nk, payload)
    );
    expect(response.success).toBe(true);
    expect(response.boss_defeat_count).toBe(1);
    expect(response.newly_unlocked_modifiers).toContain('fire_arrow');
    expect(response.xp_gained).toBe(188);
    expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
  });

  it('preserves repeat defeat and already-unlocked pools', () => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    testStorage.set(
      `boss_defeats:${ctx.userId}`,
      JSON.stringify({ boss_fire: { defeat_count: 2, first_defeated_at: 1 } })
    );
    testStorage.set(`unlocked_modifier_pools:${ctx.userId}`, JSON.stringify(['fire_arrow']));
    const result = JSON.parse(rpcStageComplete(ctx, createMockLogger(), nk, payload));
    expect(result.success).toBe(true);
    expect(result.boss_defeat_count).toBe(3);
    expect(result.newly_unlocked_modifiers).toEqual([]);
  });

  it('does not mask SQL failure if native metric recording throws', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver SQL');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      throw new Error('metric down');
    });
    const logger = createMockLogger();
    const result = JSON.parse(rpcStageComplete(createMockContext(), logger, nk, payload));
    expect(result.error_code).toBe('INTERNAL_ERROR');
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls])).not.toContain(
      'private'
    );
  });

  it('preserves legacy context-free failure result', () => {
    const nk = createMockNakama();
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('legacy');
    });
    expect(recordBossDefeatInDB(nk, 'user', 'boss')).toMatchObject({
      success: false,
      defeat_count: 0,
      first_defeat: false,
    });
  });
});
