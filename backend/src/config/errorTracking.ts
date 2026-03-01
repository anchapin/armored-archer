import * as Sentry from '@sentry/node';
import { config } from '../config';

export interface ErrorTrackingConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

export const errorTrackingConfig: ErrorTrackingConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || config.environment,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  enabled: process.env.SENTRY_ENABLED === 'true' || config.environment === 'production'
};

export function initializeSentry(): void {
  if (!errorTrackingConfig.enabled || !errorTrackingConfig.dsn) {
    console.log('[ErrorTracking] Sentry is disabled - missing DSN or disabled by config');
    return;
  }

  Sentry.init({
    dsn: errorTrackingConfig.dsn,
    environment: errorTrackingConfig.environment,
    tracesSampleRate: errorTrackingConfig.tracesSampleRate,
    beforeSend(event: { request?: { headers?: unknown } }) {
      if (event.request) {
        event.request.headers = undefined;
      }
      return event;
    }
  });

  console.log(`[ErrorTracking] Sentry initialized in ${errorTrackingConfig.environment} environment`);
}

export function captureException(
  error: Error,
  context: {
    userId?: string;
    rpc?: string;
    extra?: Record<string, unknown>;
  } = {}
): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  const tags: Record<string, string> = {};
  if (context.userId) {
    tags.userId = context.userId;
  }
  if (context.rpc) {
    tags.rpc = context.rpc;
  }

  Sentry.captureException(error, {
    tags,
    extra: {
      ...context.extra,
      timestamp: new Date().toISOString()
    }
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: {
    userId?: string;
    rpc?: string;
    extra?: Record<string, unknown>;
  } = {}
): void {
  if (!errorTrackingConfig.enabled) {
    return;
  }

  const tags: Record<string, string> = {};
  if (context.userId) {
    tags.userId = context.userId;
  }
  if (context.rpc) {
    tags.rpc = context.rpc;
  }

  Sentry.captureMessage(message, {
    level,
    tags,
    extra: {
      ...context.extra,
      timestamp: new Date().toISOString()
    }
  });
}

export function captureRpcError(
  rpcName: string,
  userId: string,
  error: Error,
  payload?: string
): void {
  captureException(error, {
    userId,
    rpc: rpcName,
    extra: payload ? { payload } : undefined
  });
}
