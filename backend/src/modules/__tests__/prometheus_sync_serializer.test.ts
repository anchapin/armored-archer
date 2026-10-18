/**
 * Tests for serializeRegistryToPrometheus (issue #1674, ADR-0008).
 *
 * The async Registry.metrics() can never resolve inside goja, so the
 * Prometheus scrape RPCs serialize synchronously. The ground truth for
 * correctness is prom-client's own async serializer: for every metric
 * type the backend uses, the sync output must equal the async output
 * (modulo trailing newline), which is what Prometheus scrapes today.
 */

import { Counter, Gauge, Histogram, Registry, Summary } from 'prom-client';
import { serializeRegistryToPrometheus } from '../metrics';

function normalize(text: string): string[] {
  return text.split('\n').filter((line) => line.length > 0);
}

describe('serializeRegistryToPrometheus', () => {
  it('matches prom-client async output for counter, gauge, histogram, summary', async () => {
    const registry = new Registry();
    const counter = new Counter({
      name: 'test_rpc_calls_total',
      help: 'Total calls',
      labelNames: ['rpc', 'status'],
      registers: [registry],
    });
    counter.inc({ rpc: 'rollout_check', status: 'ok' }, 3);
    counter.inc({ rpc: 'a"b\\c\nd', status: 'err' }, 1);

    const gauge = new Gauge({ name: 'test_active', help: 'Active', registers: [registry] });
    gauge.set(7);

    const histogram = new Histogram({
      name: 'test_duration_seconds',
      help: 'Duration',
      labelNames: ['rpc'],
      buckets: [0.1, 1, 10],
      registers: [registry],
    });
    histogram.observe({ rpc: 'rollout_check' }, 0.5);
    histogram.observe({ rpc: 'rollout_check' }, 20);

    const summary = new Summary({
      name: 'test_sizes',
      help: 'Sizes',
      labelNames: ['kind'],
      registers: [registry],
    });
    summary.observe({ kind: 'a' }, 5);
    summary.observe({ kind: 'a' }, 15);

    const asyncText = await registry.metrics();
    const syncText = serializeRegistryToPrometheus(registry);
    expect(normalize(syncText)).toEqual(normalize(asyncText));
  });

  it('emits valid exposition for a histogram with no observations', async () => {
    const registry = new Registry();
    new Histogram({
      name: 'test_empty_histogram',
      help: 'Empty',
      buckets: [1, 5],
      registers: [registry],
    });
    const syncText = serializeRegistryToPrometheus(registry);
    const asyncText = await registry.metrics();
    expect(normalize(syncText)).toEqual(normalize(asyncText));
  });

  it('every metric type in the backend registries is supported by the serializer', () => {
    // The serializer handles counter, gauge, histogram, summary. If a
    // future change registers another type (e.g. OpenMetrics _created
    // lines), this test fails instead of silently producing wrong output.
    const { getDeploymentRegistry } = require('../deployment_observability');
    const { getHealthRegistry } = require('../health_monitor');
    const { getRolloutRegistry } = require('../progressive_rollout');
    const supported = new Set(['counter', 'gauge', 'histogram', 'summary']);
    const registries: [string, Registry][] = [
      ['deployment', getDeploymentRegistry()],
      ['health', getHealthRegistry()],
      ['rollout', getRolloutRegistry()],
    ];
    for (const [name, registry] of registries) {
      const output = serializeRegistryToPrometheus(registry);
      expect(output).toContain('# HELP');
      for (const metric of registry.getMetricsAsArray() as { type: string }[]) {
        expect(supported).toContain(metric.type);
      }
      expect(typeof name).toBe('string');
    }
  });
});

describe('serializeRegistryToPrometheus fallbacks', () => {
  function stubRegistry(metrics: unknown[]): Registry {
    return { getMetricsAsArray: () => metrics } as unknown as Registry;
  }

  it('defaults missing histogram buckets, bucketValues, count and sum to zero', () => {
    const registry = stubRegistry([
      {
        name: 'h_fallback',
        help: 'h',
        type: 'histogram',
        labelNames: [],
        hashMap: { '': { labels: {} } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('h_fallback_bucket{le="+Inf"} 0');
    expect(text).toContain('h_fallback_sum 0');
    expect(text).toContain('h_fallback_count 0');
  });

  it('defaults missing summary percentiles, tdigest, count and sum', () => {
    const registry = stubRegistry([
      {
        name: 's_fallback',
        help: 's',
        type: 'summary',
        labelNames: [],
        hashMap: { '': { labels: {} } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('s_fallback_sum 0');
    expect(text).toContain('s_fallback_count 0');
  });

  it('renders a summary quantile as 0 when the tdigest is missing', () => {
    const registry = stubRegistry([
      {
        name: 's_notd',
        help: 's',
        type: 'summary',
        labelNames: [],
        percentiles: [0.5],
        hashMap: { '': { labels: {} } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('s_notd{quantile="0.5"} 0');
  });

  it('defaults a counter entry without a value to 0 and falls back to label keys', () => {
    const registry = stubRegistry([
      {
        name: 'c_fallback',
        help: 'c',
        type: 'counter',
        hashMap: { 'a="x"': { labels: { a: 'x' } }, empty: {} },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('c_fallback{a="x"} 0');
    expect(text).toContain('c_fallback 0');
  });

  it('uses sortedLabelNames ordering when present', () => {
    const registry = stubRegistry([
      {
        name: 'g_sorted',
        help: 'g',
        type: 'gauge',
        sortedLabelNames: ['b', 'a'],
        labelNames: ['a', 'b'],
        hashMap: { 'a="1",b="2"': { labels: { a: '1', b: '2' }, value: 5 } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('g_sorted{b="2",a="1"} 5');
  });
});
