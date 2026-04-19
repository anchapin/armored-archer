/**
 * RPC Latency Tracker
 *
 * Sliding window tracker for RPC response times and error rates.
 * Provides real-time metrics for the health monitor instead of
 * relying on Prometheus aggregation which has coarser granularity.
 */

import { Runtime } from '../types/nakama';

interface LatencyEntry {
  timestamp: number;
  durationMs: number;
  isError: boolean;
}

const MAX_ENTRIES = 1000;
const WINDOW_MS = 60_000;

let entries: LatencyEntry[] = [];
let initialized = false;

export function initializeRpcLatencyTracker(_logger: Runtime.Logger): void {
  entries = [];
  initialized = true;
}

export function recordRpcLatency(rpcName: string, durationMs: number): void {
  if (!initialized) return;

  entries.push({ timestamp: Date.now(), durationMs, isError: false });

  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
}

export function recordRpcError(_rpcName: string, _errorType: string): void {
  if (!initialized) return;

  entries.push({ timestamp: Date.now(), durationMs: 0, isError: true });

  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
}

function getEntriesInWindow(): LatencyEntry[] {
  const cutoff = Date.now() - WINDOW_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

export function getAverageResponseTimeMs(): number {
  const inWindow = getEntriesInWindow().filter((e) => !e.isError);
  if (inWindow.length === 0) return 0;

  const total = inWindow.reduce((sum, e) => sum + e.durationMs, 0);
  return Math.round((total / inWindow.length) * 100) / 100;
}

export function getErrorRate(): number {
  const inWindow = getEntriesInWindow();
  if (inWindow.length === 0) return 0;

  const errors = inWindow.filter((e) => e.isError).length;
  return Math.round((errors / inWindow.length) * 10000) / 100;
}

export function resetTracker(): void {
  entries = [];
  initialized = false;
}
