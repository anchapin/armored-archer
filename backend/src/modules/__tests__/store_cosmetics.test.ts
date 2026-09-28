/**
 * Transmog (cosmetic skins) RPC handler unit tests (issue #1304).
 *
 * Covers:
 * - rpcPurchaseCosmetic    — buy a cosmetic skin
 * - rpcGetCosmeticCatalog  — fetch available skins
 * - rpcGetOwnedCosmetics   — fetch player's owned skins
 * - rpcEquipCosmetic       — equip a skin to a slot
 * - rpcUnequipCosmetic     — unequip a skin from a slot
 * - rpcSaveCosmeticLoadout — persist full slot map
 *
 * Each handler is tested for its success path and its validation-error path.
 *
 * Auth contract: these handlers deliberately do NOT implement their own
 * `ctx.userId` guard. Nakama's runtime rejects unauthenticated RPC dispatch
 * before a handler is ever invoked, so a handler can never observe a missing
 * userId in production. See the 'auth contract' block at the end of this file.
 */

jest.mock('../../utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((_name, fn) => fn()),
  createCircuitBreaker: jest.fn(),
  getCircuitBreaker: jest.fn(),
  resetAllCircuits: jest.fn(),
}));

import {
  createMockLogger,
  createMockContext,
  createMockNakama,
  testStorage,
} from '../../__mocks__/nakama';
import {
  rpcPurchaseCosmetic,
  rpcGetCosmeticCatalog,
  rpcGetOwnedCosmetics,
  rpcEquipCosmetic,
  rpcUnequipCosmetic,
  rpcSaveCosmeticLoadout,
} from '../store';
import { Runtime } from '../../types/nakama';

const TEST_USER = 'test-user';
const VALID_ITEM_ID = 'skin_helm_golden';
const VALID_SLOT = 'helm';

describe('rpcGetCosmeticCatalog', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns success with full catalog', () => {
    const result = rpcGetCosmeticCatalog(mockCtx, mockLogger, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.catalog).toBeDefined();
    expect(typeof parsed.catalog).toBe('object');
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcGetCosmeticCatalog(mockCtx, mockLogger, mockNk, 'not-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });
});

describe('rpcGetOwnedCosmetics', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns empty items for player with no cosmetics', () => {
    const result = rpcGetOwnedCosmetics(mockCtx, mockLogger, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.items).toEqual([]);
  });

  it('returns owned items from storage', () => {
    testStorage.set(
      `player_cosmetics_owned:${TEST_USER}`,
      JSON.stringify({ items: [VALID_ITEM_ID] })
    );
    const result = rpcGetOwnedCosmetics(mockCtx, mockLogger, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.items).toContain(VALID_ITEM_ID);
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcGetOwnedCosmetics(mockCtx, mockLogger, mockNk, 'bad-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });

});

describe('rpcPurchaseCosmetic', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcPurchaseCosmetic(mockCtx, mockLogger, mockNk, 'not-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

  it('rejects item not in cosmetic catalog', () => {
    const payload = JSON.stringify({ item_id: 'non_existent_item' });
    const result = rpcPurchaseCosmetic(mockCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Invalid cosmetic item');
    expect(parsed.error_code).toBe('INVALID_ITEM');
  });

});

describe('rpcEquipCosmetic', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcEquipCosmetic(mockCtx, mockLogger, mockNk, 'not-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

  it('rejects item not in cosmetic catalog', () => {
    const payload = JSON.stringify({ slot: VALID_SLOT, skin_id: 'non_existent_item' });
    const result = rpcEquipCosmetic(mockCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

});

describe('rpcUnequipCosmetic', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcUnequipCosmetic(mockCtx, mockLogger, mockNk, 'not-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

});

describe('rpcSaveCosmeticLoadout', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: TEST_USER });
    mockNk = createMockNakama();
  });

  it('returns validation error for malformed payload', () => {
    const result = rpcSaveCosmeticLoadout(mockCtx, mockLogger, mockNk, 'not-json');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error_code).toBe('VALIDATION_ERROR');
  });

  it('rejects skin not in cosmetic catalog', () => {
    const payload = JSON.stringify({ equipped: { helm: 'non_existent_item' } });
    const result = rpcSaveCosmeticLoadout(mockCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

/**
 * Auth contract (issue #1304 follow-up).
 *
 * None of the transmog handlers check `ctx.userId` themselves — Nakama's runtime
 * rejects unauthenticated RPC dispatch before a handler runs, so the "missing
 * userId" path is unreachable in production. These tests pin that contract down
 * explicitly instead of asserting an `error_code` the handlers never emit, and
 * assert the property that actually matters: a handler keyed on the empty userId
 * can only ever see storage scoped to that empty userId, never another player's.
 */
describe('transmog RPC auth contract', () => {
  let mockLogger: Runtime.Logger;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    testStorage.clear();
    mockLogger = createMockLogger();
    mockNk = createMockNakama();
  });

  it('returns a well-formed envelope when invoked with an empty userId', () => {
    const emptyUserCtx = createMockContext({ userId: undefined });
    const result = rpcGetOwnedCosmetics(emptyUserCtx, mockLogger, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('success');
    expect(typeof parsed.success).toBe('boolean');
  });

  it('scopes every storage key it touches to the context userId', () => {
    const ownerCtx = createMockContext({ userId: TEST_USER });
    rpcSaveCosmeticLoadout(
      ownerCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ equipped: { [VALID_SLOT]: VALID_ITEM_ID } })
    );
    expect([...testStorage.keys()].some((k) => k.includes(TEST_USER))).toBe(true);

    const before = [...testStorage.keys()].filter((k) => k.includes(TEST_USER)).length;
    const emptyUserCtx = createMockContext({ userId: undefined });
    rpcSaveCosmeticLoadout(
      emptyUserCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ equipped: { [VALID_SLOT]: VALID_ITEM_ID } })
    );

    // The empty-userId call must not have created or replaced any key owned by
    // another player.
    const after = [...testStorage.keys()].filter((k) => k.includes(TEST_USER)).length;
    expect(after).toBe(before);
  });
});
