# Beta Deployment Checklist

## Pre-Deployment Verification

- [ ] Go module built successfully (`go build` passes)
- [ ] All tests passing (`go test` passes)
- [ ] Database migrations ready
- [ ] Beta environment config verified (`.env.beta`)
- [ ] Beta docker-compose override verified
- [ ] Nakama beta config ready (`nakama.beta.yml`)
- [ ] Backup of production data created

## Deployment Steps

### Step 1: Environment Setup
- [ ] Copy `.env.beta` to deployment target
- [ ] Copy `docker-compose.beta.yml` to deployment
- [ ] Copy `nakama.beta.yml` to data directory

### Step 2: Build & Package
- [ ] Run `go build -o build/server.so ./cmd/server`
- [ ] Verify `server.so` exists in build directory

### Step 3: Database Setup
- [ ] Create database `nakama_beta`
- [ ] Run migrations from `./data/`

### Step 4: Deploy
- [ ] Run `./scripts/deploy-beta.sh`
- [ ] Verify module transferred correctly

### Step 5: Services Started
- [ ] Nakama service started
- [ ] PostgreSQL service started
- [ ] Redis service started

## Post-Deployment Verification

### Health Checks

| Check | Expected | Status |
|-------|----------|--------|
| `/health` | 200 OK | ⬜ |
| `/healthz` | 200 OK | ⬜ |
| Console accessible | 200 OK | ⬜ |

### Database Checks

| Check | Expected | Status |
|-------|----------|--------|
| DB connection | Connected | ⬜ |
| Migrations applied | All | ⬜ |
| Test query | Success | ⬜ |

### Monitoring Checks

| Check | Expected | Status |
|-------|----------|--------|
| Prometheus metrics | Available | ⬜ |
| Grafana dashboards | Loading | ⬜ |
| Log aggregation | Working | ⬜ |

### Functional Checks

| Check | Expected | Status |
|-------|----------|--------|
| User registration | Works | ⬜ |
| User login | Works | ⬜ |
| RPC endpoints | Responding | ⬜ |
| Match creation | Works | ⬜ |

## Rollback Plan

If deployment fails:

```bash
# Restore previous version
./scripts/rollback-beta.sh

# Or manually restore from backup
cp /opt/nakama/backups/server.so.YYYYMMDD /opt/nakama/modules/server.so
systemctl restart nakama
```

## Monitoring URLs

| Service | URL |
|---------|-----|
| API | https://beta.armored-archer.internal:7350 |
| Console | https://beta.armored-archer.internal:7351 |
| Prometheus | http://beta.armored-archer.internal:9090 |
| Grafana | http://beta.armored-archer.internal:3000 |
| Loki | http://beta.armored-archer.internal:3100 |

## Deployment Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Deployer | | | |
| QA Lead | | | |
| Tech Lead | | | |

---

**Version**: 1.0  
**Created**: 2026-03-17
