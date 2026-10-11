import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';

/** Preserve SQL failure semantics while recording a fixed, non-PII operation. */
export function observedSqlQuery(
  nk: Runtime.Nakama,
  operation: string,
  query: string,
  params?: unknown[],
  context?: { rpc: string; logger: Runtime.Logger }
): unknown[] {
  try {
    return nk.sqlQuery(query, params);
  } catch (error) {
    // Never log SQL, parameters, user IDs or driver messages here.
    const errorLogger = context?.logger ?? logger;
    if (context) {
      errorLogger.error('Database query failed: rpc=%s op=%s', context.rpc, operation);
    } else {
      logger.error('Database query failed', { operation });
    }
    try {
      const tags: Record<string, string> = context
        ? { op: operation, rpc: context.rpc }
        : { op: operation };
      nk.metricsCounterAdd?.('db_errors_total', tags, 1);
    } catch {
      // Metrics availability must not replace the original database failure.
      logger.warn('Database error metric unavailable', { operation });
    }
    throw error;
  }
}
