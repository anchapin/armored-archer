# Beta Deployment Guide

**Environment**: Beta (Pre-Production)
**Version**: v2.1.0-beta.1
**Last Updated**: 2026-03-20

---

## Overview

The beta environment is a production-like deployment that mirrors production configuration while allowing for controlled testing with real users. This guide documents all endpoints, configurations, and procedures for beta deployment.

---

## Beta Environment Endpoints

### Public Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Nakama API | `https://beta-api.armored-archer.internal` | Game server API |
| Nakama WebSocket | `wss://beta-ws.armored-archer.internal` | Real-time multiplayer |
| Nakama Console | `https://beta-console.armored-archer.internal` | Admin dashboard |

### Internal Services (Docker Network)

| Service | Host | Port | Purpose |
|----------|------|------|---------|
| Nakama Server | nakama | 7350 | Game server |
| Nakama Console | nakama | 7351 | Admin console |
| PostgreSQL | postgres | 5432 | Database |
| Redis | redis | 6379 | Caching |
| Prometheus | prometheus | 9090 | Metrics collection |
| Grafana | grafana | 3000 | Metrics visualization |
| Loki | loki | 3100 | Log aggregation |
| OTel Collector | otel-collector | 4317 | Observability pipelines |

---

## Beta Configuration

### Environment Variables

Located in: `backend/.env.beta`

**Critical Configuration**:
- `NODE_ENV=beta` - Beta environment mode
- `NAKAMA_SERVER_URL=beta.armored-archer.internal` - Server hostname
- `BETA_VERSION=v2.1.0-beta.1` - Beta build identifier
- `BETA_MAX_TEST_USERS=500` - Maximum concurrent beta users
- `BETA_ONBOARDING_ENABLED=true` - Beta user registration enabled
- `BETA_FEEDBACK_ENABLED=true` - In-game feedback system enabled

### Database

- **Database Name**: `nakama_beta`
- **User**: `postgres`
- **Host**: `postgres` (Docker network)
- **Port**: `5432`
- **Volume**: `beta_postgres_data` (persistent)

### Security Configuration

- **Server Key**: `beta_server_key_production_ready` (CHANGE IN PRODUCTION)
- **Session Encryption**: `beta_session_encryption_key_change_me` (CHANGE IN PRODUCTION)
- **Refresh Encryption**: `beta_refresh_encryption_key_change_me` (CHANGE IN PRODUCTION)
- **Token Encryption**: `beta_token_encryption_key_change_me` (CHANGE IN PRODUCTION)

**WARNING**: All encryption keys must be changed before production deployment.

---

## Deployment Procedures

### 1. Start Beta Environment

```bash
# Using docker-compose
cd backend
docker-compose -f docker-compose.beta.yml up -d

# Or use Makefile (if added)
make beta-start
```

### 2. Verify Health

```bash
# Check container status
docker ps --filter "name=beta"

# Check Nakama API health
curl -f http://localhost:7350/ || echo "Nakama API not healthy"

# Check database connection
docker exec armored_archer_beta_db pg_isready -U postgres

# Or use Makefile
make beta-health
```

### 3. Run Migrations

```bash
# Run database migrations
docker exec armored_archer_beta nakama migrate up \
  --database.address postgres://postgres:beta_db_secure_password_change_me@postgres:5432/nakama_beta
```

### 4. Stop Beta Environment

```bash
cd backend
docker-compose -f docker-compose.beta.yml down

# Or use Makefile
make beta-stop
```

### 5. View Logs

```bash
# All services
docker-compose -f docker-compose.beta.yml logs -f

# Specific service
docker-compose -f docker-compose.beta.yml logs -f nakama

# Or use Makefile
make beta-logs
```

---

## Monitoring & Observability

### Prometheus Metrics

- **URL**: http://localhost:9090 (beta container)
- **Metrics**: HTTP://localhost:9090/metrics
- **Key Metrics**:
  - `nakama_rpc_latency_seconds` - RPC response times
  - `nakama_rpc_errors_total` - RPC error count
  - `nakama_active_connections` - Active player connections
  - `cache_hits_total` - Cache performance
  - `cache_misses_total` - Cache misses

### Grafana Dashboards

- **URL**: http://localhost:3000 (beta container)
- **Default Credentials**: `admin / admin_beta_change_me`
- **Dashboards**:
  - Nakama Performance
  - Database Health
  - Cache Metrics
  - Error Rates

### Loki Logs

- **URL**: http://localhost:3100 (beta container)
- **Query**: `{environment="beta"}`
- **Log Levels**: INFO, WARN, ERROR

---

## Beta Test Plan

### Success Criteria

- [ ] Beta deployment successful with 0 critical incidents
- [ ] 100+ active beta users
- [ ] Error rate < 0.5% across all RPC endpoints
- [ ] P95 latency < 80ms under normal load
- [ ] 0 critical or high severity bugs
- [ ] Stakeholder approval for production launch

### Test Coverage

**Critical User Journeys**:
1. User registration and login
2. Combat gameplay (PvE)
3. Matchmaking (PvP)
4. Gear acquisition and loadout
5. Progression (leveling, stats)
6. Seasonal leaderboards
7. Store transactions
8. Push notifications

### Performance Validation

```bash
# Run load test (simulates 100 concurrent users)
cd backend/tests/load
k6 run --vus 100 --duration 5m k6.conf.js

# Check P95 latency
curl -s http://localhost:9090/metrics | grep nakama_rpc_latency_seconds
```

### Error Rate Monitoring

```bash
# Calculate error rate from Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=sum(rate(nakama_rpc_errors_total[5m]))/sum(rate(nakama_rpc_calls_total[5m]))' | jq '.data.result[0].value[1]'

# Should be < 0.005 (0.5%)
```

---

## Beta User Onboarding

### Registration Flow

1. User downloads beta client
2. Opens game and selects "Sign Up"
3. Completes registration (email + password)
4. Verifies email (if enabled)
5. Creates character
6. Completes tutorial
7. Gains access to all beta features

### Beta User Limits

- **Maximum Users**: 500
- **Concurrent Users**: 100
- **Onboarding**: Enabled
- **Feedback System**: Enabled

### Feedback Collection

- In-game feedback form (BETA_FEEDBACK_ENABLED)
- Automatic error reporting
- Performance metrics collection
- User analytics (anonymous)

---

## Troubleshooting

### Common Issues

**Issue**: Nakama API not responding
```bash
# Check container status
docker ps --filter "name=beta"

# Check logs
docker logs armored_archer_beta

# Restart Nakama
docker restart armored_archer_beta
```

**Issue**: Database connection failed
```bash
# Check PostgreSQL is running
docker exec armored_archer_beta_db pg_isready -U postgres

# Check database exists
docker exec armored_archer_beta_db psql -U postgres -c "\l"

# Restart PostgreSQL
docker restart armored_archer_beta_db
```

**Issue**: High error rate (> 0.5%)
```bash
# Check error metrics
curl -s http://localhost:9090/metrics | grep nakama_rpc_errors_total

# View recent errors
docker logs armored_archer_beta --tail 100 | grep ERROR

# Check database performance
docker exec armored_archer_beta_db psql -U postgres -d nakama_beta -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

**Issue**: High latency (> 80ms P95)
```bash
# Check latency metrics
curl -s http://localhost:9090/metrics | grep nakama_rpc_latency_seconds

# Check cache hit rate
curl -s http://localhost:9090/metrics | grep cache_hit_rate

# View slow queries
docker logs armored_archer_beta_db --tail 100 | grep "duration:"
```

---

## Rollback Procedures

If critical issues are discovered:

1. **Stop Beta Environment**
   ```bash
   make beta-stop
   ```

2. **Revert to Previous Version**
   ```bash
   git checkout <previous-stable-tag>
   make backend-build-go
   ```

3. **Restart Beta**
   ```bash
   make beta-start
   make beta-health
   ```

4. **Notify Stakeholders**
   - Document issue
   - Communicate timeline
   - Provide ETA for fix

---

## Security Checklist

Before production launch:

- [ ] Change all encryption keys (server key, session, refresh, token)
- [ ] Change database passwords
- [ ] Update console admin password
- [ ] Configure SSL/TLS certificates
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Set up intrusion detection
- [ ] Enable audit logging
- [ ] Configure backup procedures
- [ ] Test disaster recovery

---

## Contact & Support

**Beta Coordinator**: [Contact]
**DevOps Support**: [Contact]
**Database Admin**: [Contact]
**Security Team**: [Contact]

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | v2.1.0-beta.1 | Initial beta deployment guide |

---

*Generated by Beta Readiness Phase (06-01)*
