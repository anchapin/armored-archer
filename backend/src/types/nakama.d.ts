declare namespace Runtime {
  export interface Context {
    userId: string;
    username: string;
    variables: { [key: string]: string };
    env: { [key: string]: string };
    sessionExpiry: number;
  }

  export interface Logger {
    info(format: string, ...args: any[]): void;
    warn(format: string, ...args: any[]): void;
    error(format: string, ...args: any[]): void;
    debug(format: string, ...args: any[]): void;
  }

  export interface StorageRead {
    collection: string;
    key: string;
    userId: string;
  }

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

  export interface StorageWrite {
    collection: string;
    key: string;
    userId: string;
    value: string;
    version?: string;
    permissionRead?: number;
    permissionWrite?: number;
  }

  export interface Nakama {
    storageRead(objects: StorageRead[]): StorageObject[];
    storageWrite(objects: StorageWrite[]): void;
    storageList(userId: string, collection: string, limit: number, cursor: string, filter: string): StorageObject[];
    walletUpdate(userId: string, changes: { [key: string]: number }): void;
    walletLedgerUpdate(userId: string, id: string, metadata: { [key: string]: string }): void;
    leaderboardCreate(id: string, authoritative: boolean, sortOrder: string, operator: string, reset: string, metadata: { [key: string]: string }): void;
    leaderboardDelete(id: string): void;
    leaderboardRecordList(leaderboardId: string, ownerIds: string[], limit: number, cursor: string, expiry: number): any;
    leaderboardRecordWrite(leaderboardId: string, owner: string, username: string, score: number, subScore: number, metadata: { [key: string]: string }): void;
    notificationSend(userId: string, subject: string, content: { [key: string]: any }, code: number, persist: boolean, senderId: string): void;
    httpRequest(method: string, url: string, headers: { [key: string]: string }, body: string): { code: number, body: string, headers: { [key: string]: string } };
    uuidGenerateV4(): string;
    userIdGetFromUsername(username: string): string;
    streamUserJoin(stream: Stream, presences: Presence[]): void;
    streamUserLeave(stream: Stream, presences: Presence[]): void;
    streamUserKick(stream: Stream, presences: Presence[]): void;
    streamUserList(userId: string, stream: Stream, limit: number, state: string, cursor: string): any;
    streamCount(stream: Stream): number;
  }

  export interface Initializer {
    registerRpc(id: string, fn: (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string): void;
    registerMatch(name: string, fn: (ctx: Context, logger: Logger, nk: Nakama, params: any) => any): void;
    registerBefore(fn: (ctx: Context, logger: Logger, nk: Nakama, data: any) => any): void;
    registerAfter(fn: (ctx: Context, logger: Logger, nk: Nakama, data: any) => any): void;
  }

  export type InitModule = (ctx: Context, logger: Logger, nk: Nakama, initializer: Initializer) => void;

  export interface Stream {
    mode: number;
    subject: string;
    label: string;
    subcontext: string;
  }

  export interface Presence {
    userId: string;
    sessionId: string;
    node: string;
    username: string;
    status: string;
  }
}

export { InitModule, Runtime };
