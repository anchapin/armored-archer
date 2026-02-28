# Cache Strategy

This document outlines the caching strategy for the Armored Archer backend server.

## Overview

The Armored Archer backend uses an in-memory LRU (Least Recently Used) cache to improve performance by reducing database and storage operations for frequently accessed data. The cache implementation uses the `lru-cache` package.

## Architecture

### Cache Library
- **Package**: `lru-cache` v11.x
- **Type**: In-memory LRU cache
- **Location**: `backend/src/utils/cache.ts`

### Cache Manager

The `CacheManager` class provides a centralized interface for managing multiple caches:
- Create caches with configurable size and TTL
- Get/Set/Delete operations
- Cache hit/miss metrics
- Cache information (size, max capacity, TTL)

## Cached Data Types

### 1. Player Stats
- **Cache Name**: `player_stats`
- **Max Entries**: 500
- **TTL**: 60 seconds (SHORT)
- **Cache Key**: User ID
- **Invalidation**: On stat changes (gain XP, allocate stats)

**Rationale**: Player stats are frequently read on every request but change relatively rarely. Short TTL ensures fresh data while reducing database load.

### 2. Leaderboards
- **Cache Name**: `leaderboards`
- **Max Entries**: 100
- **TTL**: 60 seconds (SHORT)
- **Cache Key**: `season_id:limit`
- **Invalidation**: On rank updates (clears entire leaderboard cache)

**Rationale**: Leaderboards are read frequently but change frequently as matches complete. Short TTL ensures near real-time data while reducing API calls.

### 3. Season Info
- **Cache Name**: `season_info`
- **Max Entries**: 100
- **TTL**: 5 minutes (MEDIUM)
- **Cache Key**: `season_{season_id}`
- **Invalidation**: TTL-based

**Rationale**: Season information changes infrequently (only when season ends). Medium TTL provides good performance while allowing for season transitions.

### 4. Store Catalog
- **Cache Name**: `store_catalog`
- **Max Entries**: 100
- **TTL**: 30 minutes (LONG)
- **Cache Key**: `gem_bundles`
- **Invalidation**: TTL-based (or manual on catalog updates)

**Rationale**: Store catalog (gem bundles) rarely changes and is read frequently. Long TTL is appropriate for this static data.

### 5. Gear Definitions
- **Cache Name**: `gear_definitions`
- **Max Entries**: 100
- **TTL**: 30 minutes (LONG)
- **Cache Key**: `all`
- **Invalidation**: TTL-based (or manual on definition updates)

**Rationale**: Gear definitions (rarities, types, stats, modifiers) are game configuration data that rarely changes. Long TTL is appropriate.

## Cache Configuration

```typescript
const TTL = {
  SHORT: 60 * 1000,        // 1 minute
  MEDIUM: 5 * 60 * 1000,  // 5 minutes
  LONG: 30 * 60 * 1000    // 30 minutes
};

const CACHE_SIZES = {
  SMALL: 100,
  MEDIUM: 500,
  LARGE: 1000
};
```

## Cache Invalidation Strategies

### Time-Based Invalidation (TTL)
All caches use TTL-based expiration. After TTL expires, items are automatically removed from the cache.

### Event-Based Invalidation
Specific caches are invalidated on data changes:
- **Player Stats**: Invalidated when stats are updated (gain XP, allocate stats)
- **Leaderboards**: Cleared entirely when any rank is updated

### Manual Invalidation
Cache can be manually cleared using:
```typescript
cacheManager.clear("cache_name");
```

## Cache Metrics

The cache manager tracks hit/miss metrics for each cache:

```typescript
interface CacheMetrics {
  hits: number;
  misses: number;
}
```

Metrics can be retrieved:
```typescript
// Get metrics for a specific cache
const metrics = cacheManager.getMetrics("player_stats");

// Get all metrics
const allMetrics = cacheManager.getAllMetrics();
```

## Cache Key Strategy

Cache keys follow these patterns:

| Data Type | Key Pattern | Example |
|-----------|-------------|---------|
| Player Stats | `{userId}` | `user_12345` |
| Leaderboards | `{season_id}:{limit}` | `season_1:50` |
| Season Info | `season_{season_id}` | `season_1` |
| Store Catalog | `{catalog_type}` | `gem_bundles` |
| Gear Definitions | `{data_type}` | `all` |

## Usage Examples

### Reading with Cache
```typescript
const cacheManager = getCacheManager(logger);
const cachedData = cacheManager.get<string>("player_stats", userId);

if (cachedData !== undefined) {
  return cachedData;
}

const data = nk.storageRead([...]);
cacheManager.set("player_stats", userId, data);
return data;
```

### Writing with Cache Invalidation
```typescript
nk.storageWrite([...]);
const cacheManager = getCacheManager(logger);
cacheManager.delete("player_stats", userId);
```

### Getting Cached Static Data
```typescript
const cacheManager = getCacheManager(logger);
const catalog = cacheManager.get<Record<string, GemBundle>>("store_catalog", "gem_bundles");

if (catalog !== undefined) {
  return catalog;
}

cacheManager.set("store_catalog", "gem_bundles", GEM_BUNDLES);
return GEM_BUNDLES;
```

## Performance Impact

### Expected Improvements
- **Reduced database load**: 60-80% reduction in storage reads for cached data
- **Faster API responses**: 50-90% latency reduction for cached endpoints
- **Improved scalability**: Less database contention allows for higher concurrent users

### Monitoring Recommendations
1. Monitor cache hit ratios
2. Alert on low hit ratios (< 70%)
3. Track cache memory usage
4. Monitor TTL effectiveness (eviction rates)

## Future Enhancements

### Potential Improvements
1. **Distributed Cache**: Consider Redis for multi-server deployments
2. **Cache Warming**: Pre-populate caches on server startup
3. **Selective Invalidation**: Invalidate specific leaderboard entries instead of entire cache
4. **Cache Compression**: Compress large cache entries to save memory
5. **Metrics Integration**: Integrate with monitoring system for alerting

### When to Consider Redis
- Multiple server instances requiring shared cache
- Need for larger cache capacity than in-memory allows
- Require cache persistence across server restarts
- Need for more advanced cache features (pub/sub, transactions)

## Security Considerations

1. **No Sensitive Data**: Never cache sensitive information (passwords, tokens)
2. **User Data Isolation**: Ensure user-specific keys cannot be guessed
3. **Cache Poisoning Protection**: Validate data before caching
4. **Rate Limiting**: Consider rate limits to prevent cache flooding

## Testing

### Cache Behavior Tests
- Verify cache hits return cached data
- Verify cache misses fetch from source
- Verify TTL expiration
- Verify LRU eviction when cache is full
- Verify invalidation on writes

### Metrics Tests
- Verify hit/miss counters increment correctly
- Verify metrics can be retrieved accurately

## Maintenance

### Regular Tasks
1. Review cache hit ratios monthly
2. Adjust TTL values based on data freshness requirements
3. Adjust cache sizes based on memory usage and patterns
4. Review cache key strategies for optimization

### Troubleshooting
- **Low hit ratio**: May indicate TTL is too short or cache is too small
- **High memory usage**: May need to reduce cache sizes or increase memory
- **Stale data**: May need to reduce TTL or improve invalidation logic
