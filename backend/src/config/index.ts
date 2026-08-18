// Dynamic import for Node.js-specific modules
// These modules don't exist in Nakama's runtime (Duktape/QuickJS)
import type * as fsType from 'fs';
import type * as pathType from 'path';

type NodeFSModule = typeof fsType | undefined;
type NodePathModule = typeof pathType | undefined;

let fs: NodeFSModule;
let path: NodePathModule;

function loadEnvironment(): void {
  // Skip environment loading in Nakama runtime
  // Nakama provides environment variables directly
  // Check for Nakama-specific global or environment
  if (
    typeof (globalThis as any).nakama !== 'undefined' ||
    process.env.NAKAMA_RUNNER ||
    process.env.RUNTIME_PROVIDER === 'nakama'
  ) {
    return;
  }

  // Try to load Node.js modules dynamically
  // This will fail in Nakama's runtime, which is expected
  try {
    // Use require for dynamic loading to avoid webpack bundling issues
    fs = typeof require !== 'undefined' ? require('fs') : undefined;
    path = typeof require !== 'undefined' ? require('path') : undefined;
  } catch (e) {
    // Not in Node.js environment, skip environment loading
    return;
  }

  // Skip if fs module is not available (Nakama's Duktape/QuickJS runtime)
  if (!fs || typeof fs.existsSync !== 'function') {
    return;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFiles = [`.env.${nodeEnv}`, '.env', `.env.${nodeEnv}.local`];

  for (const file of envFiles) {
    try {
      const envPath = path?.join(process.cwd(), file);
      if (!envPath || !fs?.existsSync(envPath)) {
        continue;
      }
      const envContent = fs.readFileSync(envPath, 'utf-8');

      for (const line of envContent.split('\n')) {
        const trimmedLine = line.trim();

        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalsIndex = trimmedLine.indexOf('=');

          if (equalsIndex > 0) {
            const key = trimmedLine.substring(0, equalsIndex).trim();
            let value = trimmedLine.substring(equalsIndex + 1).trim();

            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1);
            }

            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    } catch (error) {
      // Silently ignore errors in non-Node environments
      // This is expected when running in Nakama runtime
    }
  }
}

loadEnvironment();

export interface ServerConfig {
  port: number;
  consolePort: number;
  host: string;
  key: string;
  consoleUsername: string;
  consolePassword: string;
}

export interface DatabaseConfig {
  address: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface RevenueCatConfig {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  enabled: boolean;
}

export interface SessionConfig {
  encryptionKey: string;
  refreshEncryptionKey: string;
  tokenEncryptionKey: string;
  expirySec: number;
}

export interface LoggerScrubLevelConfig {
  /** Enable scrubbing for this log level */
  enabled: boolean;
  /** Additional sensitive fields specific to this level */
  additionalFields?: string[];
}

export interface LoggerConfig {
  level: string;
  format: string;
  output: string;
  /** Enable or disable log scrubbing globally */
  scrubLogs: boolean;
  /** Additional field names to treat as sensitive */
  additionalSensitiveFields?: string[];
  /** Maximum depth to scrub in nested objects */
  maxScrubDepth?: number;
  /** Scrubbing configuration per log level */
  scrubByLevel?: {
    /** Configuration for error level logs */
    error?: LoggerScrubLevelConfig;
    /** Configuration for warn level logs */
    warn?: LoggerScrubLevelConfig;
    /** Configuration for info level logs */
    info?: LoggerScrubLevelConfig;
    /** Configuration for debug level logs */
    debug?: LoggerScrubLevelConfig;
  };
  /** List of output types where scrubbing is applied (console, file, all) */
  scrubOutputs?: ('console' | 'file')[];
}

export interface MatchConfig {
  allowHostLoopback: boolean;
}

export interface MetricsConfig {
  namespace: string;
  prefix: string;
  prometheusPort: number;
}

export interface EndpointRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  defaultMaxRequests: number;
  defaultWindowMs: number;
  endpoints: Record<string, EndpointRateLimitConfig>;
}

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  exporter: 'zipkin' | 'otlp' | 'none';
  sampleRate: number;
  zipkinEndpoint?: string;
  otlpEndpoint?: string;
  autoInstrumentations: boolean;
  instrumentations: string[];
}

export interface AlertingConfig {
  enabled: boolean;
  defaultProvider: 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
  routing: {
    critical: 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
    error: 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
    warning: 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
    info: 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
  };
  pagerduty?: {
    apiKey: string;
    serviceId: string;
    integrationKey: string;
  };
  slack?: {
    webhookUrl: string;
    channel: string;
    username: string;
    iconEmoji: string;
  };
  webhook?: {
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
  };
  healthAlerts: {
    cpuWarningPercent: number;
    cpuCriticalPercent: number;
    memoryWarningPercent: number;
    memoryCriticalPercent: number;
    dbConnectionsWarningPercent: number;
    dbConnectionsCriticalPercent: number;
    diskWarningPercent: number;
    diskCriticalPercent: number;
    responseTimeWarningMs: number;
    responseTimeCriticalMs: number;
    errorRateWarningPercent: number;
    errorRateCriticalPercent: number;
  };
  metricAlerts: {
    activeConnectionsWarning: number;
    activeConnectionsCritical: number;
    matchQueueWarning: number;
    matchQueueCritical: number;
    matchWaitTimeWarningSec: number;
    matchWaitTimeCriticalSec: number;
    dbQueryTimeWarningMs: number;
    dbQueryTimeCriticalMs: number;
    failedLoginsWarning: number;
    failedLoginsCritical: number;
    purchaseFailuresWarning: number;
    purchaseFailuresCritical: number;
  };
  cooldowns: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  minEnvironmentLevel: 'development' | 'staging' | 'production';
  tags: Record<string, string>;
}

export interface DataDogConfig {
  enabled: boolean;
  apiKey?: string;
  appKey?: string;
  host?: string;
  port: number;
  prefix: string;
  tags: Record<string, string>;
}

export interface ErrorInsightConfig {
  enabled: boolean;
  provider: 'sentry' | 'bugsnag' | 'raygun' | 'none';
  dsn?: string;
  apiKey?: string;
  appId?: string;
  environment: string;
  release: string;
  sampleRate: number;
  maxBreadcrumbs: number;
  attachStacktrace: boolean;
  healthAlerts: {
    cpuWarningPercent: number;
    cpuCriticalPercent: number;
    memoryWarningPercent: number;
    memoryCriticalPercent: number;
    dbConnectionsWarningPercent: number;
    dbConnectionsCriticalPercent: number;
    latencyWarningMs: number;
    latencyCriticalMs: number;
    errorRateWarningPercent: number;
    errorRateCriticalPercent: number;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  mixpanel?: AnalyticsProviderConfig;
  amplitude?: AnalyticsProviderConfig;
  segment?: {
    enabled: boolean;
    writeKey?: string;
  };
  customEndpoint?: {
    url: string;
    apiKey?: string;
  };
}

export interface AnalyticsProviderConfig {
  enabled: boolean;
  apiKey?: string;
  secretKey?: string;
}

/**
 * Configuration for Firebase Cloud Messaging (Push Notifications)
 */
export interface FirebaseConfig {
  enabled: boolean;
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseUrl?: string;
}

/**
 * Configuration for the Error to Insight Pipeline
 */
export interface ErrorInsightPipelineConfig {
  enabled: boolean;
  aggregationWindowMinutes: number;
  minOccurrencesForInsight: number;
  insightWindowHours: number;
  maxPatterns: number;
  maxInsights: number;
  autoResolvePatterns: boolean;
  patternTtlDays: number;
}

/**
 * Configuration for N+1 Query Detection
 */
export interface NPlusOneConfig {
  enabled: boolean;
  threshold: number;
  logEnabled: boolean;
  metricsEnabled: boolean;
  slowQueryThresholdMs: number;
  autoTrackStorage: boolean;
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  server: ServerConfig;
  database: DatabaseConfig;
  revenuecat: RevenueCatConfig;
  redis: RedisConfig;
  firebase: FirebaseConfig;
  session: SessionConfig;
  logger: LoggerConfig;
  match: MatchConfig;
  metrics: MetricsConfig;
  rateLimit: RateLimitConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
  errorInsights: ErrorInsightPipelineConfig;
  nPlusOne: NPlusOneConfig;
  analytics: AnalyticsConfig;
  datadog?: DataDogConfig;
}

function parseDatabaseAddress(address: string): DatabaseConfig {
  // Support both formats:
  // - postgres://user:password@host:port/database
  // - user:password@host:port/database
  const dbRegex = /^(?:postgres:\/\/)?(\w+):([^@]+)@([^:]+):(\d+)\/(\w+)$/;
  const match = address.match(dbRegex);

  if (!match) {
    return {
      address,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nakama',
    };
  }

  const [, user, password, host, port, database] = match;
  return {
    address,
    host,
    port: parseInt(port, 10),
    user,
    password,
    database,
  };
}

const dbAddress = process.env.DATABASE_ADDRESS || process.env.NAKAMA_DATABASE_ADDRESS || '';

const config: AppConfig = {
  environment: (process.env.NODE_ENV || 'development') as AppConfig['environment'],

  server: {
    port: parseInt(process.env.NAKAMA_PORT || process.env.NAKAMA_SOCKET_PORT || '7350', 10),
    consolePort: parseInt(process.env.NAKAMA_CONSOLE_PORT || '7351', 10),
    host: process.env.NAKAMA_HOST || '127.0.0.1',
    key: process.env.NAKAMA_SERVER_KEY || process.env.NAKAMA_SOCKET_SERVER_KEY || 'defaultkey',
    consoleUsername: process.env.NAKAMA_CONSOLE_USERNAME || 'admin',
    consolePassword: process.env.NAKAMA_CONSOLE_PASSWORD || 'password',
  },

  database: parseDatabaseAddress(dbAddress),

  revenuecat: {
    publicKey: process.env.REVENUECAT_PUBLIC_KEY || '',
    secretKey: process.env.REVENUECAT_SECRET_KEY || '',
    webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  firebase: {
    enabled: process.env.FIREBASE_ENABLED === 'true',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    databaseUrl: process.env.FIREBASE_DATABASE_URL,
  },

  session: {
    encryptionKey: process.env.SESSION_ENCRYPTION_KEY || 'default-token-key',
    refreshEncryptionKey: process.env.REFRESH_ENCRYPTION_KEY || 'default-refresh-key',
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 'default-token-key',
    expirySec: parseInt(process.env.SESSION_EXPIRY_SEC || '7200', 10),
  },

  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    output: process.env.LOG_OUTPUT || 'stdout',
    scrubLogs: process.env.LOG_SCRUB_ENABLED !== 'false',
    additionalSensitiveFields: process.env.LOG_SCRUB_ADDITIONAL_FIELDS
      ? process.env.LOG_SCRUB_ADDITIONAL_FIELDS.split(',').map((f) => f.trim())
      : undefined,
    maxScrubDepth: process.env.LOG_SCRUB_MAX_DEPTH
      ? parseInt(process.env.LOG_SCRUB_MAX_DEPTH, 10)
      : undefined,
    scrubByLevel:
      process.env.LOG_SCRUB_BY_LEVEL === 'true'
        ? {
            error: { enabled: process.env.LOG_SCRUB_ERROR_ENABLED !== 'false' },
            warn: { enabled: process.env.LOG_SCRUB_WARN_ENABLED !== 'false' },
            info: { enabled: process.env.LOG_SCRUB_INFO_ENABLED !== 'false' },
            debug: { enabled: process.env.LOG_SCRUB_DEBUG_ENABLED !== 'false' },
          }
        : undefined,
    scrubOutputs: process.env.LOG_SCRUB_OUTPUTS
      ? (process.env.LOG_SCRUB_OUTPUTS.split(',').map((o) => o.trim()) as ('console' | 'file')[])
      : undefined,
  },

  match: {
    allowHostLoopback: process.env.ALLOW_HOST_LOOPBACK === 'true',
  },

  metrics: {
    namespace: process.env.METRICS_NAMESPACE || 'nakama',
    prefix: process.env.METRICS_PREFIX || 'nakama',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9100', 10),
  },

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    defaultMaxRequests: parseInt(process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS || '100', 10),
    defaultWindowMs: parseInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS || '60000', 10),
    endpoints: {
      health_check: {
        maxRequests: parseInt(process.env.RATE_LIMIT_HEALTH_CHECK_MAX || '300', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_HEALTH_CHECK_WINDOW_MS || '60000', 10),
      },
      get_player_stats: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_PLAYER_STATS_MAX || '60', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_PLAYER_STATS_WINDOW_MS || '60000', 10),
      },
      gain_xp: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GAIN_XP_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GAIN_XP_WINDOW_MS || '60000', 10),
      },
      allocate_stats: {
        maxRequests: parseInt(process.env.RATE_LIMIT_ALLOCATE_STATS_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_ALLOCATE_STATS_WINDOW_MS || '60000', 10),
      },
      submit_combat_action: {
        maxRequests: parseInt(process.env.RATE_LIMIT_SUBMIT_COMBAT_ACTION_MAX || '10', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_SUBMIT_COMBAT_ACTION_WINDOW_MS || '10000', 10),
      },
      get_match_state: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_MATCH_STATE_MAX || '60', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_MATCH_STATE_WINDOW_MS || '60000', 10),
      },
      create_match: {
        maxRequests: parseInt(process.env.RATE_LIMIT_CREATE_MATCH_MAX || '10', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_CREATE_MATCH_WINDOW_MS || '60000', 10),
      },
      accept_match: {
        maxRequests: parseInt(process.env.RATE_LIMIT_ACCEPT_MATCH_MAX || '10', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_ACCEPT_MATCH_WINDOW_MS || '60000', 10),
      },
      get_player_rank: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_PLAYER_RANK_MAX || '60', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_PLAYER_RANK_WINDOW_MS || '60000', 10),
      },
      get_leaderboard: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_LEADERBOARD_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_LEADERBOARD_WINDOW_MS || '60000', 10),
      },
      validate_purchase: {
        maxRequests: parseInt(process.env.RATE_LIMIT_VALIDATE_PURCHASE_MAX || '20', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_VALIDATE_PURCHASE_WINDOW_MS || '60000', 10),
      },
      spend_gems: {
        maxRequests: parseInt(process.env.RATE_LIMIT_SPEND_GEMS_MAX || '20', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_SPEND_GEMS_WINDOW_MS || '60000', 10),
      },
      generate_gear: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GENERATE_GEAR_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GENERATE_GEAR_WINDOW_MS || '60000', 10),
      },
      equip_gear: {
        maxRequests: parseInt(process.env.RATE_LIMIT_EQUIP_GEAR_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_EQUIP_GEAR_WINDOW_MS || '60000', 10),
      },
      stage_complete: {
        maxRequests: parseInt(process.env.RATE_LIMIT_STAGE_COMPLETE_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_STAGE_COMPLETE_WINDOW_MS || '60000', 10),
      },
      // `complete_stage` rate-limit entry removed with the RPC (issue #1069);
      // the consolidated survivor is `stage_complete` above.
      get_campaign_progress: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_CAMPAIGN_PROGRESS_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_CAMPAIGN_PROGRESS_WINDOW_MS || '60000', 10),
      },
      track_event: {
        maxRequests: parseInt(process.env.RATE_LIMIT_TRACK_EVENT_MAX || '60', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_TRACK_EVENT_WINDOW_MS || '60000', 10),
      },
      get_analytics_summary: {
        maxRequests: parseInt(process.env.RATE_LIMIT_GET_ANALYTICS_SUMMARY_MAX || '10', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_GET_ANALYTICS_SUMMARY_WINDOW_MS || '60000', 10),
      },
      track_revenue: {
        maxRequests: parseInt(process.env.RATE_LIMIT_TRACK_REVENUE_MAX || '30', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_TRACK_REVENUE_WINDOW_MS || '60000', 10),
      },
    },
  },

  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true',
    serviceName: process.env.TRACING_SERVICE_NAME || 'armored-archer-backend',
    serviceVersion: process.env.TRACING_SERVICE_VERSION || '0.1.0',
    exporter: (process.env.TRACING_EXPORTER || 'zipkin') as 'zipkin' | 'otlp' | 'none',
    sampleRate: parseFloat(process.env.TRACING_SAMPLE_RATE || '1.0'),
    zipkinEndpoint: process.env.ZIPKIN_ENDPOINT,
    otlpEndpoint: process.env.OTLP_ENDPOINT,
    autoInstrumentations: process.env.TRACING_AUTO_INSTRUMENTATIONS !== 'false',
    instrumentations: process.env.TRACING_INSTRUMENTATIONS
      ? process.env.TRACING_INSTRUMENTATIONS.split(',').map((i) => i.trim())
      : ['http', 'express', 'pg'],
  },

  alerting: {
    enabled: process.env.ALERTING_ENABLED === 'true',
    defaultProvider: (process.env.ALERTING_DEFAULT_PROVIDER || 'none') as
      | 'pagerduty'
      | 'slack'
      | 'webhook'
      | 'email'
      | 'none',
    routing: {
      critical: (process.env.ALERTING_ROUTING_CRITICAL || 'pagerduty') as
        | 'pagerduty'
        | 'slack'
        | 'webhook'
        | 'email'
        | 'none',
      error: (process.env.ALERTING_ROUTING_ERROR || 'slack') as
        | 'pagerduty'
        | 'slack'
        | 'webhook'
        | 'email'
        | 'none',
      warning: (process.env.ALERTING_ROUTING_WARNING || 'slack') as
        | 'pagerduty'
        | 'slack'
        | 'webhook'
        | 'email'
        | 'none',
      info: (process.env.ALERTING_ROUTING_INFO || 'none') as
        | 'pagerduty'
        | 'slack'
        | 'webhook'
        | 'email'
        | 'none',
    },
    pagerduty: process.env.PAGERDUTY_API_KEY
      ? {
          apiKey: process.env.PAGERDUTY_API_KEY || '',
          serviceId: process.env.PAGERDUTY_SERVICE_ID || '',
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
        }
      : undefined,
    slack: process.env.SLACK_WEBHOOK_URL
      ? {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: process.env.SLACK_USERNAME || 'Armored Archer Alert Bot',
          iconEmoji: process.env.SLACK_ICON_EMOJI || ':warning:',
        }
      : undefined,
    healthAlerts: {
      cpuWarningPercent: parseInt(process.env.ALERT_CPU_WARNING_PERCENT || '70', 10),
      cpuCriticalPercent: parseInt(process.env.ALERT_CPU_CRITICAL_PERCENT || '90', 10),
      memoryWarningPercent: parseInt(process.env.ALERT_MEMORY_WARNING_PERCENT || '75', 10),
      memoryCriticalPercent: parseInt(process.env.ALERT_MEMORY_CRITICAL_PERCENT || '90', 10),
      dbConnectionsWarningPercent: parseInt(
        process.env.ALERT_DB_CONNECTIONS_WARNING_PERCENT || '70',
        10
      ),
      dbConnectionsCriticalPercent: parseInt(
        process.env.ALERT_DB_CONNECTIONS_CRITICAL_PERCENT || '90',
        10
      ),
      diskWarningPercent: parseInt(process.env.ALERT_DISK_WARNING_PERCENT || '80', 10),
      diskCriticalPercent: parseInt(process.env.ALERT_DISK_CRITICAL_PERCENT || '95', 10),
      responseTimeWarningMs: parseInt(process.env.ALERT_RESPONSE_TIME_WARNING_MS || '500', 10),
      responseTimeCriticalMs: parseInt(process.env.ALERT_RESPONSE_TIME_CRITICAL_MS || '2000', 10),
      errorRateWarningPercent: parseInt(process.env.ALERT_ERROR_RATE_WARNING_PERCENT || '5', 10),
      errorRateCriticalPercent: parseInt(process.env.ALERT_ERROR_RATE_CRITICAL_PERCENT || '10', 10),
    },
    metricAlerts: {
      activeConnectionsWarning: parseInt(
        process.env.ALERT_ACTIVE_CONNECTIONS_WARNING || '1000',
        10
      ),
      activeConnectionsCritical: parseInt(
        process.env.ALERT_ACTIVE_CONNECTIONS_CRITICAL || '2000',
        10
      ),
      matchQueueWarning: parseInt(process.env.ALERT_MATCH_QUEUE_WARNING || '50', 10),
      matchQueueCritical: parseInt(process.env.ALERT_MATCH_QUEUE_CRITICAL || '100', 10),
      matchWaitTimeWarningSec: parseInt(process.env.ALERT_MATCH_WAIT_TIME_WARNING_SEC || '60', 10),
      matchWaitTimeCriticalSec: parseInt(
        process.env.ALERT_MATCH_WAIT_TIME_CRITICAL_SEC || '180',
        10
      ),
      dbQueryTimeWarningMs: parseInt(process.env.ALERT_DB_QUERY_TIME_WARNING_MS || '100', 10),
      dbQueryTimeCriticalMs: parseInt(process.env.ALERT_DB_QUERY_TIME_CRITICAL_MS || '500', 10),
      failedLoginsWarning: parseInt(process.env.ALERT_FAILED_LOGINS_WARNING || '10', 10),
      failedLoginsCritical: parseInt(process.env.ALERT_FAILED_LOGINS_CRITICAL || '50', 10),
      purchaseFailuresWarning: parseInt(process.env.ALERT_PURCHASE_FAILURES_WARNING || '5', 10),
      purchaseFailuresCritical: parseInt(process.env.ALERT_PURCHASE_FAILURES_CRITICAL || '20', 10),
    },
    cooldowns: {
      critical: parseInt(process.env.ALERT_COOLDOWN_CRITICAL || '300', 10),
      error: parseInt(process.env.ALERT_COOLDOWN_ERROR || '600', 10),
      warning: parseInt(process.env.ALERT_COOLDOWN_WARNING || '900', 10),
      info: parseInt(process.env.ALERT_COOLDOWN_INFO || '1800', 10),
    },
    minEnvironmentLevel: (process.env.ALERTING_MIN_ENV_LEVEL || 'staging') as
      | 'development'
      | 'staging'
      | 'production',
    tags: {
      service: 'armored-archer-backend',
      version: process.env.APP_VERSION || 'unknown',
    },
  },

  errorInsights: {
    enabled: process.env.ERROR_INSIGHTS_ENABLED === 'true',
    aggregationWindowMinutes: parseInt(process.env.ERROR_INSIGHTS_AGGREGATION_WINDOW || '15', 10),
    minOccurrencesForInsight: parseInt(process.env.ERROR_INSIGHTS_MIN_OCCURRENCES || '3', 10),
    insightWindowHours: parseInt(process.env.ERROR_INSIGHTS_WINDOW_HOURS || '24', 10),
    maxPatterns: parseInt(process.env.ERROR_INSIGHTS_MAX_PATTERNS || '100', 10),
    maxInsights: parseInt(process.env.ERROR_INSIGHTS_MAX_INSIGHTS || '50', 10),
    autoResolvePatterns: process.env.ERROR_INSIGHTS_AUTO_RESOLVE !== 'false',
    patternTtlDays: parseInt(process.env.ERROR_INSIGHTS_PATTERN_TTL_DAYS || '7', 10),
  },

  nPlusOne: {
    enabled: process.env.N_PLUS_ONE_ENABLED === 'true',
    threshold: parseInt(process.env.N_PLUS_ONE_THRESHOLD || '3', 10),
    logEnabled: process.env.N_PLUS_ONE_LOG_ENABLED !== 'false',
    metricsEnabled: process.env.N_PLUS_ONE_METRICS_ENABLED !== 'false',
    slowQueryThresholdMs: parseInt(process.env.N_PLUS_ONE_SLOW_QUERY_MS || '100', 10),
    autoTrackStorage: process.env.N_PLUS_ONE_AUTO_TRACK_STORAGE !== 'false',
  },

  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false', // Enabled by default, disabled only when explicitly set to 'false'
    mixpanel: process.env.MIXPANEL_API_KEY
      ? {
          enabled: process.env.MIXPANEL_ENABLED !== 'false',
          apiKey: process.env.MIXPANEL_API_KEY,
        }
      : undefined,
    amplitude: process.env.AMPLITUDE_API_KEY
      ? {
          enabled: process.env.AMPLITUDE_ENABLED !== 'false',
          apiKey: process.env.AMPLITUDE_API_KEY,
        }
      : undefined,
    segment: process.env.SEGMENT_WRITE_KEY
      ? {
          enabled: process.env.SEGMENT_ENABLED !== 'false',
          writeKey: process.env.SEGMENT_WRITE_KEY,
        }
      : undefined,
    customEndpoint: process.env.ANALYTICS_CUSTOM_ENDPOINT
      ? {
          url: process.env.ANALYTICS_CUSTOM_ENDPOINT,
          apiKey: process.env.ANALYTICS_CUSTOM_API_KEY,
        }
      : undefined,
  },

  datadog:
    process.env.DATADOG_ENABLED === 'true'
      ? {
          enabled: true,
          apiKey: process.env.DATADOG_API_KEY,
          appKey: process.env.DATADOG_APP_KEY,
          host: process.env.DATADOG_HOST || 'localhost',
          port: parseInt(process.env.DATADOG_PORT || '8125', 10),
          prefix: process.env.DATADOG_PREFIX || 'armed_archer',
          tags: {
            environment: process.env.NODE_ENV || 'development',
            service: 'armored-archer-backend',
            ...(process.env.DATADOG_TAGS
              ? (() => {
                  try {
                    return JSON.parse(process.env.DATADOG_TAGS!);
                  } catch {
                    return {};
                  }
                })()
              : {}),
          },
        }
      : undefined,
};

/**
 * Validates that a config value is not a default/empty value
 */
function isInvalidConfigValue(value: unknown, productionOnly = false): boolean {
  if (!value) return true;
  const strValue = String(value);
  const isDefault =
    strValue === 'defaultkey' ||
    strValue === 'default-token-key' ||
    strValue === 'default-refresh-key';
  if (isDefault && productionOnly) return true;
  return false;
}

/**
 * Gets a nested config value by path
 */
function getNestedConfigValue(path: string): unknown {
  return path.split('.').reduce((obj: unknown, k) => {
    if (typeof obj !== 'object' || obj === null) return undefined;
    return (obj as Record<string, unknown>)[k];
  }, config);
}

/**
 * Validates a port number is in valid range
 */
function isValidPort(port: number): boolean {
  return port >= 1 && port <= 65535;
}

/**
 * Validates required session keys in production
 */
function validateSessionKeys(): string[] {
  const errors: string[] = [];
  const requiredKeys = [
    'session.encryptionKey',
    'session.refreshEncryptionKey',
    'session.tokenEncryptionKey',
  ];

  const isProduction = config.environment === 'production';

  for (const key of requiredKeys) {
    const value = getNestedConfigValue(key);
    if (isInvalidConfigValue(value, isProduction)) {
      errors.push(`${key} must be set in production`);
    }
  }

  return errors;
}

export function validateRequiredConfig(): void {
  // Validate server key in production
  if (config.environment === 'production' && isInvalidConfigValue(config.server.key, true)) {
    throw new Error('NAKAMA_SERVER_KEY must be set in production');
  }

  // Validate RevenueCat config in production
  if (config.environment === 'production' && !config.revenuecat.secretKey) {
    throw new Error('REVENUECAT_SECRET_KEY is required in production');
  }

  if (config.environment === 'production' && !config.revenuecat.webhookSecret) {
    throw new Error('REVENUECAT_WEBHOOK_SECRET is required in production');
  }

  if (!config.database.address) {
    throw new Error('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
  }

  // Validate session keys in production
  const sessionErrors = validateSessionKeys();
  if (sessionErrors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${sessionErrors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  // Validate port numbers
  if (!isValidPort(config.server.port)) {
    throw new Error(`Invalid server port: ${config.server.port}. Must be between 1 and 65535`);
  }

  if (!isValidPort(config.server.consolePort)) {
    throw new Error(
      `Invalid console port: ${config.server.consolePort}. Must be between 1 and 65535`
    );
  }

  if (!isValidPort(config.database.port)) {
    throw new Error(`Invalid database port: ${config.database.port}. Must be between 1 and 65535`);
  }
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}

export function logConfiguration(logger: {
  info: (message: string, ...args: unknown[]) => void;
}): void {
  logger.info('=== Configuration ===');
  logger.info('Environment: %s', config.environment);
  logger.info(
    'Server: host=%s, port=%d, console_port=%d',
    config.server.host,
    config.server.port,
    config.server.consolePort
  );
  logger.info(
    'Database: host=%s, port=%d, database=%s',
    config.database.host,
    config.database.port,
    config.database.database
  );
  logger.info(
    'RevenueCat: public_key=%s, webhook_secret_configured=%s',
    maskSecret(config.revenuecat.publicKey),
    config.revenuecat.webhookSecret ? 'true' : 'false'
  );
  logger.info('Session: expiry_sec=%d', config.session.expirySec);
  logger.info(
    'Logger: level=%s, format=%s, output=%s, scrubLogs=%s',
    config.logger.level,
    config.logger.format,
    config.logger.output,
    config.logger.scrubLogs
  );
  logger.info('Match: allow_host_loopback=%s', config.match.allowHostLoopback);
  logger.info(
    'Metrics: namespace=%s, prometheus_port=%d',
    config.metrics.namespace,
    config.metrics.prometheusPort
  );
  logger.info(
    'Alerting: enabled=%s, default_provider=%s, min_env_level=%s',
    config.alerting.enabled,
    config.alerting.defaultProvider,
    config.alerting.minEnvironmentLevel
  );
  logger.info('====================');
}

export default config;
