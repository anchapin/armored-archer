# N+1 Query Detection

This document describes the N+1 query detection capabilities implemented in the armored-archer backend project.

## Overview

The N+1 query problem is a common performance anti-pattern where an application makes one database query to retrieve N records, and then makes N additional queries to process each record. This can severely impact performance, especially with large datasets.

## Detection Methods

### 1. Standalone Detection Script

A TypeScript-based static analysis script that scans the codebase for potential N+1 query patterns.

**Location:** `scripts/detect-n-plus-one.ts`

**Usage:**

```bash
# Run locally
npm run detect-n-plus-one

# Run in CI mode (exits with error if issues found)
npm run detect-n-plus-one:ci
```

**Detection Rules:**

1. **Query inside loop:** Detects database operations (find, findOne, findAll, insert, update, delete, etc.) within:
   - `for` loops
   - `while` loops
   - `forEach` iterations
   - `map` operations
   - `filter` operations

2. **Array iteration followed by query:** Detects patterns where an array is iterated and each element is used to query.

3. **Missing batch operation:** Identifies multiple sequential queries that could be batched.

**Configuration:**

The script uses the following default settings:
- Source directory: `src/`
- Excluded directories: `node_modules`, `build`, `.git`, `dist`

### 2. ESLint Custom Rule

A custom ESLint rule that provides real-time feedback during development.

**Location:** `src/utils/eslint-rules/n-plus-one-detection.ts`

**Integration:**

To use the ESLint rule in your configuration, add it to `.eslintrc.js`:

```javascript
const nPlusOneDetection = require('./src/utils/eslint-rules/n-plus-one-detection');

module.exports = {
  // ... other config
  plugins: ['@typescript-eslint'],
  rules: {
    // ... other rules
    'n-plus-one-detection/n-plus-one': 'warn', // Enable the rule
  },
};
```

**Rule Options:**

```javascript
'n-plus-one-detection/n-plus-one': [
  'warn',
  {
    allowedMethods: ['customDbMethod'], // Add custom DB methods
    maxLoopDepth: 2, // Maximum loop nesting to check
  }
]
```

## CI/CD Integration

N+1 query detection is integrated into the CI pipeline via the `n-plus-one-detection` job in `.github/workflows/ci.yml`.

**Job Configuration:**

```yaml
n-plus-one-detection:
  name: N+1 Query Detection
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Install dependencies
      working-directory: ./backend
      run: npm ci
    - name: Run N+1 query detection
      working-directory: ./backend
      run: npm run detect-n-plus-one:ci
```

## Addressing Detected Issues

When N+1 issues are detected, consider the following solutions:

### 1. Batch Operations

Instead of querying in a loop:

```typescript
// ❌ N+1 anti-pattern
for (const userId of userIds) {
  const user = await db.users.findOne({ id: userId });
  // process user
}

// ✅ Batch query
const users = await db.users.find({ id: { $in: userIds } });
```

### 2. Eager Loading

Load related data in a single query:

```typescript
// ❌ N+1 anti-pattern
const orders = await db.orders.findAll();
for (const order of orders) {
  const customer = await db.customers.findOne({ id: order.customerId });
}

// ✅ Eager loading
const orders = await db.orders.findAll({
  include: [{ model: 'customer' }]
});
```

### 3. JOIN Queries

Combine multiple queries into a single JOIN:

```typescript
// ❌ N+1 anti-pattern
const products = await db.products.findAll();
for (const product of products) {
  const reviews = await db.reviews.find({ productId: product.id });
}

// ✅ JOIN query
const products = await db.query(`
  SELECT p.*, r.* 
  FROM products p 
  LEFT JOIN reviews r ON p.id = r.productId
`);
```

### 4. Caching

Cache frequently accessed data:

```typescript
// Use in-memory cache or Redis
const cache = new Map();
for (const userId of userIds) {
  let user = cache.get(userId);
  if (!user) {
    user = await db.users.findOne({ id: userId });
    cache.set(userId, user);
  }
}
```

## Best Practices

1. **Run detection regularly:** Use the script during development and in CI
2. **Review flagged code:** Not all detections are actual N+1 issues - review each case
3. **Prioritize high-traffic endpoints:** Focus on frequently called functions first
4. **Use batch operations:** Design database access patterns to minimize queries
5. **Monitor in production:** Use query logging to identify actual N+1 patterns

## References

- [N+1 Problem Wikipedia](https://en.wikipedia.org/wiki/N%2B1_problem)
- [Database Optimization Best Practices](https://www.example.com/db-optimization)

---

## Runtime N+1 Query Detection (New)

This section describes the runtime detection capabilities added to the backend.

### Overview

The runtime N+1 query detection system provides real-time monitoring of database queries during execution. Unlike static analysis, this system can detect actual N+1 patterns at runtime and provide detailed metrics.

### Configuration

The system is configured in `src/config/index.ts`:

```typescript
nPlusOne: {
  enabled: process.env.N_PLUS_ONE_ENABLED === 'true',
  threshold: parseInt(process.env.N_PLUS_ONE_THRESHOLD || '3', 10),
  logEnabled: process.env.N_PLUS_ONE_LOG_ENABLED === 'true',
  metricsEnabled: process.env.N_PLUS_ONE_METRICS_ENABLED === 'true',
  slowQueryThresholdMs: parseInt(process.env.N_PLUS_ONE_SLOW_QUERY_MS || '100', 10),
  autoTrackStorage: process.env.N_PLUS_ONE_AUTO_TRACK_STORAGE !== 'false',
}
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `N_PLUS_ONE_ENABLED` | Enable runtime N+1 detection | `true` |
| `N_PLUS_ONE_THRESHOLD` | Number of queries to trigger N+1 warning | `3` |
| `N_PLUS_ONE_LOG_ENABLED` | Enable logging of N+1 detections | `false` |
| `N_PLUS_ONE_METRICS_ENABLED` | Expose metrics via Prometheus | `false` |
| `N_PLUS_ONE_SLOW_QUERY_MS` | Slow query threshold in milliseconds | `100` |
| `N_PLUS_ONE_AUTO_TRACK_STORAGE` | Auto-track Nakama storage operations | `true` |

### Usage

#### 1. Manual Query Tracking

```typescript
import { trackQuery, startOperationTracking, stopOperationTracking } from './modules/n_plus_one_detection';

// Track a synchronous query
const result = trackQuery('get_player_items', 'storage', () => {
  return nk.storageRead(ctx, { collection: 'items' });
});

// Track an async query
const asyncResult = await trackQueryAsync('fetch_leaderboard', 'leaderboard', async () => {
  return await nk.leaderboardRecordsFetch(ctx, 'global', userIds);
});
```

#### 2. Operation-Level Tracking

```typescript
import { startOperationTracking, stopOperationTracking, trackQuery } from './modules/n_plus_one_detection';

function getPlayersWithInventory(playerIds: string[]): Player[] {
  // Start tracking an operation
  startOperationTracking('get_players_with_inventory');

  const players = nk.usersGetId(playerIds);

  // Each inventory query is tracked
  for (const player of players) {
    const inventory = trackQuery(
      'get_players_with_inventory',
      'storage',
      () => nk.storageRead(ctx, { collection: 'inventory', key: player.id })
    );
    player.inventory = inventory;
  }

  // Stop tracking and get the result
  const result = stopOperationTracking('get_players_with_inventory');
  
  if (result.nPlusOneDetected) {
    logger.warn('N+1 detected in get_players_with_inventory', { 
      queryCount: result.queryCount,
      warnings: result.warnings 
    });
  }

  return players;
}
```

#### 3. Wrapper Functions

```typescript
import { withNPlusOneTracking, withNPlusOneTrackingAsync } from './modules/n_plus_one_detection';

// Wrap any function with automatic tracking
const result = withNPlusOneTracking('process_matches', () => {
  // All queries inside will be tracked under 'process_matches'
  for (const matchId of matchIds) {
    trackQuery('process_matches', 'storage', () => ...);
  }
  return processed;
});

// Async version
const asyncResult = await withNPlusOneTrackingAsync('async_operation', async () => {
  // ...
});
```

### Metrics

When `N_PLUS_ONE_METRICS_ENABLED=true`, the following Prometheus metrics are exposed:

- `armored_archer_n_plus_one_operations_total` - Total N+1 operations detected
- `armored_archer_n_plus_one_queries_total` - Total queries tracked
- `armored_archer_n_plus_one_query_duration_seconds` - Query duration histogram
- `armored_archer_n_plus_one_active_operations` - Currently active tracked operations

### RPC Endpoints

- `armored_archer/n_plus_one_report` - Returns a JSON report of all tracked operations

### Best Practices

1. **Use operation tracking for complex functions**: Wrap functions that iterate over multiple entities
2. **Set appropriate thresholds**: Default threshold of 3 works for most cases, adjust based on your use case
3. **Enable in development**: Use `N_PLUS_ONE_LOG_ENABLED=true` during development to catch issues early
4. **Monitor in staging**: Enable metrics in staging to identify patterns before production
5. **Use the report endpoint**: Regularly check the N+1 report to identify problematic patterns
