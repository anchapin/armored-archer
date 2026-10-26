/**
 * Unit tests for serializeRegistryToPrometheus (prometheus_serializer.ts).
 *
 * The serializer is the synchronous counterpart of prom-client's async
 * `registry.metrics()`, which can never resolve inside goja (ADR-0008).
 * These tests cover every metric type the backend uses (counter, gauge,
 * histogram, summary), label ordering/escaping and the defensive fallbacks
 * for partially populated metric objects.
 */

import { Counter, Gauge, Histogram, Registry, Summary } from 'prom-client';
import { serializeRegistryToPrometheus } from '../prometheus_serializer';

function normalize(text: string): string[] {
  return text.split('\n').filter((line) => line.length > 0);
}

function stubRegistry(metrics: unknown[]): Registry {
  return { getMetricsAsArray: () => metrics } as unknown as Registry;
}

describe('serializeRegistryToPrometheus', () => {
  it('returns an empty string for a registry without metrics', () => {
    expect(serializeRegistryToPrometheus(new Registry())).toBe('');
  });

  it('emits HELP and TYPE headers for a counter', () => {
    const registry = new Registry();
    const counter = new Counter({
      name: 'test_requests_total',
      help: 'Total requests',
      registers: [registry],
    });
    counter.inc(3);

    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('# HELP test_requests_total Total requests');
    expect(text).toContain('# TYPE test_requests_total counter');
    expect(text).toContain('test_requests_total 3');
  });

  it('emits labelled counter samples in sorted label order', () => {
    const registry = new Registry();
    const counter = new Counter({
      name: 'test_labelled_total',
      help: 'Labelled counter',
      labelNames: ['rpc', 'status'],
      registers: [registry],
    });
    counter.inc({ rpc: 'rollout_check', status: 'ok' }, 2);

    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('test_labelled_total{rpc="rollout_check",status="ok"} 2');
  });

  it('emits a gauge sample', () => {
    const registry = new Registry();
    const gauge = new Gauge({
      name: 'test_active_players',
      help: 'Active players',
      registers: [registry],
    });
    gauge.set(7);

    expect(serializeRegistryToPrometheus(registry)).toContain('test_active_players 7');
  });

  it('emits cumulative histogram buckets, +Inf, sum and count', () => {
    const registry = new Registry();
    const histogram = new Histogram({
      name: 'test_duration_seconds',
      help: 'Duration',
      labelNames: ['rpc'],
      buckets: [0.1, 1, 10],
      registers: [registry],
    });
    histogram.observe({ rpc: 'rollout_check' }, 0.5);
    histogram.observe({ rpc: 'rollout_check' }, 20);

    const text = serializeRegistryToPrometheus(registry);
    // Bucket/summary labels are emitted first (matching prom-client's own
    // exposition), and bucket values are cumulative.
    expect(text).toContain('test_duration_seconds_bucket{le="0.1",rpc="rollout_check"} 0');
    expect(text).toContain('test_duration_seconds_bucket{le="1",rpc="rollout_check"} 1');
    expect(text).toContain('test_duration_seconds_bucket{le="10",rpc="rollout_check"} 1');
    expect(text).toContain('test_duration_seconds_bucket{le="+Inf",rpc="rollout_check"} 2');
    expect(text).toContain('test_duration_seconds_sum{rpc="rollout_check"} 20.5');
    expect(text).toContain('test_duration_seconds_count{rpc="rollout_check"} 2');
  });

  it('emits summary quantiles, sum and count', () => {
    const registry = new Registry();
    const summary = new Summary({
      name: 'test_payload_size',
      help: 'Payload size',
      labelNames: ['kind'],
      percentiles: [0.5, 0.99],
      registers: [registry],
    });
    summary.observe({ kind: 'a' }, 5);
    summary.observe({ kind: 'a' }, 15);

    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('# TYPE test_payload_size summary');
    expect(text).toContain('test_payload_size{quantile="0.5",kind="a"}');
    expect(text).toContain('test_payload_size{quantile="0.99",kind="a"}');
    expect(text).toContain('test_payload_size_sum{kind="a"} 20');
    expect(text).toContain('test_payload_size_count{kind="a"} 2');
  });

  it('escapes backslashes, quotes and newlines in label values', () => {
    const registry = new Registry();
    const counter = new Counter({
      name: 'test_escaped_total',
      help: 'Escaped',
      labelNames: ['value'],
      registers: [registry],
    });
    counter.inc({ value: 'a"b\\c\nd' }, 1);

    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('test_escaped_total{value="a\\"b\\\\c\\nd"} 1');
  });

  it('separates metrics with a blank line', () => {
    const registry = new Registry();
    new Gauge({ name: 'test_one', help: 'One', registers: [registry] });
    new Gauge({ name: 'test_two', help: 'Two', registers: [registry] });

    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('# TYPE test_one gauge\ntest_one 0\n\n# HELP test_two');
  });

  it('matches prom-client async output for all supported metric types', async () => {
    const registry = new Registry();
    const counter = new Counter({
      name: 'test_match_total',
      help: 'Match',
      labelNames: ['rpc', 'status'],
      registers: [registry],
    });
    counter.inc({ rpc: 'a', status: 'ok' }, 3);

    const gauge = new Gauge({ name: 'test_match_gauge', help: 'Gauge', registers: [registry] });
    gauge.set(11);

    const histogram = new Histogram({
      name: 'test_match_histogram',
      help: 'Histogram',
      buckets: [1, 5],
      registers: [registry],
    });
    histogram.observe(2);

    const summary = new Summary({
      name: 'test_match_summary',
      help: 'Summary',
      percentiles: [0.5],
      registers: [registry],
    });
    summary.observe(4);

    const asyncText = await registry.metrics();
    const syncText = serializeRegistryToPrometheus(registry);
    expect(normalize(syncText)).toEqual(normalize(asyncText));
  });
});

describe('serializeRegistryToPrometheus fallbacks', () => {
  it('defaults a missing counter value to 0', () => {
    const registry = stubRegistry([
      {
        name: 'c_missing_value',
        help: 'c',
        type: 'counter',
        hashMap: { '': { labels: {} } },
      },
    ]);
    expect(serializeRegistryToPrometheus(registry)).toContain('c_missing_value 0');
  });

  it('defaults missing entry labels to an empty label set', () => {
    const registry = stubRegistry([
      {
        name: 'c_missing_labels',
        help: 'c',
        type: 'counter',
        hashMap: { '': { value: 4 } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('c_missing_labels 4');
    expect(text).not.toContain('c_missing_labels{');
  });

  it('falls back to the label keys of the entry when no label order is known', () => {
    const registry = stubRegistry([
      {
        name: 'c_fallback_labels',
        help: 'c',
        type: 'counter',
        hashMap: { 'a="x"': { labels: { a: 'x' }, value: 1 } },
      },
    ]);
    expect(serializeRegistryToPrometheus(registry)).toContain('c_fallback_labels{a="x"} 1');
  });

  it('uses labelNames ordering when sortedLabelNames is absent', () => {
    const registry = stubRegistry([
      {
        name: 'c_label_names',
        help: 'c',
        type: 'counter',
        labelNames: ['b', 'a'],
        hashMap: { 'a="1",b="2"': { labels: { a: '1', b: '2' }, value: 3 } },
      },
    ]);
    expect(serializeRegistryToPrometheus(registry)).toContain('c_label_names{b="2",a="1"} 3');
  });

  it('treats missing per-bucket values as zero', () => {
    const registry = stubRegistry([
      {
        name: 'h_missing_bucket_values',
        help: 'h',
        type: 'histogram',
        buckets: [1, 5],
        hashMap: { '': { labels: {}, count: 2, sum: 4 } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('h_missing_bucket_values_bucket{le="1"} 0');
    expect(text).toContain('h_missing_bucket_values_bucket{le="5"} 0');
    expect(text).toContain('h_missing_bucket_values_bucket{le="+Inf"} 2');
    expect(text).toContain('h_missing_bucket_values_sum 4');
  });

  it('uses sortedLabelNames ordering and ignores labels missing from the entry', () => {
    const registry = stubRegistry([
      {
        name: 'g_sorted',
        help: 'g',
        type: 'gauge',
        sortedLabelNames: ['b', 'a'],
        labelNames: ['a', 'b'],
        hashMap: { 'a="1",b="2"': { labels: { a: '1' }, value: 5 } },
      },
    ]);
    expect(serializeRegistryToPrometheus(registry)).toContain('g_sorted{a="1"} 5');
  });

  it('defaults missing histogram buckets, bucket values, count and sum to zero', () => {
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
    expect(serializeRegistryToPrometheus(registry)).toContain('s_notd{quantile="0.5"} 0');
  });

  it('serializes multiple metrics and multiple entries per metric', () => {
    const registry = stubRegistry([
      {
        name: 'm_counter',
        help: 'm',
        type: 'counter',
        labelNames: ['a'],
        hashMap: {
          'a="1"': { labels: { a: '1' }, value: 1 },
          'a="2"': { labels: { a: '2' }, value: 2 },
        },
      },
      {
        name: 'm_gauge',
        help: 'm',
        type: 'gauge',
        hashMap: { '': { labels: {}, value: 9 } },
      },
    ]);
    const text = serializeRegistryToPrometheus(registry);
    expect(text).toContain('m_counter{a="1"} 1');
    expect(text).toContain('m_counter{a="2"} 2');
    expect(text).toContain('m_gauge 9');
    expect(text.indexOf('# HELP m_counter')).toBeLessThan(text.indexOf('# HELP m_gauge'));
  });
});
