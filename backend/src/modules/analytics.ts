/**
 * Product Analytics Module
 * @fileoverview Handles analytics event collection, storage, and forwarding for the game.
 */

import { config } from '../config';
import { Runtime } from '../types/nakama';
import {
  registerRpcWithMetrics,
  recordAnalyticsEvent,
  recordRevenue as recordMetricsRevenue,
  recordPurchase,
} from './metrics';
import { isPII } from './privacy_compliance';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { withCircuitBreaker, getAllCircuitInfo } from '../utils/circuitBreaker';

// Analytics event types for type safety
export enum AnalyticsEventType {
  // Session events
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',

  // Tutorial events
  TUTORIAL_STARTED = 'tutorial_started',
  TUTORIAL_COMPLETED = 'tutorial_completed',
  TUTORIAL_FAILED = 'tutorial_failed',

  // PVE events
  PVE_STAGE_STARTED = 'pve_stage_started',
  PVE_STAGE_COMPLETED = 'pve_stage_completed',
  PVE_STAGE_FAILED = 'pve_stage_failed',
  PVE_BOSS_DEFEATED = 'pve_boss_defeated',

  // PVP events
  PVP_MATCH_STARTED = 'pvp_match_started',
  PVP_MATCH_COMPLETED = 'pvp_match_completed',
  PVP_MATCH_ABANDONED = 'pvp_match_abandoned',
  PVP_DISCONNECT = 'pvp_disconnect',

  // Store events
  STORE_OPENED = 'store_opened',
  PURCHASE_INITIATED = 'purchase_initiated',
  PURCHASE_COMPLETED = 'purchase_completed',
  PURCHASE_FAILED = 'purchase_failed',
  GEM_PURCHASED = 'gem_purchased',
  COSMETIC_PURCHASED = 'cosmetic_purchased',
  SUBSCRIPTION_STARTED = 'subscription_started',

  // Progression events
  GEAR_OBTAINED = 'gear_obtained',
  GEAR_EQUIPPED = 'gear_equipped',
  TRANSMOG_APPLIED = 'transmog_applied',
  LEVEL_UP = 'level_up',
  ABILITY_UNLOCKED = 'ability_unlocked',
  SEASON_START = 'season_start',
  SEASON_END = 'season_end',

  // Engagement events
  FIRST_SESSION = 'first_session',
  DAILY_LOGIN = 'daily_login',
  RETURNING_PLAYER = 'returning_player',

  // Network events
  NETWORK_ERROR = 'network_error',
  RPC_ERROR = 'rpc_error',
  RPC_LATENCY = 'rpc_latency',

  // Custom events
  CUSTOM = 'custom',
}

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

  // Register circuit breaker state monitoring RPC
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_circuit_breaker_states',
    'get_circuit_breaker_states',
    rpcGetCircuitBreakerStates
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

  // Record metrics for analytics events
  recordAnalyticsEvent('game', eventName);

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
async function forwardToExternalAnalytics(event: AnalyticsEvent): Promise<void> {
  if (!config.analytics?.enabled) {
    return;
  }

  // Mixpanel forwarding
  if (config.analytics.mixpanel?.enabled && config.analytics.mixpanel.apiKey) {
    await forwardToMixpanel(event);
  }

  // Amplitude forwarding
  if (config.analytics.amplitude?.enabled && config.analytics.amplitude.apiKey) {
    await forwardToAmplitude(event);
  }

  // Segment forwarding
  if (config.analytics.segment?.enabled && config.analytics.segment.writeKey) {
    await forwardToSegment(event);
  }

  // Custom endpoint forwarding
  if (config.analytics.customEndpoint?.url) {
    await forwardToCustomEndpoint(event);
  }
}

/**
 * Forward event to Mixpanel
 */
async function forwardToMixpanel(event: AnalyticsEvent): Promise<void> {
  const apiKey = config.analytics?.mixpanel?.apiKey;
  if (!apiKey) return;

  const mixpanelEvent = {
    event: event.eventName,
    properties: {
      ...event.properties,
      distinct_id: event.userId,
      time: Math.floor(event.timestamp / 1000),
      platform: event.platform,
      session_id: event.sessionId,
    },
  };

  // Wrap external API call with circuit breaker for resilience
  await withCircuitBreaker(
    'mixpanel',
    async () => {
      const response = await fetch('https://api.mixpanel.com/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          data: Buffer.from(JSON.stringify(mixpanelEvent)).toString('base64'),
        }),
      });

      if (!response.ok) {
        console.error(`[Analytics] Mixpanel forward failed: ${response.status}`);
      }
    },
    // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
    async () => {
      console.warn('[Analytics] Mixpanel circuit open - dropping event');
    }
  );
}

/**
 * Forward event to Amplitude
 */
async function forwardToAmplitude(event: AnalyticsEvent): Promise<void> {
  const apiKey = config.analytics?.amplitude?.apiKey;
  if (!apiKey) return;

  const amplitudeEvent = {
    api_key: apiKey,
    events: [
      {
        event_type: event.eventName,
        user_id: event.userId,
        time: event.timestamp,
        platform: event.platform,
        session_id: event.sessionId,
        event_properties: event.properties,
      },
    ],
  };

  // Wrap external API call with circuit breaker for resilience
  await withCircuitBreaker(
    'amplitude',
    async () => {
      const response = await fetch('https://api.amplitude.com/2/httpapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(amplitudeEvent),
      });

      if (!response.ok) {
        console.error(`[Analytics] Amplitude forward failed: ${response.status}`);
      }
    },
    // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
    async () => {
      console.warn('[Analytics] Amplitude circuit open - dropping event');
    }
  );
}

/**
 * Forward event to Segment
 */
async function forwardToSegment(event: AnalyticsEvent): Promise<void> {
  const writeKey = config.analytics?.segment?.writeKey;
  if (!writeKey) return;

  const segmentEvent = {
    userId: event.userId,
    event: event.eventName,
    timestamp: new Date(event.timestamp).toISOString(),
    properties: event.properties,
    context: {
      platform: event.platform,
      session_id: event.sessionId,
    },
  };

  // Wrap external API call with circuit breaker for resilience
  await withCircuitBreaker(
    'segment',
    async () => {
      const response = await fetch(`https://api.segment.io/v1/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(writeKey + ':').toString('base64')}`,
        },
        body: JSON.stringify(segmentEvent),
      });

      if (!response.ok) {
        console.error(`[Analytics] Segment forward failed: ${response.status}`);
      }
    },
    // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
    async () => {
      console.warn('[Analytics] Segment circuit open - dropping event');
    }
  );
}

/**
 * Forward event to custom endpoint
 */
async function forwardToCustomEndpoint(event: AnalyticsEvent): Promise<void> {
  const endpoint = config.analytics?.customEndpoint;
  if (!endpoint?.url) return;

  const payload = {
    event: event.eventName,
    userId: event.userId,
    timestamp: event.timestamp,
    properties: event.properties,
    platform: event.platform,
    sessionId: event.sessionId,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (endpoint.apiKey) {
    headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
  }

  // Wrap external API call with circuit breaker for resilience
  await withCircuitBreaker(
    'external_api',
    async () => {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[Analytics] Custom endpoint forward failed: ${response.status}`);
      }
    },
    // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
    async () => {
      console.warn('[Analytics] Custom endpoint circuit open - dropping event');
    }
  );
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
  logger.info('Analytics event track requested');

  const validation = validateEventPayload(payload);
  if (!validation.success) {
    return createValidationErrorResponse(
      'track_event',
      (validation as { success: false; error: string }).error
    );
  }

  const { event_name, properties, platform, session_id } = validation.data;

  // Check for PII in properties before processing
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (isPII(value)) {
        logger.warn(`Potential PII detected in event ${event_name}: ${key}`);
      }
    }
  }

  try {
    const event = processEvent(
      ctx.userId,
      event_name,
      properties || {},
      platform || 'unknown',
      session_id || ''
    );

    logger.info(`Analytics event tracked: ${event_name}`);

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
    return createValidationErrorResponse(
      'get_analytics_summary',
      (validation as { success: false; error: string }).error
    );
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
  logger.info('Revenue event tracked');

  const validation = validatePayload(ZodSchemas.track_revenue, payload, 'track_revenue');
  if (!validation.success) {
    return createValidationErrorResponse(
      'track_revenue',
      (validation as { success: false; error: string }).error
    );
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

  // Record revenue metrics
  recordMetricsRevenue(amount * 100, currency, product_id); // Convert to cents for metrics
  recordPurchase(product_id, true);

  // Update daily metrics
  updateDailyMetrics({
    ...revenueEvent,
    eventName: 'revenue',
  });

  logger.info(`Revenue tracked: ${amount} ${currency}`);

  return JSON.stringify({
    success: true,
    revenue_id: revenueEvent.id,
    timestamp: revenueEvent.timestamp,
  });
}

/**
 * Get daily metrics for a specific date range.
 */
export function getDailyMetrics(startDate: string, endDate: string): DailyMetric[] {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime() + 86400000;

  const result: DailyMetric[] = [];
  dailyMetrics.forEach((metric) => {
    const metricTime = new Date(metric.date).getTime();
    if (metricTime >= startTime && metricTime <= endTime) {
      result.push({
        ...metric,
        uniqueUsers: metric.uniqueUsers,
      });
    }
  });
  return result;
}

/**
 * RPC: Get circuit breaker states for all monitored services.
 * 
 * This RPC provides visibility into the health of external service connections
 * protected by circuit breakers.
 * 
 * // Response
 * {
 *   "success": true,
 *   "circuits": [
 *     {
 *       "serviceName": "mixpanel",
 *       "state": "CLOSED",
 *       "stats": {
 *         "failures": 0,
 *         "successes": 10,
 *         "rejects": 0,
 *         "lastFailure": null
 *       },
 *       "options": {
 *         "timeout": 5000,
 *         "errorThresholdPercentage": 50,
 *         "volumeThreshold": 3,
 *         "resetTimeout": 30000
 *       }
 *     }
 *   ]
 * }
 */
export function rpcGetCircuitBreakerStates(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('Circuit breaker states requested');

  try {
    const circuits = getAllCircuitInfo();
    
    return JSON.stringify({
      success: true,
      circuits: circuits.map(circuit => ({
        serviceName: circuit.serviceName,
        state: circuit.state,
        stats: circuit.stats,
        options: circuit.options,
      })),
    });
  } catch (error) {
    logger.error('Error getting circuit breaker states: %s', error);
    return JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get circuit breaker states',
    });
  }
}

/**
 * Get recent analytics events.
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
