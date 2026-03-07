/**
 * DataDog Integration Module
 *
 * This module provides integration with DataDog for metrics and APM:
 * - DogStatsD client for metrics
 * - Trace export for APM
 * - Custom event forwarding
 */

import { config } from '../config';
import { getMetricsRegistry } from './metrics';

// DataDog configuration interface
interface DataDogConfig {
  enabled: boolean;
  apiKey?: string;
  appKey?: string;
  host?: string;
  port: number;
  prefix: string;
  tags: Record<string, string>;
}

// Default DataDog configuration
let dataDogConfig: DataDogConfig = {
  enabled: false,
  port: 8125,
  prefix: 'armored_archer',
  tags: {
    environment: 'development',
    service: 'armored-archer-backend',
  },
};

// StatsD-like interface for metrics (simplified implementation)
class DataDogMetricsClient {
  private host: string;
  private port: number;
  private prefix: string;
  private defaultTags: string[];
  private socket: ReturnType<typeof require('dgram').createSocket> | null = null;
  private enabled: boolean;

  constructor(config: DataDogConfig) {
    this.enabled = config.enabled;
    this.host = config.host || 'localhost';
    this.port = config.port;
    this.prefix = config.prefix;
    this.defaultTags = Object.entries(config.tags).map(([key, value]) => `${key}:${value}`);
  }

  /**
   * Initialize the UDP socket for sending metrics
   */
  initialize(): void {
    if (!this.enabled) {
      console.log('[DataDog] DataDog metrics disabled');
      return;
    }

    try {
      const dgram = require('dgram');
      this.socket = dgram.createSocket('udp4');
      console.log(`[DataDog] Initialized metrics client: ${this.host}:${this.port}`);
    } catch (error) {
      console.error('[DataDog] Failed to initialize metrics client:', error);
      this.enabled = false;
    }
  }

  /**
   * Close the UDP socket
   */
  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Send a counter metric
   */
  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.enabled || !this.socket) return;

    const allTags = [...this.defaultTags, ...this.formatTags(tags)];
    const message = `${this.prefix}.${metric}:${value}|c|${allTags.join(',')}`;
    this.send(message);
  }

  /**
   * Send a gauge metric
   */
  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.socket) return;

    const allTags = [...this.defaultTags, ...this.formatTags(tags)];
    const message = `${this.prefix}.${metric}:${value}|g|${allTags.join(',')}`;
    this.send(message);
  }

  /**
   * Send a histogram metric
   */
  histogram(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.socket) return;

    const allTags = [...this.defaultTags, ...this.formatTags(tags)];
    const message = `${this.prefix}.${metric}:${value}|h|${allTags.join(',')}`;
    this.send(message);
  }

  /**
   * Send a timing metric
   */
  timing(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled || !this.socket) return;

    const allTags = [...this.defaultTags, ...this.formatTags(tags)];
    const message = `${this.prefix}.${metric}:${value}|ms|${allTags.join(',')}`;
    this.send(message);
  }

  /**
   * Format tags for DataDog
   */
  private formatTags(tags?: Record<string, string>): string[] {
    if (!tags) return [];
    return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
  }

  /**
   * Send message via UDP
   */
  private send(message: string): void {
    if (!this.socket) return;

    const buffer = Buffer.from(message);
    this.socket.send(buffer, 0, buffer.length, this.port, this.host, (err: Error | null) => {
      if (err) {
        console.error('[DataDog] Error sending metric:', err);
      }
    });
  }
}

// DataDog client instance
let dataDogClient: DataDogMetricsClient | null = null;

/**
 * Initialize DataDog integration
 */
export function initializeDataDog(): void {
  const ddConfig = config.datadog;

  if (!ddConfig?.enabled) {
    console.log('[DataDog] DataDog integration disabled');
    return;
  }

  dataDogConfig = {
    enabled: ddConfig.enabled,
    apiKey: ddConfig.apiKey,
    appKey: ddConfig.appKey,
    host: ddConfig.host,
    port: ddConfig.port || 8125,
    prefix: ddConfig.prefix || 'armored_archer',
    tags: {
      environment: config.environment,
      service: 'armored-archer-backend',
      ...ddConfig.tags,
    },
  };

  dataDogClient = new DataDogMetricsClient(dataDogConfig);
  dataDogClient.initialize();

  console.log(`[DataDog] Initialized with prefix: ${dataDogConfig.prefix}`);
}

/**
 * Get DataDog client for custom metrics
 */
export function getDataDogClient(): DataDogMetricsClient | null {
  return dataDogClient;
}

/**
 * Send RPC metrics to DataDog
 */
export function sendRpcMetricsToDataDog(rpcName: string, durationMs: number, success: boolean): void {
  if (!dataDogClient) return;

  const tags = {
    rpc: rpcName,
    status: success ? 'success' : 'error',
  };

  dataDogClient.increment('rpc.calls', 1, tags);
  dataDogClient.histogram('rpc.duration', durationMs, tags);
}

/**
 * Send player metrics to DataDog
 */
export function sendPlayerMetricsToDataDog(activeSessions: number): void {
  if (!dataDogClient) return;

  dataDogClient.gauge('player.active_sessions', activeSessions);
}

/**
 * Send match metrics to DataDog
 */
export function sendMatchMetricsToDataDog(matchType: string, queueSize: number, waitTimeMs: number): void {
  if (!dataDogClient) return;

  const tags = { match_type: matchType };

  dataDogClient.gauge('match.queue_size', queueSize, tags);
  dataDogClient.histogram('match.wait_time', waitTimeMs, tags);
}

/**
 * Send economy metrics to DataDog
 */
export function sendEconomyMetricsToDataDog(
  productType: string,
  amount: number,
  currency: string,
  success: boolean
): void {
  if (!dataDogClient) return;

  const tags = {
    product_type: productType,
    currency,
    status: success ? 'success' : 'failure',
  };

  dataDogClient.increment('economy.purchases', 1, tags);
  if (success) {
    dataDogClient.increment('economy.revenue', amount, { ...tags, currency });
  }
}

/**
 * Send health metrics to DataDog
 */
export function sendHealthMetricsToDataDog(healthy: boolean, cpuUsage: number, memoryUsage: number): void {
  if (!dataDogClient) return;

  dataDogClient.gauge('health.status', healthy ? 1 : 0);
  dataDogClient.gauge('health.cpu_percent', cpuUsage);
  dataDogClient.gauge('health.memory_percent', memoryUsage);
}

/**
 * Check if DataDog is enabled
 */
export function isDataDogEnabled(): boolean {
  return dataDogConfig.enabled;
}

/**
 * Get DataDog configuration
 */
export function getDataDogConfig(): DataDogConfig {
  return { ...dataDogConfig };
}
