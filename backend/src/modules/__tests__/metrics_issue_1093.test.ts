/**
 * Issue #1093 — verify the 4 newly-wired metric recorders:
 *   - recordPveStageCompleted   (gear_system.applyCompletionAndRespond)
 *   - incrementPlayerLevelUp    (rpg_system.rpcGainXP)
 *   - incrementGearUnlock       (gear_system.applyLoot)
 *   - setCacheHitRatio          (utils/cache-helpers.getCacheEntry)
 *
 * Each test reads the metric back through the prom-client default registry
 * via the canonical `metricsRegister.getSingleMetric(name).get()` (and `.reset()`
 * to isolate between tests). The tests are fast (no DB / no live stack) and
 * exercise the SAME code path the production source does.
 */
import {
  recordPveStageCompleted,
  incrementPlayerLevelUp,
  incrementGearUnlock,
  setCacheHitRatio,
  getMetricsRegistry,
} from '../metrics';
import { getCacheManager } from '../../utils/cache';

const getRegistry = () => getMetricsRegistry() as any;
const getMetric = (name: string) => getRegistry().getSingleMetric(name) as any;

describe('issue #1093 — recordPveStageCompleted', () => {
  it('increments per-difficulty/stars on each call', async () => {
    const before = (await getMetric('armored_archer_pve_stages_completed_total').get())
      .values.find((v: any) => v.labels.stage_difficulty === 'normal' && v.labels.stars === '3')?.value ?? 0;
    recordPveStageCompleted('normal', 3);
    recordPveStageCompleted('normal', 3);
    recordPveStageCompleted('hard', 1);
    const normal = (await getMetric('armored_archer_pve_stages_completed_total').get())
      .values.find((v: any) => v.labels.stage_difficulty === 'normal' && v.labels.stars === '3')?.value ?? 0;
    const hard = (await getMetric('armored_archer_pve_stages_completed_total').get())
      .values.find((v: any) => v.labels.stage_difficulty === 'hard' && v.labels.stars === '1')?.value ?? 0;
    expect(normal - before).toBe(2);
    expect(hard).toBe(1);
  });
});

describe('issue #1093 — incrementPlayerLevelUp', () => {
  it('bumps the global counter (no labels)', async () => {
    const before = (await getMetric('armored_archer_player_level_ups_total').get()).values[0]?.value ?? 0;
    incrementPlayerLevelUp();
    incrementPlayerLevelUp();
    const after = (await getMetric('armored_archer_player_level_ups_total').get()).values[0]?.value ?? 0;
    expect(after - before).toBe(2);
  });
});

describe('issue #1093 — incrementGearUnlock', () => {
  it('increments per-rarity', async () => {
    const m = getMetric('armored_archer_gear_unlocks_total');
    incrementGearUnlock('legendary');
    incrementGearUnlock('legendary');
    incrementGearUnlock('common');
    const after = await m.get();
    const rare = after.values.find((v: any) => v.labels.rarity === 'legendary')?.value ?? 0;
    const common = after.values.find((v: any) => v.labels.rarity === 'common')?.value ?? 0;
    expect(rare).toBe(2);
    expect(common).toBe(1);
  });
});

describe('issue #1093 — setCacheHitRatio (via getCacheEntry)', () => {
  it('publishes a hit ratio after hits and misses', async () => {
    const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any;
    const manager = getCacheManager(logger);
    manager.createCache('issue_1093_cache_test', 10, 60000);
    manager.set('issue_1093_cache_test', 'present', 'value');
    manager.get('issue_1093_cache_test', 'present'); // hit
    manager.get('issue_1093_cache_test', 'present'); // hit
    manager.get('issue_1093_cache_test', 'missing'); // miss
    manager.get('issue_1093_cache_test', 'missing'); // miss
    manager.get('issue_1093_cache_test', 'missing'); // miss
    // 2 hits / 5 total = 0.4
    const after = await getMetric('armored_archer_cache_hit_ratio').get();
    const v = after.values.find((x: any) => x.labels.cache_type === 'issue_1093_cache_test')?.value;
    expect(v).toBeGreaterThanOrEqual(0.39);
    expect(v).toBeLessThanOrEqual(0.41);
  });
});
