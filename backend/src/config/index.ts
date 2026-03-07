import * as fs from 'fs';
import * as path from 'path';

function loadEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFiles = [`.env.${nodeEnv}`, '.env', `.env.${nodeEnv}.local`];

  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
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
}

export interface SessionConfig {
  encryptionKey: string;
  refreshEncryptionKey: string;
  tokenEncryptionKey: string;
  expirySec: number;
}

export interface LoggerConfig {
  level: string;
  format: string;
  output: string;
  /** Enable or disable log scrubbing */
  scrubLogs: boolean;
  /** Additional field names to treat as sensitive */
  additionalSensitiveFields?: string[];
  /** Maximum depth to scrub in nested objects */
  maxScrubDepth?: number;
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
  exporter: 'jaeger' | 'zipkin' | 'otlp' | 'none';
  sampleRate: number;
  jaegerEndpoint?: string;
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
    method: 'POST' | 'PUT';
    headers: Record<string, string>;
    authType: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
  email?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    from: string;
    to: string[];
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

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  server: ServerConfig;
  database: DatabaseConfig;
  revenuecat: RevenueCatConfig;
  session: SessionConfig;
  logger: LoggerConfig;
  match: MatchConfig;
  metrics: MetricsConfig;
  rateLimit: RateLimitConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
}

function parseDatabaseAddress(address: string): DatabaseConfig {
  const dbRegex = /^(\w+):([^@]+)@([^:]+):(\d+)\/(\w+)$/;
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
    },
  },

  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true',
    serviceName: process.env.TRACING_SERVICE_NAME || 'armored-archer-backend',
    serviceVersion: process.env.TRACING_SERVICE_VERSION || '0.1.0',
    exporter: (process.env.TRACING_EXPORTER || 'jaeger') as 'jaeger' | 'zipkin' | 'otlp' | 'none',
    sampleRate: parseFloat(process.env.TRACING_SAMPLE_RATE || '1.0'),
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
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
};

export function validateRequiredConfig(): void {
  const errors: string[] = [];

  if (!config.server.key || config.server.key === 'defaultkey') {
    if (config.environment === 'production') {
      errors.push('NAKAMA_SERVER_KEY must be set in production');
    }
  }

  if (!config.revenuecat.publicKey) {
    errors.push('REVENUECAT_PUBLIC_KEY is required');
  }

  if (!config.database.address) {
    errors.push('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
  }

  const requiredKeys: { key: string; path: string }[] = [
    { key: 'session.encryptionKey', path: 'session.encryptionKey' },
    { key: 'session.refreshEncryptionKey', path: 'session.refreshEncryptionKey' },
    { key: 'session.tokenEncryptionKey', path: 'session.tokenEncryptionKey' },
  ];

  for (const { key, path: configPath } of requiredKeys) {
    const value = key.split('.').reduce((obj: unknown, k) => {
      if (typeof obj !== 'object' || obj === null) return undefined;
      return (obj as Record<string, unknown>)[k];
    }, config);
    if (!value || value === 'default-token-key' || value === 'default-refresh-key') {
      if (config.environment === 'production') {
        errors.push(`${configPath} must be set in production`);
      }
    }
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid server port: ${config.server.port}. Must be between 1 and 65535`);
  }

  if (config.server.consolePort < 1 || config.server.consolePort > 65535) {
    errors.push(`Invalid console port: ${config.server.consolePort}. Must be between 1 and 65535`);
  }

  if (config.database.port < 1 || config.database.port > 65535) {
    errors.push(`Invalid database port: ${config.database.port}. Must be between 1 and 65535`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
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
  logger.info('RevenueCat: public_key=%s', maskSecret(config.revenuecat.publicKey));
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
