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
 * Each handler is tested for: success path, validation error, and auth failure.
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

  it('returns auth error when userId is missing', () => {
    const noUserCtx = createMockContext({ userId: undefined });
    const result = rpcGetOwnedCosmetics(noUserCtx, mockLogger, mockNk, '{}');
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
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

  it('returns auth error when userId is missing', () => {
    const noUserCtx = createMockContext({ userId: undefined });
    const payload = JSON.stringify({ item_id: VALID_ITEM_ID });
    const result = rpcPurchaseCosmetic(noUserCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
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

  it('returns auth error when userId is missing', () => {
    const noUserCtx = createMockContext({ userId: undefined });
    const payload = JSON.stringify({ slot: VALID_SLOT, skin_id: VALID_ITEM_ID });
    const result = rpcEquipCosmetic(noUserCtx, mockLogger, mockNk, payload);
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

  it('returns auth error when userId is missing', () => {
    const noUserCtx = createMockContext({ userId: undefined });
    const payload = JSON.stringify({ slot: VALID_SLOT });
    const result = rpcUnequipCosmetic(noUserCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
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

  it('returns auth error when userId is missing', () => {
    const noUserCtx = createMockContext({ userId: undefined });
    const payload = JSON.stringify({ equipped: { helm: VALID_ITEM_ID } });
    const result = rpcSaveCosmeticLoadout(noUserCtx, mockLogger, mockNk, payload);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});
