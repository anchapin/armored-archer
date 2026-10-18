/**
 * Synchronous Prometheus exposition serializer (issue #1674, extracted for
 * reuse by deployment_observability and progressive_rollout in #1683 without
 * adding import-cycle edges).
 */

import { Registry } from 'prom-client';

// ==========================================
// Synchronous Prometheus exposition serializer (issue #1674)
// ==========================================

/**
 * Serializes a prom-client Registry to Prometheus text exposition format
 * WITHOUT Promise-based APIs. ADR-0008: goja has no promise scheduler, so
 * `registry.metrics()` (async since prom-client v15) can never resolve in
 * production. prom-client's metric objects expose their current values
 * synchronously via `getMetricsAsArray()`, which this walks directly.
 *
 * Supports counter, gauge, histogram and summary - the only types this
 * backend instantiates (asserted by tests). Label ordering within a
 * sample follows the metric's sortedLabelNames (matching prom-client's
 * own serializer); histogram buckets add `le` first, summaries add
 * `quantile` first, mirroring upstream output.
 */
interface MetricLike {
  name: string;
  help: string;
  type: string;
  sortedLabelNames?: string[];
  labelNames?: string[];
  percentiles?: number[];
  buckets?: number[];
  hashMap: Record<string, MetricEntry>;
}

interface MetricEntry {
  value?: number;
  labels?: Record<string, string | number>;
  bucketValues?: Record<string, number>;
  sum?: number;
  count?: number;
  td?: { percentile: (q: number) => number };
}

function escapeLabelValue(value: string | number): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(
  entries: [string, string | number][],
  leading?: [string, string | number]
): string {
  const all = leading ? [leading, ...entries] : entries;
  if (all.length === 0) return '';
  return '{' + all.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(',') + '}';
}

function entryLabels(metric: MetricLike, entry: MetricEntry): [string, string | number][] {
  const labels = entry.labels ?? {};
  const order = metric.sortedLabelNames ?? metric.labelNames ?? Object.keys(labels);
  return order.filter((k) => k in labels).map((k) => [k, labels[k]] as [string, string | number]);
}

function serializeHistogram(
  metric: MetricLike,
  entry: MetricEntry,
  labels: [string, string | number][],
  chunks: string[]
): void {
  const buckets = metric.buckets ?? [];
  // prom-client stores bucketValues per-bucket (an observation only
  // increments the smallest bucket it fits); exposition is cumulative.
  let cumulative = 0;
  for (const bound of buckets) {
    cumulative += entry.bucketValues?.[String(bound)] ?? 0;
    chunks.push(
      `${metric.name}_bucket${formatLabels(labels, ['le', String(bound)])} ${cumulative}`
    );
  }
  chunks.push(`${metric.name}_bucket${formatLabels(labels, ['le', '+Inf'])} ${entry.count ?? 0}`);
  chunks.push(`${metric.name}_sum${formatLabels(labels)} ${entry.sum ?? 0}`);
  chunks.push(`${metric.name}_count${formatLabels(labels)} ${entry.count ?? 0}`);
}

function serializeSummary(
  metric: MetricLike,
  entry: MetricEntry,
  labels: [string, string | number][],
  chunks: string[]
): void {
  const percentiles = metric.percentiles ?? [];
  for (const q of percentiles) {
    const v = entry.td ? entry.td.percentile(q) : 0;
    chunks.push(`${metric.name}${formatLabels(labels, ['quantile', String(q)])} ${v}`);
  }
  chunks.push(`${metric.name}_sum${formatLabels(labels)} ${entry.sum ?? 0}`);
  chunks.push(`${metric.name}_count${formatLabels(labels)} ${entry.count ?? 0}`);
}

export function serializeRegistryToPrometheus(registry: Registry): string {
  const chunks: string[] = [];
  // prom-client's public typings hide the metric internals; the runtime
  // objects expose them (verified by the serializer tests).
  const metrics = registry.getMetricsAsArray() as unknown as MetricLike[];
  for (const metric of metrics) {
    chunks.push(`# HELP ${metric.name} ${metric.help}`);
    chunks.push(`# TYPE ${metric.name} ${metric.type}`);
    for (const key of Object.keys(metric.hashMap)) {
      const entry = metric.hashMap[key];
      const labels = entryLabels(metric, entry);
      if (metric.type === 'histogram') {
        serializeHistogram(metric, entry, labels, chunks);
      } else if (metric.type === 'summary') {
        serializeSummary(metric, entry, labels, chunks);
      } else {
        // counter / gauge
        chunks.push(`${metric.name}${formatLabels(labels)} ${entry.value ?? 0}`);
      }
    }
    chunks.push('');
  }
  return chunks.join('\n');
}
