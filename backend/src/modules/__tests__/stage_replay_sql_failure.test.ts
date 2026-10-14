import {
  createMockContext,
  createMockLogger,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import { rpcStageComplete } from '../gear_system';
import { resetRateLimiting } from '../rate_limit';
const payload =
  '{"stage_id":"stage_replay","boss_defeated":false,"difficulty":"easy","stars_earned":3,"score":500}';
const RPC = 'armored_archer/stage_complete';
const OP = 'gear_db.getUnlockedModifierPoolsFromDB';
function seed(userId: string): void {
  testStorage.set(
    `stage_completion:${userId}`,
    JSON.stringify({
      user_id: userId,
      completions: {
        stage_replay: {
          stage_id: 'stage_replay',
          stage_prefix: 'stage',
          stars_earned: 3,
          score: 500,
          completed_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      },
    })
  );
}

describe('no-improvement stage replay pool read SQL failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testStorage.clear();
    resetRateLimiting();
  });
  it.each([false, true])('fails safely with metric unavailable=%s', (metricFails) => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    const logger = createMockLogger();
    seed(ctx.userId);
    (nk.sqlQuery as jest.Mock).mockImplementation(() => {
      throw new Error('private driver token SQL');
    });
    nk.metricsCounterAdd = jest.fn(() => {
      if (metricFails) throw new Error('metric unavailable');
    });
    const result = JSON.parse(rpcStageComplete(ctx, logger, nk, payload));
    expect(result).toEqual({
      success: false,
      error: 'Failed to process stage completion',
      error_code: 'INTERNAL_ERROR',
    });
    expect(logger.error).toHaveBeenCalledWith('Database query failed: rpc=%s op=%s', RPC, OP);
    expect(nk.metricsCounterAdd).toHaveBeenCalledTimes(1);
    expect(nk.metricsCounterAdd).toHaveBeenCalledWith('db_errors_total', { op: OP, rpc: RPC }, 1);
    expect(nk.sqlQuery).toHaveBeenCalledTimes(1);
    expect(nk.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM unlocked_modifier_pools'),
      [ctx.userId]
    );
    const writes = (nk.storageWrite as jest.Mock).mock.calls.flat(2);
    expect(writes.some((r: any) => r.collection === 'stage_completion_claims')).toBe(true);
    expect(
      writes.some(
        (r: any) => r.collection === 'player_stats' || r.collection === 'stage_completion'
      )
    ).toBe(false);
    expect(
      writes.some((r: any) => r.value?.action === 'stage_complete' && r.value?.result === 'failure')
    ).toBe(true);
    expect(JSON.stringify([result, (logger.error as jest.Mock).mock.calls, writes])).not.toContain(
      'private'
    );
    expect(JSON.parse(rpcStageComplete(ctx, logger, nk, payload)).error_code).toBe(
      'DUPLICATE_COMPLETION'
    );
    expect(nk.sqlQuery).toHaveBeenCalledTimes(1);
  });
  it.each([{ rows: [] }, { rows: [{ modifier_id: 'fire_arrow' }] }])(
    'keeps real pool rows successful %j',
    ({ rows }) => {
      const nk = createMockNakama();
      const ctx = createMockContext();
      seed(ctx.userId);
      (nk.sqlQuery as jest.Mock).mockReturnValue(rows);
      nk.metricsCounterAdd = jest.fn();
      const result = JSON.parse(rpcStageComplete(ctx, createMockLogger(), nk, payload));
      expect(result.success).toBe(true);
      expect(result.message).toBe('No improvement over previous completion');
      expect(result.unlocked_modifier_pools).toEqual(rows.map((r) => r.modifier_id));
      expect(result.xp_gained).toBe(0);
      expect(result.loot).toEqual({ dropped: false, gear: null });
      expect(nk.metricsCounterAdd).not.toHaveBeenCalled();
      expect(nk.sqlQuery).toHaveBeenCalledTimes(1);
    }
  );
});
