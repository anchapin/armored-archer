# Deployment Documentation

## Overview

This document describes the automated deployment pipeline for the Armored Archer game server backend using Nakama and PostgreSQL.

## Deployment Architecture

The deployment uses a **Blue/Green deployment strategy** for production environments:

- Two identical environments run simultaneously: `blue` and `green`
- Traffic is switched between environments during deployments
- Immediate rollback is possible by switching traffic back
- Zero downtime deployments

## Environments

### Staging
- **Trigger**: Push to `develop` branch or manual trigger
- **URL**: https://staging.armored-archer.example.com
- **Purpose**: Testing new features before production
- **Database**: Separate staging database

### Production
- **Trigger**: Push to `main` branch or manual trigger with approval
- **URL**: https://api.armored-archer.example.com
- **Purpose**: Live production environment
- **Database**: Production PostgreSQL database

## Deployment Pipeline

### 1. Build Stage
```bash
# TypeScript compilation
npm run build

# Run tests
npm test
```

### 2. Database Migrations
```bash
# Run Nakama migrations
docker exec -it armored_archer_server /nakama/nakama migrate up
```

### 3. Build Docker Image
```bash
# Build environment-specific image
docker build -t armored-archer-<color>:latest .
```

### 4. Deploy New Version
```bash
# Start new container
docker-compose up -d armored-archer-<color>
```

### 5. Health Checks
```bash
# Check PostgreSQL
docker exec postgres pg_isready -U postgres -d nakama

# Check Nakama
curl https://<env-url>/health
```

### 6. Traffic Switch
```bash
# Update load balancer to point to new version
# (Implementation depends on your infrastructure)
```

### 7. Cleanup Old Version
```bash
# Stop old container after successful deployment
docker-compose stop armored-archer-<old-color>
```

## Manual Deployment

### Deploy to Staging
```bash
# Using GitHub Actions
gh workflow run cd.yml --ref develop

# Or manually via Docker
cd backend
docker-compose -f docker-compose.staging.yml up -d --build
```

### Deploy to Production
```bash
# Using GitHub Actions (requires approval)
gh workflow run cd.yml --ref main

# Or manually via Docker
cd backend
docker-compose up -d --build
```

## Rollback Procedure

### Automatic Rollback
The deployment pipeline automatically rolls back if:
- Health checks fail
- Application crashes on startup
- Smoke tests fail

### Manual Rollback
```bash
# Identify current active color
docker ps --filter "name=armored-archer-" --format "{{.Names}}"

# Switch traffic to previous color
# (Implementation depends on your infrastructure)

# Example: If blue is deployed, switch to green
# Update load balancer configuration
```

## Monitoring

### Health Endpoints
- **Backend Health**: `https://api.armored-archer.example.com/health`
- **Nakama Console**: `https://api.armored-archer.example.com:7351`

### Logs
```bash
# View Nakama logs
docker logs -f armored-archer-<color>

# View PostgreSQL logs
docker logs -f postgres
```

## Feature Flags

Gradual rollouts can be implemented using feature flags:

```typescript
// Example feature flag check
const isFeatureEnabled = await nk.storageRead([{
  collection: "feature_flags",
  key: "new_feature",
  userId: "system"
}]);

if (isFeatureEnabled.length > 0 && isFeatureEnabled[0].value.enabled) {
  // Enable new feature
}
```

## Progressive Rollout

The system includes a complete progressive rollout mechanism for safe feature releases:

### Overview

The progressive rollout system provides:
- **Percentage-based gradual rollout**: Features are released to a configurable percentage of users
- **Feature flags for canary deployments**: Specific users or version ranges can be targeted
- **Phased rollout**: Features progress through phases: disabled → canary → gradual → full
- **Rollback criteria**: Configurable thresholds for error rate, latency, and health checks
- **Monitoring**: Prometheus metrics for each rollout phase

### Rollout Phases

| Phase | Description | Percentage | Use Case |
|-------|-------------|------------|----------|
| disabled | Feature is off | 0% | Initial state |
| canary | Specific users/versions | 5-10% | Initial testing |
| gradual | Percentage of all users | 25-50% | Broader testing |
| full | All users | 100% | Full release |

### Rollout RPC Endpoints

The following RPC endpoints are available for managing progressive rollouts:

| Endpoint | Description |
|----------|-------------|
| `armored_archer/rollout_create_flag` | Create a new feature flag |
| `armored_archer/rollout_update_flag` | Update feature flag settings |
| `armored_archer/rollout_check` | Check if feature is enabled for user |
| `armored_archer/rollout_advance` | Advance to next rollout phase |
| `armored_archer/rollout_rollback` | Rollback to previous phase |
| `armored_archer/rollout_get_metrics` | Get rollout metrics |
| `armored_archer/rollout_record_metrics` | Record rollout metrics |
| `armored_archer/rollout_health` | Get overall rollout health |
| `armored_archer/rollout_prometheus_metrics` | Get Prometheus-format metrics |

### Example: Creating a Feature Flag

```json
{
  "name": "new_game_mode",
  "description": "New PvE game mode",
  "phases": [
    {
      "phase": "canary",
      "percentage": 5,
      "durationMinutes": 60,
      "minHealthPercent": 95,
      "maxErrorRatePercent": 2,
      "maxLatencyMs": 100,
      "sampleSize": 100,
      "autoPromote": false,
      "rollbackCriteria": {
        "errorRateThreshold": 5,
        "latencyThreshold": 250,
        "healthCheckFails": 3
      }
    },
    {
      "phase": "gradual",
      "percentage": 25,
      "durationMinutes": 120,
      "minHealthPercent": 95,
      "maxErrorRatePercent": 1,
      "maxLatencyMs": 100,
      "sampleSize": 500,
      "autoPromote": false,
      "rollbackCriteria": {
        "errorRateThreshold": 3,
        "latencyThreshold": 200,
        "healthCheckFails": 2
      }
    },
    {
      "phase": "full",
      "percentage": 100,
      "durationMinutes": 0,
      "minHealthPercent": 99,
      "maxErrorRatePercent": 0.5,
      "maxLatencyMs": 100,
      "sampleSize": 0,
      "autoPromote": false,
      "rollbackCriteria": {
        "errorRateThreshold": 1,
        "latencyThreshold": 100,
        "healthCheckFails": 1
      }
    }
  ]
}
```

### Rollback Criteria

Each phase can define rollback criteria:

- **errorRateThreshold**: Maximum error rate % before triggering rollback
- **latencyThreshold**: Maximum latency (ms) before triggering rollback  
- **healthCheckFails**: Number of health check failures before rollback
- **customMetrics**: Optional custom metric thresholds

### Monitoring

Prometheus metrics are exposed at `/api/nakama/rpc/armored_archer/rollout_prometheus_metrics`:

- `armored_archer_rollout_phase`: Current rollout phase (0=disabled, 1=canary, 2=gradual, 3=full)
- `armored_archer_rollout_percentage`: Current rollout percentage
- `armored_archer_rollout_users_total`: Total users exposed to feature
- `armored_archer_rollout_errors_total`: Total errors during rollout
- `armored_archer_rollout_latency_ms`: Latency histogram for rollout
- `armored_archer_rollout_health`: Health status (1=healthy, 0=unhealthy)
- `armored_archer_feature_flag_enabled`: Feature flag enabled status

Grafana dashboards are available in `backend/grafana/provisioning/dashboards/armed-archer-dashboard.json` with a dedicated "Progressive Rollout" section.

## Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs
2. Verify environment variables
3. Check Docker image build logs
4. Review health check failures

### Health Check Fails
1. Verify PostgreSQL connection
2. Check Nakama configuration
3. Review Nakama logs
4. Ensure migrations ran successfully

### Rollback Required
1. Identify the issue
2. Manual rollback if automatic fails
3. Fix the issue in a new branch
4. Test thoroughly
5. Deploy again

## Security

- Database credentials stored in GitHub Secrets
- No secrets in repository
- Regular security audits via npm audit
- CodeQL analysis for static security

## Dependencies

- Docker & Docker Compose
- GitHub Actions
- PostgreSQL 14+
- Nakama server
- Node.js 20+
