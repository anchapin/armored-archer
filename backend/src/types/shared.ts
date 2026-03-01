export interface LoggerArgs {
  [key: string]: unknown;
}

export interface StorageMetadata {
  [key: string]: unknown;
}

export interface NotificationContent {
  [key: string]: unknown;
}

export interface LeaderboardMetadata {
  [key: string]: unknown;
}

export interface WalletUpdateMetadata {
  [key: string]: unknown;
}

export interface MatchParams {
  [key: string]: unknown;
}

export interface BeforeAfterData {
  [key: string]: unknown;
}

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

export interface StreamUserListResult {
  userId: string;
  presence: unknown;
}

export interface MatchResult {
  success: boolean;
  [key: string]: unknown;
}

export type CacheValueType = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | Record<string, unknown>
  | unknown[];

export interface RpcResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}
