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
