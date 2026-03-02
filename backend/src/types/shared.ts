/**
 * Generic logger arguments interface.
 * 
 * @property [key: string] - Dynamic properties for logging
 */
export interface LoggerArgs {
  [key: string]: unknown;
}

/**
 * Storage metadata interface.
 * 
 * @property [key: string] - Dynamic properties for storage
 */
export interface StorageMetadata {
  [key: string]: unknown;
}

/**
 * Notification content interface.
 * 
 * @property [key: string] - Dynamic properties for notifications
 */
export interface NotificationContent {
  [key: string]: unknown;
}

/**
 * Leaderboard metadata interface.
 * 
 * @property [key: string] - Dynamic properties for leaderboards
 */
export interface LeaderboardMetadata {
  [key: string]: unknown;
}

/**
 * Wallet update metadata interface.
 * 
 * @property [key: string] - Dynamic properties for wallet updates
 */
export interface WalletUpdateMetadata {
  [key: string]: unknown;
}

/**
 * Match parameters interface.
 * 
 * @property [key: string] - Dynamic properties for matches
 */
export interface MatchParams {
  [key: string]: unknown;
}

/**
 * Before/after data interface.
 * 
 * @property [key: string] - Dynamic properties for before/after operations
 */
export interface BeforeAfterData {
  [key: string]: unknown;
}

/**
 * Leaderboard record data structure.
 * 
 * @property ownerId - ID of the player
 * @property username - Display name of the player
 * @property rank - Current rank
 * @property score - Current score
 * @property metadata - Optional metadata
 * @property expiry - Optional expiry time
 * @property maxNumScore - Maximum number of scores
 * @property numScore - Number of scores
 */
export interface LeaderboardRecord {
  ownerId: string;
  username: string;
  rank: number;
  score: number;
  metadata?: string;
  expiry?: number;
  maxNumScore?: number;
  numScore?: number;
}

/**
 * Stream user list result interface.
 * 
 * @property userId - ID of the user
 * @property presence - Presence information
 */
export interface StreamUserListResult {
  userId: string;
  presence: unknown;
}

/**
 * Match result interface.
 * 
 * @property success - Whether the match was successful
 * @property [key: string] - Additional result properties
 */
export interface MatchResult {
  success: boolean;
  [key: string]: unknown;
}

/**
 * Cache value type union.
 * Can be any JSON-serializable value.
 */
export type CacheValueType = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | Record<string, unknown>
  | unknown[]
  | unknown;

/**
 * RPC response interface.
 * 
 * @property success - Optional success flag
 * @property error - Optional error message
 * @property [key: string] - Additional response properties
 */
export interface RpcResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}
