declare namespace Runtime {
  /**
   * Runtime context interface.
   * 
   * @property userId - ID of the user
   * @property username - Display name of the user
   * @property expiry - Session expiry time
   * @property vars - User variables
   */
  interface Context {
    userId: string;
    username: string;
    expiry: number;
    vars: { [key: string]: string };
  }

  /**
   * Runtime logger interface.
   * 
   * @method info - Logs informational messages
   * @method error - Logs error messages
   * @method warn - Logs warning messages
   * @method debug - Logs debug messages
   */
  interface Logger {
    info(format: string, ...args: unknown[]): void;
    error(format: string, ...args: unknown[]): void;
    warn(format: string, ...args: unknown[]): void;
    debug(format: string, ...args: unknown[]): void;
  }

  /**
   * Storage read request interface.
   * 
   * @property collection - Storage collection name
   * @property key - Storage key
   * @property userId - User ID for the storage
   * @property version - Optional version for optimistic concurrency
   * @property value - Optional value to store
   * @property permission_read - Read permission level
   * @property permission_write - Write permission level
   * @property create_time - Creation timestamp
   * @property update_time - Last update timestamp
   * @property read - Whether to read the value
   */
  interface StorageRead {
    collection: string;
    key: string;
    userId: string;
    version?: string;
    value?: string;
    permission_read?: number;
    permission_write?: number;
    create_time?: number;
    update_time?: number;
    read?: boolean;
  }

  /**
   * Storage write request interface.
   * 
   * @property collection - Storage collection name
   * @property key - Storage key
   * @property userId - User ID for the storage
   * @property value - Value to store
   * @property version - Optional version for optimistic concurrency
   */
  interface StorageWrite {
    collection: string;
    key: string;
    userId: string;
    value: string;
    version?: string;
  }

  /**
   * Wallet update interface.
   * 
   * @property userId - ID of the user to update
   * @property updates - Currency updates
   * @property metadata - Optional metadata
   */
  interface WalletUpdate {
    userId: string;
    updates: { [key: string]: number };
    metadata?: Record<string, unknown>;
  }

  /**
   * Nakama server interface.
   * 
   * @method storageRead - Reads storage objects
   * @method storageWrite - Writes storage objects
   * @method walletUpdate - Updates user wallet
   */
  interface Nakama {
    storageRead(requests: StorageRead[]): StorageRead[];
    storageWrite(requests: StorageWrite[]): StorageWrite[];
    walletUpdate(userId: string, updates: { [key: string]: number }, metadata?: Record<string, unknown>): void;
  }

  /**
   * RPC registration interface.
   * 
   * @property id - RPC identifier
   * @property func - RPC function
   */
  interface RpcRegistration {
    id: string;
    func: (ctx: Context, logger: Logger, nk: Nakama, payload: string) > string;
  }

  /**
   * Runtime initializer interface.
   * 
   * @method registerRpc - Registers an RPC function
   */
  interface Initializer {
    registerRpc(id: string, func: (ctx: Context, logger: Logger, nk: Nakama, payload: string) > string): void;
  }

  /**
   * Module initialization function type.
   * 
   * @param ctx - Runtime context
   * @param logger - Runtime logger
   * @param nk - Nakama server interface
   * @param initializer - Runtime initializer
   */
  type InitModule = (ctx: Runtime, logger: Runtime.Logger, nk: Runtime.Nakama, initializer: Runtime.Initializer) > void;
}

export { Runtime };
