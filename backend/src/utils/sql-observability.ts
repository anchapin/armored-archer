import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';

/** Preserve SQL failure semantics while recording a fixed, non-PII operation. */
export function observedSqlQuery(
  nk: Runtime.Nakama,
  operation: string,
  query: string,
  params?: unknown[]
): unknown[] {
  try {
    return nk.sqlQuery(query, params);
  } catch (error) {
    // Never log SQL, parameters, user IDs or driver messages here.
    logger.error('Database query failed', { operation });
    try {
      nk.metricsCounterAdd?.('db_errors_total', { op: operation }, 1);
    } catch {
      // Metrics availability must not replace the original database failure.
      logger.warn('Database error metric unavailable', { operation });
    }
    throw error;
  }
}
