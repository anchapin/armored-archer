/**
 * Product Analytics Module
 * @fileoverview Handles analytics event collection, storage, and forwarding for the game.
 */

import { config } from '../config';
import { Runtime } from '../types/nakama';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// In-memory analytics storage (in production, use a database or external service)
interface AnalyticsEvent {
  id: string;
  userId: string;
  eventName: string;
  timestamp: number;
  properties: Record<string, unknown>;
  platform: string;
  sessionId: string;
}

// Analytics aggregation data
interface DailyMetric {
  date: string;
  eventName: string;
  count: number;
  uniqueUsers: Set<string>;
}

// In-memory storage
const analyticsEvents: AnalyticsEvent[] = [];
const dailyMetrics: Map<string, DailyMetric> = new Map();
const MAX_EVENTS = 100000; // Limit in-memory storage

/**
 * Registers the analytics RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerAnalyticsEndpoints(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/track_event', 'track_event', rpcTrackEvent);

  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_analytics_summary',
    'get_analytics_summary',
    rpcGetAnalyticsSummary
  );

  registerRpcWithMetrics(
    initializer,
    'armored_archer/track_revenue',
    'track_revenue',
    rpcTrackRevenue
  );
}

/**
 * Validates analytics event payload.
 */
function validateEventPayload(payload: string) {
  return validatePayload(ZodSchemas.track_event, payload, 'track_event');
}

/**
 * Processes and stores an analytics event.
 */
function processEvent(
  userId: string,
  eventName: string,
  properties: Record<string, unknown>,
  platform: string,
  sessionId: string
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId,
    eventName,
    timestamp: Date.now(),
    properties,
    platform,
    sessionId,
  };

  // Store event
  analyticsEvents.push(event);

  // Trim old events if over limit
  if (analyticsEvents.length > MAX_EVENTS) {
    analyticsEvents.splice(0, analyticsEvents.length - MAX_EVENTS);
  }

  // Update daily metrics
  updateDailyMetrics(event);

  // Forward to external analytics if configured
  forwardToExternalAnalytics(event);

  return event;
}

/**
 * Updates daily aggregation metrics.
 */
function updateDailyMetrics(event: AnalyticsEvent): void {
  const date = new Date(event.timestamp).toISOString().split('T')[0];
  const key = `${date}_${event.eventName}`;

  if (!dailyMetrics.has(key)) {
    dailyMetrics.set(key, {
      date,
      eventName: event.eventName,
      count: 0,
      uniqueUsers: new Set(),
    });
  }

  const metric = dailyMetrics.get(key)!;
  metric.count++;
  metric.uniqueUsers.add(event.userId);
}

/**
 * Forwards analytics event to external services (Mixpanel, Amplitude, etc.)
 */
function forwardToExternalAnalytics(event: AnalyticsEvent): void {
  if (!config.analytics?.enabled) {
    return;
  }

  // Mixpanel forwarding
  if (config.analytics.mixpanel?.enabled && config.analytics.mixpanel.apiKey) {
    // In production, use actual HTTP request to Mixpanel API
    console.log(`[Analytics] Forwarding to Mixpanel: ${event.eventName}`, event.properties);
  }

  // Amplitude forwarding
  if (config.analytics.amplitude?.enabled && config.analytics.amplitude.apiKey) {
    console.log(`[Analytics] Forwarding to Amplitude: ${event.eventName}`, event.properties);
  }

  // Segment forwarding
  if (config.analytics.segment?.enabled && config.analytics.segment.writeKey) {
    console.log(`[Analytics] Forwarding to Segment: ${event.eventName}`, event.properties);
  }
}

/**
 * RPC: Track a game analytics event.
 *
 * @example
 * // Request payload
 * {
 *   "event_name": "pve_stage_completed",
 *   "properties": {
 *     "stage_id": "campaign_1",
 *     "stars": 3,
 *     "duration_seconds": 120
 *   },
 *   "platform": "android",
 *   "session_id": "sess_123456"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "event_id": "evt_1234567890_abc123"
 * }
 */
export function rpcTrackEvent(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Analytics event track requested by user: %s', ctx.userId);

  const validation = validateEventPayload(payload);
  if (!validation.success) {
    return createValidationErrorResponse('track_event', validation.error);
  }

  const { event_name, properties, platform, session_id } = validation.data;

  try {
    const event = processEvent(
      ctx.userId,
      event_name,
      properties || {},
      platform || 'unknown',
      session_id || ''
    );

    logger.info(`Analytics event tracked: ${event_name} for user ${ctx.userId}`);

    return JSON.stringify({
      success: true,
      event_id: event.id,
      timestamp: event.timestamp,
    });
  } catch (error) {
    logger.error(`Failed to track event: ${error}`);
    return JSON.stringify({
      success: false,
      error: `Failed to track event: ${error}`,
    });
  }
}

/**
 * RPC: Get analytics summary.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31",
 *   "event_names": ["pve_stage_completed", "purchase_completed"]
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "summary": {
 *     "total_events": 1500,
 *     "unique_users": 450,
 *     "events": {
 *       "pve_stage_completed": {
 *         "count": 1200,
 *         "unique_users": 400
 *       },
 *       "purchase_completed": {
 *         "count": 300,
 *         "unique_users": 50
 *       }
 *     }
 *   }
 * }
 */
export function rpcGetAnalyticsSummary(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Analytics summary requested by user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.get_analytics_summary,
    payload,
    'get_analytics_summary'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_analytics_summary', validation.error);
  }

  const { start_date, end_date, event_names } = validation.data;

  // Filter events by date range
  const startTime = new Date(start_date).getTime();
  const endTime = new Date(end_date).getTime() + 86400000; // Include entire end date

  const filteredEvents = analyticsEvents.filter(
    (e) => e.timestamp >= startTime && e.timestamp <= endTime
  );

  // Filter by event names if specified
  const events = event_names?.length
    ? filteredEvents.filter((e) => event_names.includes(e.eventName))
    : filteredEvents;

  // Calculate summary
  const uniqueUsers = new Set<string>();
  const eventCounts: Record<string, { count: number; unique_users: Set<string> }> = {};

  for (const event of events) {
    uniqueUsers.add(event.userId);

    if (!eventCounts[event.eventName]) {
      eventCounts[event.eventName] = { count: 0, unique_users: new Set() };
    }
    eventCounts[event.eventName].count++;
    eventCounts[event.eventName].unique_users.add(event.userId);
  }

  const summary: Record<string, unknown> = {
    total_events: events.length,
    unique_users: uniqueUsers.size,
    events: {} as Record<string, { count: number; unique_users: number }>,
  };

  for (const [eventName, data] of Object.entries(eventCounts)) {
    (summary.events as Record<string, { count: number; unique_users: number }>)[eventName] = {
      count: data.count,
      unique_users: data.unique_users.size,
    };
  }

  return JSON.stringify({
    success: true,
    summary,
    start_date,
    end_date,
  });
}

/**
 * RPC: Track revenue event.
 *
 * @example
 * // Request payload
 * {
 *   "amount": 99,
 *   "currency": "USD",
 *   "product_id": "com.armoredarcher.gems.small",
 *   "transaction_id": "tx_123456",
 *   "platform": "ios"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "revenue_id": "rev_1234567890"
 * }
 */
export function rpcTrackRevenue(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Revenue event tracked by user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.track_revenue, payload, 'track_revenue');
  if (!validation.success) {
    return createValidationErrorResponse('track_revenue', validation.error);
  }

  const { amount, currency, product_id, transaction_id, platform } = validation.data;

  // Create revenue event
  const revenueEvent: AnalyticsEvent = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId: ctx.userId,
    eventName: 'revenue',
    timestamp: Date.now(),
    properties: {
      amount,
      currency,
      product_id,
      transaction_id,
      platform,
    },
    platform: platform || 'unknown',
    sessionId: '',
  };

  analyticsEvents.push(revenueEvent);

  // Update daily metrics
  updateDailyMetrics({
    ...revenueEvent,
    eventName: 'revenue',
  });

  logger.info(`Revenue tracked: ${amount} ${currency} for user ${ctx.userId}`);

  return JSON.stringify({
    success: true,
    revenue_id: revenueEvent.id,
    timestamp: revenueEvent.timestamp,
  });
}

/**
 * Get recent analytics events for debugging.
 */
export function getRecentEvents(limit: number = 100): AnalyticsEvent[] {
  return analyticsEvents.slice(-limit);
}

/**
 * Get all analytics events (for admin/debug purposes).
 */
export function getAllEvents(): AnalyticsEvent[] {
  return [...analyticsEvents];
}

/**
 * Get daily metrics for a specific date range.
 */
export function getDailyMetrics(startDate: string, endDate: string): DailyMetric[] {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime() + 86400000;

  const result: DailyMetric[] = [];
  for (const [, metric] of dailyMetrics) {
    const metricTime = new Date(metric.date).getTime();
    if (metricTime >= startTime && metricTime <= endTime) {
      result.push({
        ...metric,
        uniqueUsers: metric.uniqueUsers,
      });
    }
  }
  return result;
}
