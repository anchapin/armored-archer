# Feature Flag Infrastructure

This document describes the feature flag infrastructure implemented in Armored Archer for progressive rollouts, A/B testing, and quick rollbacks.

## Overview

The feature flag system enables:
- **Gradual rollouts**: Release features to a percentage of users first
- **A/B testing**: Compare feature performance across different user groups
- **Quick rollbacks**: Disable features instantly without deploying new code
- **Canary deployments**: Test with specific users or game versions before wider release

## Implementation

The feature flag system is implemented in `backend/src/modules/progressive_rollout.ts`.

### Core Components

#### Feature Flags

A feature flag contains:
- `name`: Unique identifier for the feature
- `description`: Human-readable description
- `enabled`: Whether the flag is active
- `rolloutPhase`: Current rollout phase
- `rolloutPercentage`: 0-100 percentage for gradual rollout
- `canaryUserIds`: Specific users for canary testing
- `canaryVersionMin/Max`: Game version range for canary
- `phases`: Array of rollout phase configurations
- `currentPhaseIndex`: Index of the current phase

#### Rollout Phases

The system supports four phases:
1. **disabled**: Feature is completely off
2. **canary**: Feature is available to specific users or version range
3. **gradual**: Feature is available to a percentage of users
4. **full**: Feature is available to all users

### Usage

#### Checking if a Feature is Enabled

```typescript
import { isFeatureEnabled } from '../modules/progressive_rollout';

// Check for a specific user
const enabled = isFeatureEnabled('new_combat_system', 'user123');

// Check with game version
const enabled = isFeatureEnabled('new_matchmaking', 'user456', '1.2.0');
```

#### Creating a New Feature Flag

```typescript
import { createFeatureFlag } from '../modules/progressive_rollout';

const flag = createFeatureFlag('new_feature', 'Description of the feature', [
  {
    phase: 'canary',
    percentage: 5,
    durationMinutes: 60,
    minHealthPercent: 95,
    maxErrorRatePercent: 2,
    maxLatencyMs: 100,
    sampleSize: 100,
    autoPromote: false,
    rollbackCriteria: {
      errorRateThreshold: 5,
      latencyThreshold: 250,
      healthCheckFails: 3,
    },
  },
  {
    phase: 'gradual',
    percentage: 25,
    durationMinutes: 120,
    minHealthPercent: 95,
    maxErrorRatePercent: 1,
    maxLatencyMs: 100,
    sampleSize: 500,
    autoPromote: false,
    rollbackCriteria: {
      errorRateThreshold: 3,
      latencyThreshold: 200,
      healthCheckFails: 2,
    },
  },
  {
    phase: 'full',
    percentage: 100,
    durationMinutes: 0,
    minHealthPercent: 99,
    maxErrorRatePercent: 0.5,
    maxLatencyMs: 100,
    sampleSize: 0,
    autoPromote: false,
    rollbackCriteria: {
      errorRateThreshold: 1,
      latencyThreshold: 100,
      healthCheckFails: 1,
    },
  },
]);
```

#### Updating a Feature Flag

```typescript
import { updateFeatureFlag } from '../modules/progressive_rollout';

const updated = updateFeatureFlag('new_feature', {
  rolloutPhase: 'canary',
  rolloutPercentage: 10,
});
```

#### Advancing Rollout Phase

```typescript
import { advancePhase } from '../modules/progressive_rollout';

const advanced = advancePhase('new_feature');
```

#### Rolling Back

```typescript
import { rollbackFeature } from '../modules/progressive_rollout';

const rolledBack = rollbackFeature('new_feature');
```

### RPC Endpoints

The following RPCs are available for runtime management:

| RPC | Description |
|-----|-------------|
| `armored_archer/rollout_create_flag` | Create a new feature flag |
| `armored_archer/rollout_update_flag` | Update an existing flag |
| `armored_archer/rollout_list_flags` | List all feature flags |
| `armored_archer/rollout_check` | Check if a feature is enabled for a user |
| `armored_archer/rollout_advance` | Advance to the next rollout phase |
| `armored_archer/rollout_rollback` | Rollback to the previous phase |
| `armored_archer/rollout_metrics` | Get rollout metrics for a feature |
| `armored_archer/rollout_record_metrics` | Record metrics for a feature |
| `armored_archer/rollout_health` | Get overall rollout health status |
| `armored_archer/rollout_prometheus_metrics` | Get metrics in Prometheus format |

### Metrics

The system exposes Prometheus metrics for monitoring:

- `armored_archer_rollout_phase`: Current rollout phase
- `armored_archer_rollout_percentage`: Current rollout percentage
- `armored_archer_rollout_users_total`: Total users exposed
- `armored_archer_rollout_errors_total`: Total errors during rollout
- `armored_archer_rollout_latency_ms`: Latency histogram
- `armored_archer_rollout_health`: Health status (1=healthy, 0=unhealthy)
- `armored_archer_feature_flag_enabled`: Whether flag is enabled

### Rollback Criteria

Each phase can define rollback criteria:
- `errorRateThreshold`: Maximum error rate % before rollback
- `latencyThreshold`: Maximum latency ms before rollback
- `healthCheckFails`: Number of health check failures before rollback
- `customMetrics`: Custom metric thresholds

## Process for Creating and Managing Feature Flags

### Creating a New Feature Flag

1. Define the rollout phases in code
2. Use `createFeatureFlag()` to create the flag
3. Configure canary users or version ranges if needed
4. Register RPC endpoints via `registerProgressiveRollout()`

### Managing Rollouts

1. Start in `disabled` phase
2. Advance to `canary` phase with specific test users
3. Monitor metrics and rollback criteria
4. Advance to `gradual` phase with increasing percentages
5. Finally advance to `full` phase

### Cleaning Up Feature Flags

When a feature is fully rolled out:
1. Keep the flag in `full` phase for tracking
2. Optionally disable the flag after a cooldown period
3. Remove related code once the flag is no longer needed

## Best Practices

1. **Start small**: Begin with canary phase using internal users or a small percentage
2. **Monitor closely**: Watch metrics during each phase
3. **Set clear criteria**: Define rollback thresholds before starting
4. **Document changes**: Note why a flag was created and when it can be cleaned up
5. **Use descriptive names**: Name flags to indicate what feature they control
6. **Version awareness**: Consider game version compatibility in canary phase

## Example Workflow

```
Week 1: Create flag, test in canary with internal users
Week 2: Roll out to 5% of players, monitor metrics
Week 3: Increase to 25%, continue monitoring
Week 4: Increase to 50%, prepare for full rollout
Week 5: Full rollout to 100%
Week 6+: Monitor, then clean up flag after cooldown
```

## Testing

Run the feature flag tests:

```bash
cd backend
npm test -- progressive_rollout
```

## Related Documentation

- [Progressive Rollout Module](../src/modules/progressive_rollout.ts)
- [Progressive Rollout Tests](../src/modules/__tests__/progressive_rollout.test.ts)
- [Monitoring](./MONITORING.md)
