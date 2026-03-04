# Deployment Readiness Checklist

This document provides a comprehensive checklist for verifying backend deployment readiness before production deployment.

## Table of Contents

- [Pre-Deployment Verification](#pre-deployment-verification)
- [Health Check Verification](#health-check-verification)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Security Checks](#security-checks)
- [Performance Checks](#performance-checks)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)

## Pre-Deployment Verification

### Code Quality

- [ ] All TypeScript compilation passes without errors
  ```bash
  cd backend && npx tsc --noEmit
  ```

- [ ] Code passes linting rules
  ```bash
  cd backend && npm run lint
  ```

- [ ] No critical security vulnerabilities in dependencies
  ```bash
  cd backend && npm audit
  ```

### Environment Configuration

- [ ] All required environment variables are set in production
  - `NODE_ENV=production`
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `NAKAMA_SERVER_KEY` (generated secure key)
  - `SESSION_ENCRYPTION_KEY` (32+ bytes)
  - `REFRESH_ENCRYPTION_KEY` (32+ bytes)

- [ ] Environment validation script passes
  ```bash
  cd backend && ./scripts/validate-env.sh
  ```

### Build Verification

- [ ] Backend builds successfully
  ```bash
  cd backend && npm run build
  ```

- [ ] Build output directory exists with compiled modules
  ```bash
  ls backend/build/
  ```

## Health Check Verification

The backend provides a health check RPC endpoint (`armored_archer/health_check`) that returns:
- `status`: "ok" if healthy
- `version`: Current version string
- `timestamp`: Unix timestamp in milliseconds

### Testing Health Check

#### Unit Test

Run the deployment readiness tests:
```bash
cd backend && npm test -- deployment_ready
```

Expected results:
- ✓ should return ok status with timestamp
- ✓ should return current version
- ✓ should accept empty payload
- ✓ should log health check call
- ✓ should have valid version format
- ✓ should return timestamp in milliseconds

#### Manual Verification

```bash
# Using Nakama CLI or curl
curl -X POST http://localhost:7350/v2/rpc/armored_archer/health_check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <server-key>" \
  -d '{}'
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": 1699999999999
}
```

## Unit Tests

### Running All Unit Tests

```bash
cd backend && npm test
```

### Required Test Suites

All tests must pass before deployment:

| Test Suite | Description | Critical |
|------------|-------------|----------|
| `deployment_ready.test.ts` | Health check and environment validation | ✅ Yes |
| `player_rpc.test.ts` | Player RPC endpoints | ✅ Yes |
| `validation.test.ts` | Input validation schemas | ✅ Yes |
| `anti_cheat.test.ts` | Anti-cheat detection | ✅ Yes |
| `matchmaker.test.ts` | Matchmaking logic | ✅ Yes |
| `store.test.ts` | Store/purchase logic | ✅ Yes |
| `rpg_system.test.ts` | RPG system logic | ✅ Yes |
| `combat_system.test.ts` | Combat calculations | ✅ Yes |
| `season_system.test.ts` | Season/rewards logic | ✅ Yes |

### Test Coverage Requirements

- Minimum 80% code coverage
- All critical paths must have test coverage
- All error handling paths must be tested

## Integration Tests

Integration tests verify end-to-end functionality with a running Nakama server.

### Prerequisites

1. Start Nakama server:
   ```bash
   cd backend && docker-compose up -d
   ```

2. Wait for Nakama to be ready:
   ```bash
   cd backend && npm run test:integration:wait
   ```

3. Build the backend module:
   ```bash
   cd backend && npm run build && docker-compose restart nakama
   ```

### Running Integration Tests

```bash
cd backend && npm run test:integration
```

### Integration Test Suites

| Test Suite | Tests | Status |
|------------|-------|--------|
| `matchmaker.test.ts` | Match creation, acceptance, listing | Must Pass |
| `combat_system.test.ts` | Combat actions, turn management | Must Pass |
| `rpg_system.test.ts` | XP gain, level progression | Must Pass |
| `gear_system.test.ts` | Gear generation, inventory | Must Pass |
| `season_system.test.ts` | Season info, leaderboard | Must Pass |
| `store.test.ts` | Purchase validation, currency | Must Pass |

## Security Checks

### API Security

- [ ] Rate limiting is configured and working
- [ ] Input validation is enforced on all RPC endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] No sensitive data in logs

### Authentication

- [ ] Server key is secure (not default, not in version control)
- [ ] Session encryption key is properly configured
- [ ] Token refresh mechanism works correctly

### Anti-Cheat

- [ ] Anti-cheat module is loaded and functional
- [ ] Suspicious activity logging is working
- [ ] Speed hack detection is enabled

## Performance Checks

### Startup Performance

- [ ] Backend module loads within 5 seconds
- [ ] No memory leaks after module initialization
- [ ] Cache warming completes successfully

### Runtime Performance

- [ ] Health check response time < 100ms
- [ ] Database queries are optimized (indexes exist)
- [ ] No N+1 query patterns in critical paths

### Load Testing

```bash
# Example load test with hey or wrk
hey -n 1000 -c 10 -m POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <server-key>" \
  -d '{}' \
  http://localhost:7350/v2/rpc/armored_archer/health_check
```

Expected:
- 95th percentile latency < 200ms
- No error responses

## Deployment Steps

### 1. Pre-Deployment Checklist

Complete all checks in this document before proceeding.

### 2. Database Backup

```bash
# Create database backup
pg_dump -U nakama_user -h <db-host> -F c -b -v -f backup_$(date +%Y%m%d).dump nakama
```

### 3. Deploy Backend

```bash
# Build the backend
cd backend && npm run build

# Deploy to production (e.g., Docker)
docker build -t armored-archer-backend:latest .
docker push registry.example.com/armored-archer-backend:latest

# Or use deployment script
./deploy.sh
```

### 4. Verify Deployment

```bash
# Check container is running
docker ps | grep armored-archer

# Check logs
docker logs armored-archer-backend

# Run health check
curl -X POST http://<host>:7350/v2/rpc/armored_archer/health_check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <server-key>" \
  -d '{}'
```

## Post-Deployment Verification

### Immediate Checks (First 5 Minutes)

- [ ] Health check endpoint responds with "ok"
- [ ] No errors in server logs
- [ ] Database connections are stable
- [ ] Players can authenticate

### Short-Term Checks (First Hour)

- [ ] Matchmaking is working
- [ ] Combat system is functional
- [ ] Store purchases work
- [ ] No performance degradation

### Long-Term Checks (First 24 Hours)

- [ ] No memory leaks
- [ ] No database connection leaks
- [ ] Leaderboard updates correctly
- [ ] Season progress tracks correctly
- [ ] Anti-cheat is detecting violations

### Monitoring

Set up monitoring for:
- Health check endpoint latency
- Error rates by endpoint
- Database connection pool usage
- Memory usage
- CPU usage

## Rollback Procedure

If deployment fails:

1. **Stop new version**:
   ```bash
   docker-compose stop backend
   ```

2. **Restore previous version**:
   ```bash
   docker pull armored-archer-backend:<previous-tag>
   ```

3. **Restore database if needed**:
   ```bash
   pg_restore -U nakama_user -h <db-host> -d nakama -c -v backup_<date>.dump
   ```

4. **Restart services**:
   ```bash
   docker-compose up -d
   ```

5. **Verify rollback**:
   ```bash
   # Run health check
   curl -X POST http://<host>:7350/v2/rpc/armored_archer/health_check \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <server-key>" \
     -d '{}'
   ```

## Related Documentation

- [Production Deployment Guide](./DEPLOYMENT.md)
- [Integration Tests](./INTEGRATION_TESTS.md)
- [Environment Configuration](./ENVIRONMENTS.md)
- [Monitoring Setup](./MONITORING.md)

---

**Last Updated**: 2024
**Version**: 1.0
