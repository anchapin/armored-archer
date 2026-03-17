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
declare const config: AppConfig;
export declare function validateRequiredConfig(): void;
export declare function maskSecret(value: string): string;
export declare function logConfiguration(logger: {
    info: (message: string, ...args: unknown[]) => void;
}): void;
export default config;
