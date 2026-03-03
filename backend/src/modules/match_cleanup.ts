/**
 * Match Cleanup module.
 * @fileoverview Handles scheduled cleanup of expired matches and turn timeouts.
 */

import { Runtime } from '../types/nakama';
import { PvPMatch } from './matchmaker';

const MATCH_CLEANUP_INTERVAL_MS = 60 * 1000; // Run cleanup every 1 minute

/**
 * Registers the match cleanup scheduled job.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerMatchCleanupJob(initializer: Runtime.Initializer): void {
  initializer.registerEventSessionEnd(eventMatchCleanupOnSessionEnd);
}

/**
 * Event handler for cleaning up expired matches when a user session ends.
 * This is called automatically when a player disconnects.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param event - Session end event data
 */
export function eventMatchCleanupOnSessionEnd(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  event: Runtime.SessionEndEvent
): void {
  logger.info('Session ended for user: %s', event.userId);
  
  // Clean up any expired matches for this user
  cleanupExpiredMatches(nk, event.userId, logger);
}

/**
 * Periodic cleanup function to expire stale matches.
 * Should be called periodically (e.g., every minute) to clean up:
 * - Pending matches that have expired (24 hours old)
 * - Active matches that have been idle too long (7 days)
 *
 * @param nk - Nakama server interface
 * @param logger - Nakama logger instance
 * @param adminUserId - Optional admin user ID for batch operations
 */
export function cleanupExpiredMatches(nk: Runtime.Nakama, adminUserId?: string, logger?: Runtime.Logger): void {
  try {
    const now = Date.now();
    
    // Read a batch of matches (this is a simplified version)
    // In a real implementation, you'd scan the entire collection
    const matches = nk.storageList('', 'pvp_matches', 1000, '', '');
    
    let expiredCount = 0;
    
    for (const object of matches) {
      try {
        const match: PvPMatch = JSON.parse(object.value);
        
        // Check if match has expired
        if (now > match.expires_at && match.status !== 'completed' && match.status !== 'expired') {
          logger?.info('Expiring match %s', match.match_id);
          
          // Mark match as expired
          match.status = 'expired';
          match.updated_at = now;
          
          // Award loss to both players if match was active
          if (match.status === 'active') {
            // In a full implementation, you might notify players or update leaderboards
            logger?.info('Match %s was active when expired', match.match_id);
          }
          
          // Save the expired match
          nk.storageWrite([
            {
              collection: 'pvp_matches',
              key: match.match_id,
              userId: match.creator_id,
              value: JSON.stringify(match),
            },
          ]);
          
          expiredCount++;
        }
      } catch (e) {
        logger?.error('Error processing match for cleanup: %s', e);
      }
    }
    
    if (logger && expiredCount > 0) {
      logger.info('Cleanup: Expired %d matches', expiredCount);
    }
  } catch (e) {
    logger?.error('Error in match cleanup: %s', e);
  }
}

/**
 * Called by RPC to manually trigger match cleanup.
 * Useful for admin operations or testing.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with cleanup result
 */
export function rpcTriggerMatchCleanup(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Manual match cleanup triggered by user: %s', ctx.userId);
  
  // Only allow admins to trigger this
  // In production, you'd check ctx.userId against an admin list
  
  cleanupExpiredMatches(nk, ctx.userId, logger);
  
  return JSON.stringify({
    success: true,
    message: 'Match cleanup triggered',
  });
}
