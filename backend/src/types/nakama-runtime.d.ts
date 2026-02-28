declare namespace Runtime {
  interface Context {
    userId: string;
    username: string;
    expiry: number;
    vars: { [key: string]: string };
  }

  interface Logger {
    info(format: string, ...args: any[]): void;
    error(format: string, ...args: any[]): void;
    warn(format: string, ...args: any[]): void;
    debug(format: string, ...args: any[]): void;
  }

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

  interface StorageWrite {
    collection: string;
    key: string;
    userId: string;
    value: string;
    version?: string;
  }

  interface WalletUpdate {
    userId: string;
    updates: { [key: string]: number };
    metadata?: { [key: string]: any };
  }

  interface Nakama {
    storageRead(requests: StorageRead[]): StorageRead[];
    storageWrite(requests: StorageWrite[]): StorageWrite[];
    walletUpdate(userId: string, updates: { [key: string]: number }, metadata?: { [key: string]: any }): void;
  }

  interface RpcRegistration {
    id: string;
    func: (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string;
  }

  interface Initializer {
    registerRpc(id: string, func: (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string): void;
  }
}

export { Runtime };
