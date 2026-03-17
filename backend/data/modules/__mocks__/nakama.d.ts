import { Runtime } from '../types/nakama';
export declare const createMockLogger: () => Runtime.Logger;
export declare const createMockContext: (overrides?: Partial<Runtime.Context>) => Runtime.Context;
export interface MockStorageObject {
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
export declare const createMockNakama: () => Runtime.Nakama;
