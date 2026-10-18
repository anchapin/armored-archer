/**
 * RPC-layer branch coverage for encounter_pacing (#1661):
 * registration wrappers, rpcLogEncounterPacing, rpcGetPacingReport,
 * and classifyEncounter biome branches. Uses the shared nakama mock.
 */

import {
  registerRpcLogEncounterPacing,
  registerRpcGetPacingReport,
  rpcLogEncounterPacing,
  rpcGetPacingReport,
  classifyEncounter,
  ContentType,
} from '../encounter_pacing';
import { createMockLogger, createMockContext, createMockNakama, testStorage } from '../../__mocks__/nakama';
import type { Runtime } from '../../types/nakama';

beforeEach(() => {
  // testStorage is shared across createMockNakama instances (module-level).
  testStorage.clear();
});

const validMetricsPayload = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    total_encounters: 12,
    recent_encounters: 5,
    combat_count: 6,
    exploration_count: 3,
    narrative_count: 2,
    puzzle_count: 1,
    combat_ratio: 0.5,
    exploration_ratio: 0.25,
    narrative_ratio: 0.17,
    puzzle_ratio: 0.08,
    combat_streak: 2,
    exploration_streak: 0,
    current_fatigue: 10,
    fatigue_level: 'low',
    combat_time_total: 300,
    ...overrides,
  });

describe('registration wrappers', () => {
  const initializer = (): Runtime.Initializer =>
    ({ registerRpc: jest.fn() }) as unknown as Runtime.Initializer;

  it('registerRpcLogEncounterPacing registers the RPC id', () => {
    const init = initializer();
    registerRpcLogEncounterPacing(init);
    const ids = (init.registerRpc as jest.Mock).mock.calls.map((c) => c[0]);
    expect(ids).toEqual(['armored_archer/log_encounter_pacing']);
  });

  it('registerRpcGetPacingReport registers the RPC id', () => {
    const init = initializer();
    registerRpcGetPacingReport(init);
    const ids = (init.registerRpc as jest.Mock).mock.calls.map((c) => c[0]);
    expect(ids).toEqual(['armored_archer/get_pacing_report']);
  });
});

describe('rpcLogEncounterPacing', () => {
  it('rejects an invalid payload and audits the failure', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcLogEncounterPacing(createMockContext(), createMockLogger(), nk, '{"combat_ratio":5}')
    );
    expect(res.success).toBe(false);
  });

  it('rejects non-JSON payloads', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcLogEncounterPacing(createMockContext(), createMockLogger(), nk, 'not-json{')
    );
    expect(res.success).toBe(false);
  });

  it('writes fresh pacing state on success', () => {
    const nk = createMockNakama();
    const res = JSON.parse(
      rpcLogEncounterPacing(createMockContext(), createMockLogger(), nk, validMetricsPayload())
    );
    expect(res).toEqual({ success: true, logged: true });
    expect(nk.storageWrite).toHaveBeenCalled();
    const written = (nk.storageWrite as jest.Mock).mock.calls[0][0][0];
    expect(written.collection).toBe('pacing_state');
    expect(written.value.combat_streak).toBe(2);
    expect(written.value.recent_encounters).toHaveLength(1);
  });

  it('trims recent encounters to the last 10', () => {
    const nk = createMockNakama();
    const ctx = createMockContext();
    for (let i = 0; i < 12; i++) {
      rpcLogEncounterPacing(ctx, createMockLogger(), nk, validMetricsPayload());
    }
    // logAudit also writes to storage; pick the pacing_state writes only.
    const pacingWrites = (nk.storageWrite as jest.Mock).mock.calls
      .map((c) => c[0][0])
      .filter((w) => w.collection === 'pacing_state');
    const lastWritten = pacingWrites[pacingWrites.length - 1];
    expect(lastWritten.value.recent_encounters).toHaveLength(10);
  });
});

describe('rpcGetPacingReport', () => {
  const reportFor = (stateOverrides: Record<string, unknown> | null) => {
    const nk = createMockNakama();
    if (stateOverrides) {
      const state = {
        player_id: 'test-user',
        recent_encounters: [],
        combat_streak: 0,
        exploration_streak: 0,
        current_fatigue: 0,
        session_encounters: 0,
        combat_time_accumulated: 0,
        updated_at: 0,
        ...stateOverrides,
      };
      (nk.storageRead as jest.Mock).mockReturnValue([
        { collection: 'pacing_state', key: 'test-user', userId: 'test-user', value: state },
      ]);
    }
    return JSON.parse(
      rpcGetPacingReport(createMockContext(), createMockLogger(), nk, '{}')
    );
  };

  it('returns a default-state report when nothing is stored', () => {
    const res = reportFor(null);
    expect(res.player_id).toBe('test-user');
    expect(res.metrics.current_fatigue).toBe(0);
    expect(res.pacing_score).toBeGreaterThan(0);
    expect(res.recommendations.should_break).toBe(false);
  });

  it('recommends a 5-minute narrative break at critical fatigue', () => {
    const res = reportFor({ current_fatigue: 95 });
    expect(res.recommendations.should_break).toBe(true);
    expect(res.recommendations.break_duration).toBe(300);
    expect(res.recommendations.suggested_next_type).toBe(ContentType.NARRATIVE);
  });

  it('recommends a 2-minute exploration break at high fatigue', () => {
    const res = reportFor({ current_fatigue: 75 });
    expect(res.recommendations.should_break).toBe(true);
    expect(res.recommendations.break_duration).toBe(120);
    expect(res.recommendations.suggested_next_type).toBe(ContentType.EXPLORATION);
  });

  it('flags long combat streaks even without fatigue', () => {
    const res = reportFor({ combat_streak: 99 });
    expect(res.recommendations.should_break).toBe(true);
    expect(res.recommendations.reason).toBe('Combat streak too long');
  });

  it('returns to combat after enough exploration', () => {
    const res = reportFor({ exploration_streak: 10 });
    expect(res.recommendations.suggested_next_type).toBe(ContentType.COMBAT);
    expect(res.recommendations.reason).toBe('Enough exploration, ready for combat');
  });

  it('deducts pacing score for streaks and fatigue', () => {
    const res = reportFor({ combat_streak: 99, current_fatigue: 100 });
    expect(res.pacing_score).toBe(0); // clamped at 0
  });
});

describe('classifyEncounter biome branches', () => {
  const base = { id: 'x', name: 'X', biome: 'forest', difficulty: 1, is_boss: false };

  it('classifies boss encounters as combat', () => {
    expect(classifyEncounter({ ...base, is_boss: true })).toBe(ContentType.COMBAT);
  });

  it('classifies forest and sky as combat', () => {
    expect(classifyEncounter(base)).toBe(ContentType.COMBAT);
    expect(classifyEncounter({ ...base, biome: 'sky' })).toBe(ContentType.COMBAT);
  });

  it('classifies cavern by difficulty', () => {
    expect(classifyEncounter({ ...base, biome: 'cavern', difficulty: 3 })).toBe(ContentType.PUZZLE);
    expect(classifyEncounter({ ...base, biome: 'cavern', difficulty: 1 })).toBe(ContentType.COMBAT);
  });

  it('defaults unknown biomes to combat', () => {
    expect(classifyEncounter({ ...base, biome: 'void' })).toBe(ContentType.COMBAT);
  });
});
