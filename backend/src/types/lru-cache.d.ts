declare module 'lru-cache' {
  import { LRUCache as LRUCacheType } from 'lru-cache';
  export const LRUCache: typeof LRUCacheType;
}
