import { MatchParams, MatchResult, BeforeAfterData, LeaderboardRecord, StreamUserListResult } from "./shared";

declare namespace Runtime {
  /**
   * Runtime context interface (extended version).
   * 
   * @property userId - ID of the user
   * @property username - Display name of the user
   * @property variables - User variables
   * @property env - Environment variables
   * @property sessionExpiry - Session expiry time
   */
  export interface Context {
    userId: string;
    username: string;
    variables: { [key: string]: string };
    env: { [key: string]: string };
    sessionExpiry: number;
  }

  /**
   * Runtime logger interface.
   * 
   * @method info - Logs informational messages
   * @method warn - Logs warning messages
   * @method error - Logs error messages
   * @method debug - Logs debug messages
   */
  export interface Logger {
    info(format: string, ...args: unknown[]): void;
    warn(format: string, ...args: unknown[]): void;
    error(format: string, ...args: unknown[]): void;
    debug(format: string, ...args: unknown[]): void;
  }

  /**
   * Storage read request interface.
   * 
   * @property collection - Storage collection name
   * @property key - Storage key
   * @property userId - User ID for the storage
   */
  export interface StorageRead {
    collection: string;
    key: string;
    userId: string;
  }

  /**
   * Storage object interface.
   * 
   * @property collection - Storage collection name
   * @property key - Storage key
   * @property userId - User ID for the storage
   * @property value - Stored value
   * @property version - Storage version
   * @property permissionRead - Read permission level
   * @property permissionWrite - Write permission level
   * @property createTime - Creation timestamp
   * @property updateTime - Last update timestamp
   */
  export interface StorageObject {
    collection: string;
    key: string;
    userId: string;
    value: string;
    version: string;
    permissionRead: number;
    permissionWrite: number;
    createTime: number;
    updateTime: number;
  }

  /**
   * Storage write request interface.
   * 
   * @property collection - Storage collection name
   * @property key - Storage key
   * @property userId - User ID for the storage
   * @property value - Value to store
   * @property version - Optional version for optimistic concurrency
   * @property permissionRead - Optional read permission level
   * @property permissionWrite - Optional write permission level
   */
  export interface StorageWrite {
    collection: string;
    key: string;
    userId: string;
    value: string;
    version?: string;
    permissionRead?: number;
    permissionWrite?: number;
  }

  /**
   * Nakama server interface.
   * 
   * @method storageRead - Reads storage objects
   * @method storageWrite - Writes storage objects
   * @method storageList - Lists storage objects
   * @method walletUpdate - Updates user wallet
   * @method walletLedgerUpdate - Updates wallet ledger
   * @method leaderboardCreate - Creates a leaderboard
   * @method leaderboardDelete - Deletes a leaderboard
   * @method leaderboardRecordList - Lists leaderboard records
   * @method leaderboardRecordWrite - Writes a leaderboard record
   * @method notificationSend - Sends a notification
   * @method httpRequest - Makes an HTTP request
   * @method uuidGenerateV4 - Generates a UUID
   * @method userIdGetFromUsername - Gets user ID from username
   * @method streamUserJoin - Joins a stream
   * @method streamUserLeave - Leaves a stream
   * @method streamUserKick - Kicks from a stream
   * @method streamUserList - Lists stream users
   * @method streamCount - Counts stream users
   */
  export interface Nakama {
    storageRead(objects: StorageRead[]): StorageObject[];
    storageWrite(objects: StorageWrite[]): void;
    storageList(userId: string, collection: string, limit: number, cursor: string, filter: string): StorageObject[];
    walletUpdate(userId: string, changes: { [key: string]: number }): void;
    walletLedgerUpdate(userId: string, id: string, metadata: { [key: string]: string }): void;
    leaderboardCreate(id: string, authoritative: boolean, sortOrder: string, operator: string, reset: string, metadata: { [key: string]: string }): void;
    leaderboardDelete(id: string): void;
    leaderboardRecordList(leaderboardId: string, ownerIds: string[], limit: number, cursor: string, expiry: number): LeaderboardRecord[];
    leaderboardRecordWrite(leaderboardId: string, owner: string, username: string, score: number, subScore: number, metadata: { [key: string]: string }): void;
    notificationSend(userId: string, subject: string, content: Record<string, unknown>, code: number, persist: boolean, senderId: string): void;
    httpRequest(method: string, url: string, headers: { [key: string]: string }, body: string): { code: number, body: string, headers: { [key: string]: string } };
    uuidGenerateV4(): string;
    userIdGetFromUsername(username: string): string;
    streamUserJoin(stream: Stream, presences: Presence[]): void;
    streamUserLeave(stream: Stream, presences: Presence[]): void;
    streamUserKick(stream: Stream, presences: Presence[]): void;
    streamUserList(userId: string, stream: Stream, limit: number, state: string, cursor: string): StreamUserListResult[];
    streamCount(stream: Stream): number;
  }

  /**
   * Runtime initializer interface.
   * 
   * @method registerRpc - Registers an RPC function
   * @method registerMatch - Registers a match handler
   * @method registerBefore - Registers a before hook
   * @method registerAfter - Registers an after hook
   */
  export interface Initializer {
    registerRpc(id: string, fn: (ctx: Context, logger: Logger, nk: Nakama, payload: string) > string): void;
    registerMatch(name: string, fn: (ctx: Context, logger: Logger, nk: Nakama, params: MatchParams) > MatchResult): void;
    registerBefore(fn: (ctx: Context, logger: Logger, nk: Nakama, data: BeforeAfterData) > BeforeAfterData): void;
    registerAfter(fn: (ctx: Context, logger: Logger, nk: Nakama, data: BeforeAfterData) > BeforeAfterData): void;
  }

  /**
   * Module initialization function type.
   * 
   * @param ctx - Runtime context
   * @param logger - Runtime logger
   * @param nk - Nakama server interface
   * @param initializer - Runtime initializer
   */
  export type InitModule = (ctx: Context, logger: Logger, nk: Nakama, initializer: Initializer) > void;

  /**
   * Stream interface.
   * 
   * @property mode - Stream mode
   * @property subject - Stream subject
   * @property label - Stream label
   * @property subcontext - Stream subcontext
   */
  export interface Stream {
    mode: number;
    subject: string;
    label: string;
    subcontext: string;
  }

  /**
   * Presence interface.
   * 
   * @property userId - ID of the user
   * @property sessionId - Session ID
   * @property node - Node name
   * @property username - Display name
   * @property status - Status
   */
  export interface Presence {
    userId: string;
    sessionId: string;
    node: string;
    username: string;
    status: string;
  }
}

export { InitModule, Runtime };
