/**
 * Stage settlement admin tooling (issue #1558, Stage 4) — retention sweep,
 * failed-settlement support queue, and manual settle. The admin guard itself
 * is covered by admin_auth.test.ts; these tests cover the handlers.
 */
import { createMockLogger, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcAdminListFailedStageSettlements,
  rpcAdminSettleStageSettlement,
  rpcAdminCleanupStageSettlements,
  registerStageSettlementAdminEndpoints,
  STAGE_SETTLEMENT_RETENTION_MS,
} from '../stage_settlement_admin';
import {
  buildStageSettlement,
  computeSettlementState,
  STAGE_SETTLEMENT_COLLECTION,
  StageSettlement,
} from '../stage_settlement';
import { recoverFailedStageSettlementForUser } from '../gear_system';
import { logAudit } from '../audit';

jest.mock('../audit', () => ({ logAudit: jest.fn() }));
jest.mock('../gear_system', () => ({ recoverFailedStageSettlementForUser: jest.fn() }));

const logger = createMockLogger();
const ADMIN_CTX = { userId: 'admin-user' } as never;

function makeSettlement(
  userStage: string,
  overrides: Partial<StageSettlement> = {}
): StageSettlement {
  const s = buildStageSettlement(userStage, 'att-1', { stars_earned: 3, score: 100 });
  s.effects.loot = 'failed';
  s.effects.xp = 'failed';
  s.effects.best_of = 'settled';
  s.effects.boss_defeat = 'settled';
  s.effects.modifier_pool = 'settled';
  s.intended_xp = 500;
  s.state = computeSettlementState(s.effects);
  return { ...s, ...overrides };
}

function row(userId: string, key: string, settlement: StageSettlement) {
  return { collection: STAGE_SETTLEMENT_COLLECTION, key, userId, value: settlement, version: 'v1' };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('rpcAdminListFailedStageSettlements', () => {
  it('returns only failed settlements across users, newest first', () => {
    const failedOld = makeSettlement('stage_1', { updated_at: 1000 });
    const failedNew = makeSettlement('stage_2', { updated_at: 3000 });
    const settled = makeSettlement('stage_3', { updated_at: 2000 });
    settled.effects.loot = 'settled';
    settled.effects.xp = 'settled';
    settled.state = 'settled';
    const nk = createMockNakama();
    nk.storageList = jest.fn().mockReturnValue({
      objects: [
        row('u1', 'stage_settlement_stage_1', failedOld),
        row('u2', 'stage_settlement_stage_3', settled),
        row('u3', 'stage_settlement_stage_2', failedNew),
      ],
      cursor: '',
    });
    const res = JSON.parse(
      rpcAdminListFailedStageSettlements(ADMIN_CTX, logger, nk as never, '{}')
    );
    expect(res.success).toBe(true);
    expect(res.truncated).toBe(false);
    expect(res.settlements.map((s: { user_id: string }) => s.user_id)).toEqual(['u3', 'u1']);
    expect(res.settlements[0].stage_id).toBe('stage_2');
  });

  it('passes the storage cursor through and reports truncation on a mid-page limit', () => {
    const nk = createMockNakama();
    nk.storageList = jest.fn().mockReturnValue({
      objects: [
        row('u1', 'stage_settlement_stage_1', makeSettlement('stage_1', { updated_at: 2000 })),
        row('u2', 'stage_settlement_stage_2', makeSettlement('stage_2', { updated_at: 1000 })),
      ],
      cursor: 'next-page',
    });
    const res = JSON.parse(
      rpcAdminListFailedStageSettlements(
        ADMIN_CTX,
        logger,
        nk as never,
        '{"cursor":"abc","limit":1}'
      )
    );
    expect(nk.storageList).toHaveBeenCalledWith(undefined, STAGE_SETTLEMENT_COLLECTION, 100, 'abc');
    expect(res.truncated).toBe(true);
    // Stopped mid-page: the caller re-scans this same page next call so u2 is not skipped.
    expect(res.cursor).toBe('abc');
    expect(res.settlements).toHaveLength(1);
    expect(res.settlements[0].user_id).toBe('u1');
  });

  it('follows the storage cursor across pages until exhausted', () => {
    const nk = createMockNakama();
    nk.storageList = jest
      .fn()
      .mockReturnValueOnce({ objects: [], cursor: 'page-2' })
      .mockReturnValueOnce({
        objects: [row('u9', 'stage_settlement_stage_4', makeSettlement('stage_4'))],
        cursor: '',
      });
    const res = JSON.parse(
      rpcAdminListFailedStageSettlements(ADMIN_CTX, logger, nk as never, '{}')
    );
    expect(nk.storageList).toHaveBeenNthCalledWith(2, undefined, STAGE_SETTLEMENT_COLLECTION, 100, 'page-2');
    expect(res.truncated).toBe(false);
    expect(res.settlements.map((s: { user_id: string }) => s.user_id)).toEqual(['u9']);
  });

  it('rejects an invalid limit', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcAdminListFailedStageSettlements(ADMIN_CTX, logger, nk as never, '{"limit":0}')
    );
    expect(res.success).not.toBe(true);
  });
});

describe('rpcAdminSettleStageSettlement', () => {
  const settleMock = recoverFailedStageSettlementForUser as jest.Mock;

  it('re-drives a failed settlement and audits the manual settle', () => {
    const nk = createMockNakama();
    nk.storageRead = jest.fn().mockReturnValue([{ value: makeSettlement('stage_9') }]);
    settleMock.mockReturnValue({
      found: true,
      recovered: true,
      loot_recovered: true,
      xp_recovered: 500,
    });
    const res = JSON.parse(
      rpcAdminSettleStageSettlement(
        ADMIN_CTX,
        logger,
        nk as never,
        '{"user_id":"u1","stage_id":"stage_9"}'
      )
    );
    expect(res.success).toBe(true);
    expect(res.recovered).toBe(true);
    expect(res.xp_recovered).toBe(500);
    expect(settleMock).toHaveBeenCalledWith(nk, ADMIN_CTX, logger, 'u1', 'stage_9');
    expect(logAudit).toHaveBeenCalledWith(
      nk,
      'admin-user',
      null,
      'admin',
      'stage_settlement_manual_settle',
      expect.objectContaining({ target_user_id: 'u1', stage_id: 'stage_9' }),
      'success',
      expect.any(String)
    );
  });

  it('returns NOT_FOUND when no settlement exists', () => {
    const nk = createMockNakama();
    nk.storageRead = jest.fn().mockReturnValue([]);
    const res = JSON.parse(
      rpcAdminSettleStageSettlement(
        ADMIN_CTX,
        logger,
        nk as never,
        '{"user_id":"u1","stage_id":"stage_9"}'
      )
    );
    expect(res.success).not.toBe(true);
    expect(settleMock).not.toHaveBeenCalled();
  });

  it('refuses to settle a non-failed settlement', () => {
    const nk = createMockNakama();
    const settled = makeSettlement('stage_9');
    settled.effects.loot = 'settled';
    settled.effects.xp = 'settled';
    settled.state = 'settled';
    nk.storageRead = jest.fn().mockReturnValue([{ value: settled }]);
    const res = JSON.parse(
      rpcAdminSettleStageSettlement(
        ADMIN_CTX,
        logger,
        nk as never,
        '{"user_id":"u1","stage_id":"stage_9"}'
      )
    );
    expect(res.success).not.toBe(true);
    expect(settleMock).not.toHaveBeenCalled();
  });
});

describe('rpcAdminCleanupStageSettlements', () => {
  it('deletes settled settlements older than the retention window only', () => {
    const now = Date.now();
    const old = now - STAGE_SETTLEMENT_RETENTION_MS - 1000;
    const oldSettled = makeSettlement('stage_1', { updated_at: old });
    oldSettled.effects.loot = 'settled';
    oldSettled.effects.xp = 'settled';
    oldSettled.state = 'settled';
    const oldFailed = makeSettlement('stage_2', { updated_at: old });
    const freshSettled = makeSettlement('stage_3', { updated_at: now });
    freshSettled.effects.loot = 'settled';
    freshSettled.effects.xp = 'settled';
    freshSettled.state = 'settled';
    const nk = createMockNakama();
    nk.storageList = jest.fn().mockReturnValue({
      objects: [
        row('u1', 'stage_settlement_stage_1', oldSettled),
        row('u2', 'stage_settlement_stage_2', oldFailed),
        row('u3', 'stage_settlement_stage_3', freshSettled),
      ],
      cursor: '',
    });
    nk.storageDelete = jest.fn();
    const res = JSON.parse(rpcAdminCleanupStageSettlements(ADMIN_CTX, logger, nk as never, '{}'));
    expect(res.success).toBe(true);
    expect(res.scanned).toBe(3);
    expect(res.deleted).toBe(1);
    // Failed settlements never expire; fresh settled rows are retained.
    expect(nk.storageDelete).toHaveBeenCalledTimes(1);
    expect(nk.storageDelete).toHaveBeenCalledWith([
      { collection: STAGE_SETTLEMENT_COLLECTION, key: 'stage_settlement_stage_1', userId: 'u1' },
    ]);
    expect(logAudit).toHaveBeenCalledWith(
      nk,
      'admin-user',
      null,
      'admin',
      'stage_settlement_cleanup',
      expect.objectContaining({ deleted: 1, retention_ms: STAGE_SETTLEMENT_RETENTION_MS }),
      'success',
      expect.any(String)
    );
  });

  it('honours a custom older_than_ms', () => {
    const now = Date.now();
    const recent = makeSettlement('stage_1', { updated_at: now - 120000 });
    recent.effects.loot = 'settled';
    recent.effects.xp = 'settled';
    recent.state = 'settled';
    const nk = createMockNakama();
    nk.storageList = jest.fn().mockReturnValue({
      objects: [row('u1', 'stage_settlement_stage_1', recent)],
      cursor: '',
    });
    nk.storageDelete = jest.fn();
    const res = JSON.parse(
      rpcAdminCleanupStageSettlements(ADMIN_CTX, logger, nk as never, '{"older_than_ms":60000}')
    );
    expect(res.deleted).toBe(1);
  });

  it('rejects a sub-minute retention override', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcAdminCleanupStageSettlements(ADMIN_CTX, logger, nk as never, '{"older_than_ms":1000}')
    );
    expect(res.success).not.toBe(true);
  });
});

describe('registerStageSettlementAdminEndpoints', () => {
  it('registers all three admin RPC ids', () => {
    const registerRpc = jest.fn();
    registerStageSettlementAdminEndpoints({ registerRpc } as never);
    const ids = registerRpc.mock.calls.map((c) => c[0]);
    expect(ids).toEqual([
      'armored_archer/admin_list_failed_stage_settlements',
      'armored_archer/admin_settle_stage_settlement',
      'armored_archer/admin_cleanup_stage_settlements',
    ]);
  });
});
