/**
 * Tests for config re-exports
 */

describe('config re-exports', () => {
  it('re-exports config as named export', () => {
    const { config } = require('../config');
    expect(config).toBeDefined();
    expect(config.environment).toBeDefined();
  });

  it('re-exports validateRequiredConfig', () => {
    const { validateRequiredConfig } = require('../config');
    expect(validateRequiredConfig).toBeDefined();
    expect(typeof validateRequiredConfig).toBe('function');
  });

  it('re-exports maskSecret', () => {
    const { maskSecret } = require('../config');
    expect(maskSecret).toBeDefined();
    expect(typeof maskSecret).toBe('function');
  });

  it('re-exports logConfiguration', () => {
    const { logConfiguration } = require('../config');
    expect(logConfiguration).toBeDefined();
    expect(typeof logConfiguration).toBe('function');
  });

  it('exports type definitions', () => {
    const configModule = require('../config');
    expect(configModule).toBeDefined();
  });
});

describe('config module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('maskSecret', () => {
    it('returns empty string for empty input', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('')).toBe('');
    });

    it('returns *** for short values (<=8 chars)', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('short')).toBe('***');
      expect(maskSecret('12345678')).toBe('***');
    });

    it('masks long values showing first 4 and last 4 chars', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('abcdefghijklmnop')).toBe('abcd...mnop');
    });

    it('masks API keys appropriately', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('sk-1234567890abcdef')).toBe('sk-1...cdef');
    });
  });

  describe('logConfiguration', () => {
    it('logs configuration without throwing', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = {
        info: jest.fn(),
      };
      expect(() => logConfiguration(mockLogger)).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('=== Configuration ===');
    });

    it('logs server configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Server:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs database configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Database:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs RevenueCat configuration with masked secret', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('RevenueCat:'),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs alerting configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alerting:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('validateRequiredConfig', () => {
    it('throws when RevenueCat public key is missing', () => {
      delete process.env.REVENUECAT_PUBLIC_KEY;
      delete process.env.DATABASE_ADDRESS;
      delete process.env.NAKAMA_DATABASE_ADDRESS;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('REVENUECAT_PUBLIC_KEY is required');
    });

    it('throws when database address is missing', () => {
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      delete process.env.DATABASE_ADDRESS;
      delete process.env.NAKAMA_DATABASE_ADDRESS;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow(
        'DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required'
      );
    });

    it('throws when server key is missing in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NAKAMA_SERVER_KEY;
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('NAKAMA_SERVER_KEY must be set in production');
    });

    it('throws when session encryption keys are missing in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NAKAMA_SERVER_KEY = 'server-key-12345';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      delete process.env.SESSION_ENCRYPTION_KEY;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Configuration validation failed');
    });

    it('throws when server port is invalid', () => {
      process.env.NAKAMA_PORT = '99999';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Invalid server port');
    });

    it('throws when console port is invalid', () => {
      process.env.NAKAMA_CONSOLE_PORT = '99999';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Invalid console port');
    });

    it('passes with valid configuration', () => {
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).not.toThrow();
    });

    it('throws when database port is invalid', () => {
      process.env.NAKAMA_PORT = '7350';
      process.env.NAKAMA_CONSOLE_PORT = '7351';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:99999/nakama';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Invalid database port');
    });
  });

  describe('config object - database configuration', () => {
    it('should parse postgres:// connection string', () => {
      process.env.DATABASE_ADDRESS = 'postgres://myuser:mypass@myhost:5433/mydb';
      const { config } = require('../config');
      expect(config.database.host).toBe('myhost');
      expect(config.database.port).toBe(5433);
      expect(config.database.user).toBe('myuser');
      expect(config.database.password).toBe('mypass');
      expect(config.database.database).toBe('mydb');
    });

    it('should parse connection string without postgres:// prefix', () => {
      process.env.DATABASE_ADDRESS = 'myuser:mypass@myhost:5433/mydb';
      const { config } = require('../config');
      expect(config.database.host).toBe('myhost');
      expect(config.database.port).toBe(5433);
      expect(config.database.user).toBe('myuser');
      expect(config.database.password).toBe('mypass');
      expect(config.database.database).toBe('mydb');
    });

    it('should use fallback env vars when address is invalid', () => {
      process.env.DATABASE_ADDRESS = 'invalid-address';
      process.env.DB_HOST = 'fallback-host';
      process.env.DB_PORT = '5434';
      process.env.DB_USER = 'fallback-user';
      process.env.DB_PASSWORD = 'fallback-pass';
      process.env.DB_NAME = 'fallback-db';
      const { config } = require('../config');
      expect(config.database.host).toBe('fallback-host');
      expect(config.database.port).toBe(5434);
      expect(config.database.user).toBe('fallback-user');
      expect(config.database.password).toBe('fallback-pass');
      expect(config.database.database).toBe('fallback-db');
    });

    it('should use default values when no valid address and no env vars', () => {
      process.env.DATABASE_ADDRESS = 'invalid-address';
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
      delete process.env.DB_NAME;
      const { config } = require('../config');
      expect(config.database.host).toBe('localhost');
      expect(config.database.port).toBe(5432);
      expect(config.database.user).toBe('postgres');
      expect(config.database.password).toBe('');
      expect(config.database.database).toBe('nakama');
    });
  });

  describe('config object - server configuration', () => {
    it('should use NAKAMA_PORT when provided', () => {
      process.env.NAKAMA_PORT = '8000';
      const { config } = require('../config');
      expect(config.server.port).toBe(8000);
    });

    it('should use NAKAMA_SOCKET_PORT as fallback for port', () => {
      process.env.NAKAMA_SOCKET_PORT = '9000';
      delete process.env.NAKAMA_PORT;
      const { config } = require('../config');
      expect(config.server.port).toBe(9000);
    });

    it('should use NAKAMA_SERVER_KEY when provided', () => {
      process.env.NAKAMA_SERVER_KEY = 'custom-server-key';
      const { config } = require('../config');
      expect(config.server.key).toBe('custom-server-key');
    });

    it('should use NAKAMA_SOCKET_SERVER_KEY as fallback for server key', () => {
      process.env.NAKAMA_SOCKET_SERVER_KEY = 'socket-server-key';
      delete process.env.NAKAMA_SERVER_KEY;
      const { config } = require('../config');
      expect(config.server.key).toBe('socket-server-key');
    });
  });

  describe('config object - logger configuration', () => {
    it('should parse scrub outputs when provided', () => {
      process.env.LOG_SCRUB_OUTPUTS = 'console,file';
      const { config } = require('../config');
      expect(config.logger.scrubOutputs).toEqual(['console', 'file']);
    });

    it('should parse additional sensitive fields when provided', () => {
      process.env.LOG_SCRUB_ADDITIONAL_FIELDS = 'password,token,secret';
      const { config } = require('../config');
      expect(config.logger.additionalSensitiveFields).toEqual(['password', 'token', 'secret']);
    });

    it('should parse max scrub depth when provided', () => {
      process.env.LOG_SCRUB_MAX_DEPTH = '10';
      const { config } = require('../config');
      expect(config.logger.maxScrubDepth).toBe(10);
    });

    it('should set scrubByLevel when enabled', () => {
      process.env.LOG_SCRUB_BY_LEVEL = 'true';
      const { config } = require('../config');
      expect(config.logger.scrubByLevel).toBeDefined();
      expect(config.logger.scrubByLevel?.error?.enabled).toBe(true);
      expect(config.logger.scrubByLevel?.warn?.enabled).toBe(true);
      expect(config.logger.scrubByLevel?.info?.enabled).toBe(true);
      expect(config.logger.scrubByLevel?.debug?.enabled).toBe(true);
    });
  });

  describe('config object - rate limit configuration', () => {
    it('should parse all rate limit endpoint configs', () => {
      process.env.RATE_LIMIT_GENERATE_GEAR_MAX = '50';
      process.env.RATE_LIMIT_GENERATE_GEAR_WINDOW_MS = '30000';
      const { config } = require('../config');
      expect(config.rateLimit.endpoints.generate_gear).toBeDefined();
      expect(config.rateLimit.endpoints.generate_gear.maxRequests).toBe(50);
      expect(config.rateLimit.endpoints.generate_gear.windowMs).toBe(30000);
    });

    it('should have default rate limit values', () => {
      const { config } = require('../config');
      expect(config.rateLimit.defaultMaxRequests).toBe(100);
      expect(config.rateLimit.defaultWindowMs).toBe(60000);
    });
  });

  describe('config object - analytics configuration', () => {
    it('should parse Mixpanel config when API key provided', () => {
      process.env.MIXPANEL_API_KEY = 'mixpanel-key';
      const { config } = require('../config');
      expect(config.analytics.mixpanel).toBeDefined();
      expect(config.analytics.mixpanel!.apiKey).toBe('mixpanel-key');
    });

    it('should parse Amplitude config when API key provided', () => {
      process.env.AMPLITUDE_API_KEY = 'amplitude-key';
      const { config } = require('../config');
      expect(config.analytics.amplitude).toBeDefined();
      expect(config.analytics.amplitude!.apiKey).toBe('amplitude-key');
    });

    it('should parse Segment config when write key provided', () => {
      process.env.SEGMENT_WRITE_KEY = 'segment-key';
      const { config } = require('../config');
      expect(config.analytics.segment).toBeDefined();
      expect(config.analytics.segment!.writeKey).toBe('segment-key');
    });

    it('should enable analytics by default', () => {
      const { config } = require('../config');
      expect(config.analytics.enabled).toBe(true);
    });

    it('should disable analytics when explicitly set to false', () => {
      process.env.ANALYTICS_ENABLED = 'false';
      const { config } = require('../config');
      expect(config.analytics.enabled).toBe(false);
    });
  });

  describe('config object - redis configuration', () => {
    it('should parse redis configuration', () => {
      process.env.REDIS_HOST = 'redis-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'redis-pass';
      process.env.REDIS_DB = '5';
      process.env.REDIS_ENABLED = 'true';
      const { config } = require('../config');
      expect(config.redis.host).toBe('redis-host');
      expect(config.redis.port).toBe(6380);
      expect(config.redis.password).toBe('redis-pass');
      expect(config.redis.db).toBe(5);
      expect(config.redis.enabled).toBe(true);
    });
  });

  describe('config object - firebase configuration', () => {
    it('should parse firebase configuration', () => {
      process.env.FIREBASE_ENABLED = 'true';
      process.env.FIREBASE_PROJECT_ID = 'test-project';
      process.env.FIREBASE_PRIVATE_KEY = 'private-key';
      process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
      process.env.FIREBASE_DATABASE_URL = 'https://test.firebaseio.com';
      const { config } = require('../config');
      expect(config.firebase.enabled).toBe(true);
      expect(config.firebase.projectId).toBe('test-project');
      expect(config.firebase.privateKey).toBe('private-key');
      expect(config.firebase.clientEmail).toBe('test@test.com');
      expect(config.firebase.databaseUrl).toBe('https://test.firebaseio.com');
    });
  });

  describe('config object - session configuration', () => {
    it('should parse session configuration', () => {
      process.env.SESSION_ENCRYPTION_KEY = 'session-key';
      process.env.REFRESH_ENCRYPTION_KEY = 'refresh-key';
      process.env.TOKEN_ENCRYPTION_KEY = 'token-key';
      process.env.SESSION_EXPIRY_SEC = '3600';
      const { config } = require('../config');
      expect(config.session.encryptionKey).toBe('session-key');
      expect(config.session.refreshEncryptionKey).toBe('refresh-key');
      expect(config.session.tokenEncryptionKey).toBe('token-key');
      expect(config.session.expirySec).toBe(3600);
    });
  });

  describe('config object - tracing configuration', () => {
    it('should parse tracing configuration', () => {
      process.env.TRACING_ENABLED = 'true';
      process.env.TRACING_SERVICE_NAME = 'test-service';
      process.env.TRACING_SERVICE_VERSION = '1.0.0';
      process.env.TRACING_EXPORTER = 'otlp';
      process.env.TRACING_SAMPLE_RATE = '0.5';
      process.env.OTLP_ENDPOINT = 'http://localhost:4317';
      const { config } = require('../config');
      expect(config.tracing.enabled).toBe(true);
      expect(config.tracing.serviceName).toBe('test-service');
      expect(config.tracing.serviceVersion).toBe('1.0.0');
      expect(config.tracing.exporter).toBe('otlp');
      expect(config.tracing.sampleRate).toBe(0.5);
      expect(config.tracing.otlpEndpoint).toBe('http://localhost:4317');
    });

    it('should parse custom instrumentations when provided', () => {
      process.env.TRACING_INSTRUMENTATIONS = 'http,express,postgres';
      const { config } = require('../config');
      expect(config.tracing.instrumentations).toEqual(['http', 'express', 'postgres']);
    });
  });

  describe('config object - alerting configuration', () => {
    it('should parse alerting enabled flag', () => {
      process.env.ALERTING_ENABLED = 'true';
      const { config } = require('../config');
      expect(config.alerting.enabled).toBe(true);
    });

    it('should parse alerting routing configuration', () => {
      process.env.ALERTING_ROUTING_CRITICAL = 'pagerduty';
      process.env.ALERTING_ROUTING_ERROR = 'slack';
      process.env.ALERTING_ROUTING_WARNING = 'slack';
      process.env.ALERTING_ROUTING_INFO = 'none';
      const { config } = require('../config');
      expect(config.alerting.routing.critical).toBe('pagerduty');
      expect(config.alerting.routing.error).toBe('slack');
      expect(config.alerting.routing.warning).toBe('slack');
      expect(config.alerting.routing.info).toBe('none');
    });

    it('should parse health alert thresholds', () => {
      process.env.ALERT_CPU_WARNING_PERCENT = '80';
      process.env.ALERT_CPU_CRITICAL_PERCENT = '95';
      process.env.ALERT_MEMORY_WARNING_PERCENT = '85';
      process.env.ALERT_MEMORY_CRITICAL_PERCENT = '95';
      const { config } = require('../config');
      expect(config.alerting.healthAlerts.cpuWarningPercent).toBe(80);
      expect(config.alerting.healthAlerts.cpuCriticalPercent).toBe(95);
      expect(config.alerting.healthAlerts.memoryWarningPercent).toBe(85);
      expect(config.alerting.healthAlerts.memoryCriticalPercent).toBe(95);
    });

    it('should parse metric alert thresholds', () => {
      process.env.ALERT_ACTIVE_CONNECTIONS_WARNING = '500';
      process.env.ALERT_ACTIVE_CONNECTIONS_CRITICAL = '1000';
      process.env.ALERT_MATCH_QUEUE_WARNING = '30';
      process.env.ALERT_MATCH_QUEUE_CRITICAL = '50';
      const { config } = require('../config');
      expect(config.alerting.metricAlerts.activeConnectionsWarning).toBe(500);
      expect(config.alerting.metricAlerts.activeConnectionsCritical).toBe(1000);
      expect(config.alerting.metricAlerts.matchQueueWarning).toBe(30);
      expect(config.alerting.metricAlerts.matchQueueCritical).toBe(50);
    });

    it('should parse alerting cooldowns', () => {
      process.env.ALERT_COOLDOWN_CRITICAL = '600';
      process.env.ALERT_COOLDOWN_ERROR = '1200';
      process.env.ALERT_COOLDOWN_WARNING = '1800';
      process.env.ALERT_COOLDOWN_INFO = '3600';
      const { config } = require('../config');
      expect(config.alerting.cooldowns.critical).toBe(600);
      expect(config.alerting.cooldowns.error).toBe(1200);
      expect(config.alerting.cooldowns.warning).toBe(1800);
      expect(config.alerting.cooldowns.info).toBe(3600);
    });

    it('should parse PagerDuty configuration when keys provided', () => {
      process.env.PAGERDUTY_API_KEY = 'pd-api-key';
      process.env.PAGERDUTY_SERVICE_ID = 'pd-service-id';
      process.env.PAGERDUTY_INTEGRATION_KEY = 'pd-integration-key';
      const { config } = require('../config');
      expect(config.alerting.pagerduty).toBeDefined();
      expect(config.alerting.pagerduty!.apiKey).toBe('pd-api-key');
      expect(config.alerting.pagerduty!.serviceId).toBe('pd-service-id');
      expect(config.alerting.pagerduty!.integrationKey).toBe('pd-integration-key');
    });

    it('should parse Slack configuration when webhook URL provided', () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/webhook';
      process.env.SLACK_CHANNEL = '#alerts';
      process.env.SLACK_USERNAME = 'AlertBot';
      process.env.SLACK_ICON_EMOJI = ':rotating_light:';
      const { config } = require('../config');
      expect(config.alerting.slack).toBeDefined();
      expect(config.alerting.slack!.webhookUrl).toBe('https://hooks.slack.com/webhook');
      expect(config.alerting.slack!.channel).toBe('#alerts');
      expect(config.alerting.slack!.username).toBe('AlertBot');
      expect(config.alerting.slack!.iconEmoji).toBe(':rotating_light:');
    });
  });

  describe('config object - error insights configuration', () => {
    it('should parse error insights configuration', () => {
      process.env.ERROR_INSIGHTS_ENABLED = 'true';
      process.env.ERROR_INSIGHTS_AGGREGATION_WINDOW = '30';
      process.env.ERROR_INSIGHTS_MIN_OCCURRENCES = '5';
      process.env.ERROR_INSIGHTS_WINDOW_HOURS = '48';
      process.env.ERROR_INSIGHTS_MAX_PATTERNS = '200';
      process.env.ERROR_INSIGHTS_MAX_INSIGHTS = '100';
      process.env.ERROR_INSIGHTS_AUTO_RESOLVE = 'true';
      process.env.ERROR_INSIGHTS_PATTERN_TTL_DAYS = '14';
      const { config } = require('../config');
      expect(config.errorInsights.enabled).toBe(true);
      expect(config.errorInsights.aggregationWindowMinutes).toBe(30);
      expect(config.errorInsights.minOccurrencesForInsight).toBe(5);
      expect(config.errorInsights.insightWindowHours).toBe(48);
      expect(config.errorInsights.maxPatterns).toBe(200);
      expect(config.errorInsights.maxInsights).toBe(100);
      expect(config.errorInsights.autoResolvePatterns).toBe(true);
      expect(config.errorInsights.patternTtlDays).toBe(14);
    });
  });

  describe('config object - n+1 query detection configuration', () => {
    it('should parse n+1 configuration', () => {
      process.env.N_PLUS_ONE_ENABLED = 'true';
      process.env.N_PLUS_ONE_THRESHOLD = '5';
      process.env.N_PLUS_ONE_LOG_ENABLED = 'true';
      process.env.N_PLUS_ONE_METRICS_ENABLED = 'true';
      process.env.N_PLUS_ONE_SLOW_QUERY_MS = '200';
      process.env.N_PLUS_ONE_AUTO_TRACK_STORAGE = 'true';
      const { config } = require('../config');
      expect(config.nPlusOne.enabled).toBe(true);
      expect(config.nPlusOne.threshold).toBe(5);
      expect(config.nPlusOne.logEnabled).toBe(true);
      expect(config.nPlusOne.metricsEnabled).toBe(true);
      expect(config.nPlusOne.slowQueryThresholdMs).toBe(200);
      expect(config.nPlusOne.autoTrackStorage).toBe(true);
    });
  });

  describe('config object - DataDog configuration', () => {
    it('should parse DataDog configuration when enabled', () => {
      process.env.DATADOG_ENABLED = 'true';
      process.env.DATADOG_API_KEY = 'dd-api-key';
      process.env.DATADOG_APP_KEY = 'dd-app-key';
      process.env.DATADOG_HOST = 'dd-host';
      process.env.DATADOG_PORT = '8126';
      process.env.DATADOG_PREFIX = 'dd-prefix';
      const { config } = require('../config');
      expect(config.datadog).toBeDefined();
      expect(config.datadog!.enabled).toBe(true);
      expect(config.datadog!.apiKey).toBe('dd-api-key');
      expect(config.datadog!.appKey).toBe('dd-app-key');
      expect(config.datadog!.host).toBe('dd-host');
      expect(config.datadog!.port).toBe(8126);
      expect(config.datadog!.prefix).toBe('dd-prefix');
    });

    it('should parse DataDog tags when provided as JSON', () => {
      process.env.DATADOG_ENABLED = 'true';
      process.env.DATADOG_TAGS = '{"team":"backend","region":"us-east"}';
      const { config } = require('../config');
      expect(config.datadog!.tags).toEqual({
        team: 'backend',
        region: 'us-east',
        environment: expect.any(String),
        service: 'armored-archer-backend',
      });
    });

    it('should handle invalid JSON in DATADOG_TAGS gracefully', () => {
      process.env.DATADOG_ENABLED = 'true';
      process.env.DATADOG_TAGS = 'invalid-json';
      const { config } = require('../config');
      expect(config.datadog!.tags).toEqual({
        environment: expect.any(String),
        service: 'armored-archer-backend',
      });
    });

    it('should not include DataDog config when disabled', () => {
      process.env.DATADOG_ENABLED = 'false';
      const { config } = require('../config');
      expect(config.datadog).toBeUndefined();
    });
  });

  describe('config object - environment', () => {
    it('should use NODE_ENV when provided', () => {
      process.env.NODE_ENV = 'development';
      const { config } = require('../config');
      expect(config.environment).toBe('development');
    });

    it('should parse NODE_ENV when provided', () => {
      process.env.NODE_ENV = 'production';
      const { config } = require('../config');
      expect(config.environment).toBe('production');
    });

    it('should accept staging environment', () => {
      process.env.NODE_ENV = 'staging';
      const { config } = require('../config');
      expect(config.environment).toBe('staging');
    });
  });
});
