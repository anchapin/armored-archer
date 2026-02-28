# Database Query Optimization

This document describes the database optimization strategies implemented in the Armored Archer backend to improve performance and scalability.

## Overview

The Nakama storage layer is used for persisting player data, matches, inventory, and other game state. As the player base grows, optimizing database queries becomes critical for maintaining responsive API performance and controlling infrastructure costs.

## Optimization Strategies

### 1. Batch Storage Reads

Instead of making multiple individual `storageRead` calls, we batch reads together to reduce round trips to the database.

**Before:**
```typescript
const stats1 = nk.storageRead([{ collection: 'player_stats', key: user1 }]);
const stats2 = nk.storageRead([{ collection: 'player_stats', key: user2 }]);
```

**After:**
```typescript
const stats = nk.storageRead([
  { collection: 'player_stats', key: user1 },
  { collection: 'player_stats', key: user2 }
]);
```

**Implementation:**
- Created `batchGetPlayerStats()` utility in `backend/src/utils/db_optimizer.ts`
- Used in `combat_system.ts` to fetch both creator and opponent stats in one call
- Used in `season_system.ts` to fetch winner and loser stats in one call

### 2. Caching Layer

Frequently accessed data is cached using an LRU (Least Recently Used) cache to reduce database load.

**Cache Configuration:**
- `player_stats`: Medium size (500 items), short TTL (60s)
- `player_currency`: Medium size (500 items), short TTL (60s)
- `leaderboards`: Small size (100 items), short TTL (60s)
- `season_info`: Small size (100 items), medium TTL (5min)
- `store_catalog`: Small size (100 items), long TTL (30min)
- `gear_definitions`: Small size (100 items), long TTL (30min)

**Implementation:**
- Created `getPlayerStatsWithCache()` utility for cached stats reads
- Created `getPlayerCurrencyWithCache()` for cached currency reads
- Cache invalidation happens on writes (e.g., `invalidatePlayerStatsCache()`)

### 3. Storage List Limits

All `storageList` operations now include explicit limits to prevent fetching excessive data.

**Example:**
```typescript
const matches = nk.storageList(
  ctx.userId,
  "pvp_matches",
  20, // Explicit limit
  "",
  ""
);
```

**Locations:**
- `matchmaker.ts`: `rpcListMatches()` limits to 20 matches (configurable via payload)

### 4. Optimized Read Patterns

Reduced redundant reads by:
- Reusing cached data across function calls
- Batch reading related data together
- Eliminating duplicate storage read operations

**Optimizations Made:**
- `combat_system.ts`: Removed separate `getPlayerStats()` function, now uses `batchGetPlayerStats()`
- `season_system.ts`: Updated `getPlayerStats()` to use cached version
- `matchmaker.ts`: All player stats reads now use `getPlayerStatsWithCache()`
- `store.ts`: Added currency caching with `getPlayerCurrencyWithCache()`

### 5. Query Performance Metrics

Query performance is tracked through the cache manager metrics.

**Available Metrics:**
```typescript
const cacheManager = getCacheManager(logger);
const metrics = cacheManager.getAllMetrics();
// Returns: { player_stats: { hits: 1000, misses: 50 }, ... }
```

**Cache Information:**
```typescript
const info = cacheManager.getCacheInfo("player_stats");
// Returns: { size: 50, max: 500, ttl: 60000 }
```

## Database Collections

### player_stats
**Purpose:** Player level, XP, ability points, and combat stats  
**Access Pattern:** Very frequent (every combat action)  
**Optimization:** Cached, short TTL (60s), medium cache size (500)

### player_currency
**Purpose:** Player gems and gold balance  
**Access Pattern:** Frequent (purchases, spending)  
**Optimization:** Cached, short TTL (60s), medium cache size (500)

### player_inventory
**Purpose:** Player gear items and equipped slots  
**Access Pattern:** Moderate (inventory view, gear generation)  
**Optimization:** Not cached (changed frequently, less accessed)

### pvp_matches
**Purpose:** PvP match metadata and state  
**Access Pattern:** Moderate (match listing, match state)  
**Optimization:** List with limits, match states not cached

### pvp_match_states
**Purpose:** In-memory combat state (turns, health, log)  
**Access Pattern:** Active matches only  
**Optimization:** Not cached (transient data, active for short duration)

### season_rewards_claimed
**Purpose:** Track claimed season rewards  
**Access Pattern:** Rare (season end only)  
**Optimization:** Not cached (low frequency access)

## Performance Impact

### Expected Improvements
- **Reduced database load:** 30-50% reduction in storage read operations
- **Faster response times:** 10-20ms reduction for cached reads
- **Lower infrastructure costs:** Reduced database I/O and CPU usage
- **Better scalability:** System can handle more concurrent users

### Monitoring
Monitor these metrics to assess optimization effectiveness:
1. Cache hit rate: Target > 80% for player_stats
2. Average response time for API endpoints
3. Database read operations per second
4. Database CPU and memory usage

## Usage Examples

### Batch Reading Player Stats
```typescript
import { batchGetPlayerStats } from "../utils/db_optimizer";

const statsMap = batchGetPlayerStats(nk, [user1, user2], logger);
const user1Stats = statsMap.get(user1);
const user2Stats = statsMap.get(user2);
```

### Reading Player Stats with Cache
```typescript
import { getPlayerStatsWithCache } from "../utils/db_optimizer";

const stats = getPlayerStatsWithCache(nk, userId, logger);
```

### Invalidating Cache on Write
```typescript
import { invalidatePlayerStatsCache } from "../utils/db_optimizer";

nk.storageWrite([{ collection: "player_stats", key: userId, ... }]);
invalidatePlayerStatsCache(userId, logger);
```

## Future Optimizations

### Potential Improvements
1. **Read-Through Caching:** Auto-populate cache on miss
2. **Write-Through Caching:** Write to cache and storage simultaneously
3. **Distributed Cache:** Share cache across multiple Nakama instances
4. **Query Indexing:** Use Nakama's storage object indexing (when available)
5. **Lazy Loading:** Load large inventories in chunks
6. **Compression:** Compress large cached objects (gear inventories)

### Indexing Considerations
Nakama's storage layer is optimized for key-value lookups by `(collection, key, userId)`. For complex queries:
- Use leaderboards for rankings
- Use `storageList` with filters for user-specific queries
- Consider application-side filtering for complex multi-criteria queries

## Conclusion

These optimizations provide a solid foundation for scaling the Armored Archer backend. As the player base grows, continue monitoring performance metrics and adjust cache TTLs and sizes as needed.

For more information, see:
- Nakama Storage API: https://heroiclabs.com/docs/nakama/getting-started/concepts/storage/
- LRU Cache Library: https://github.com/isaacs/node-lru-cache
