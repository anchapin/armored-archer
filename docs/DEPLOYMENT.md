# Armored Archer - Comprehensive Deployment Guide

**Version**: 1.0  
**Last Updated**: March 2026  
**Applicable To**: Backend (Nakama + PostgreSQL) and Godot Client (iOS/Android)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference](#quick-reference)
3. [Backend Deployment](#backend-deployment)
   - [System Requirements](#system-requirements)
   - [Environment Setup](#environment-setup)
   - [Nakama Server Setup](#nakama-server-setup)
   - [PostgreSQL Configuration](#postgresql-configuration)
   - [Database Migrations](#database-migrations)
   - [Production Deployment](#production-deployment)
   - [Staging Deployment](#staging-deployment)
4. [Godot Client Deployment](#godot-client-deployment)
   - [Export Configuration](#export-configuration)
   - [iOS Deployment](#ios-deployment)
   - [Android Deployment](#android-deployment)
   - [Store Submission](#store-submission)
5. [Infrastructure](#infrastructure)
   - [SSL/TLS](#ssltls)
   - [Firewall Rules](#firewall-rules)
   - [Monitoring & Alerting](#monitoring--alerting)
6. [Operations](#operations)
   - [Backup & Restore](#backup--restore)
   - [Rollback Procedures](#rollback-procedures)
   - [Secrets Rotation](#secrets-rotation)
7. [CI/CD Integration](#cicd-integration)
8. [Deployment Checklist](#deployment-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Reference](#reference)

---

## Overview

Armored Archer uses a **backend-for-frontend** architecture:

- **Backend**: Nakama game server + PostgreSQL database (Docker-based)
- **Client**: Godot 4.x game engine exported to iOS/Android
- **Deployment**: Docker containers for backend; native app stores for client

This guide consolidates deployment procedures for both components across **staging** and **production** environments.

---

## Quick Reference

### Backend Ports

| Port | Service | Purpose | External |
|------|---------|---------|----------|
| 7350 | Nakama Socket | Game API | Yes (or via LB) |
| 7351 | Nakama Console | Admin interface | No (internal only) |
| 5432 | PostgreSQL | Database | No |
| 9100 | Prometheus Metrics | Monitoring | No |

### Environment Files

```bash
backend/
├── .env.development          # Local development
├── .env.staging              # Staging (committed template)
├── .env.staging.local        # Staging secrets (ignored)
├── .env.production.example   # Production template
└── .env.production           # Production secrets (ignored)
```

### Key Commands

```bash
# Backend
cd backend
npm ci && npm run build
docker-compose up -d
docker exec armored_archer_server /nakama/nakama migrate up
docker-compose logs -f

# Database backup
docker exec armored_archer_db pg_dump -U postgres nakama > backup.sql

# Health checks
curl http://localhost:7350/health
curl http://localhost:9100/metrics
```

---

## Backend Deployment

### System Requirements

**Minimum Production**:
- CPU: 2 cores (4+ recommended)
- RAM: 4 GB (8+ recommended)
- Disk: 20 GB SSD (50+ recommended)
- OS: Ubuntu 20.04+, Debian 11+, CentOS 8+
- Docker: 20.10+ with Compose v2

**Staging**: 1 CPU, 2 GB RAM sufficient

---

### Environment Setup

#### 1. Clone and Build

```bash
git clone <repository>
cd armored-archer/backend

# Install dependencies
npm ci --only=production

# Build TypeScript modules
npm run build
```

#### 2. Configure Environment

Copy and edit the appropriate environment file:

**For Production**:
```bash
cp .env.production.example .env.production
# Edit .env.production - set all required secrets
```

**For Staging**:
```bash
cp .env.staging .env.staging.local
# Edit .env.staging.local with staging secrets
```

Set `NODE_ENV` to select environment:
```bash
export NODE_ENV=production  # or staging
```

#### 3. Environment Variables Reference

**Required for Production**:

| Variable | Description | Generation |
|----------|-------------|------------|
| `NAKAMA_SERVER_KEY` | Server authentication (32+ chars) | `openssl rand -base64 32` |
| `NAKAMA_CONSOLE_PASSWORD` | Admin console password | Strong password |
| `SESSION_ENCRYPTION_KEY` | Token encryption (32+ chars) | `openssl rand -base64 32` |
| `REFRESH_ENCRYPTION_KEY` | Refresh token encryption (32+ chars) | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Database password | Strong password |
| `DATABASE_ADDRESS` | DB connection string | Format: `user:pass@host:5432/db` |

**Important**: Never use default values in production. See `backend/docs/ENVIRONMENTS.md` for complete variable list.

---

### Nakama Server Setup

#### Docker Compose

The `backend/docker-compose.yml` defines:

- **postgres**: PostgreSQL 14-alpine
- **nakama**: Heroic Labs Nakama 3.21.1

Key volumes:
- `./build:/nakama/data/build` - Compiled modules
- `./modules:/nakama/data/modules` - Custom modules
- `./data:/nakama/data/migrations` - Database migrations
- Docker volume `data` for PostgreSQL persistence

#### Configuration (`backend/nakama.yml`)

```yaml
name: nakama1
console:
  port: 7351
  username: admin
  password: <set_from_env>
  read_timeout: 10
  write_timeout: 10

runtime:
  env: ${NODE_ENV}
  path: /nakama/data

socket:
  server_key: <set_from_env>
  port: 7350
  max_message_size_bytes: 4096
  read_buffer_size_bytes: 4096
  write_buffer_size_bytes: 4096
  read_timeout_ms: 10000
  write_timeout_ms: 10000
  idle_timeout_ms: 60000

session:
  expiry_sec: 7200
  refresh_encryption_key: <set_from_env>
  token_encryption_key: <set_from_env>

database:
  address: ${DATABASE_ADDRESS}
  conn_max_lifetime: 60
  max_open_conns: 25
  max_idle_conns: 10

social:
  enable_anonymous_auth: true
  enable_device_auth: true

leaderboard:
  enable_rank_cache: true
  rank_cache_size: 1000

logger:
  level: DEBUG  # Change to WARN in production
  format: json
  output: stdout

match:
  allow_host_loopback: true  # false in production

metric:
  namespace: nakama
  prefix: nakama
  reporter:
    - type: prometheus
      port: 9100
```

**Production Hardening**:
- Change `console.password`
- Set `socket.server_key` to random value
- Use strong `session.*_encryption_key` values
- Set `logger.level=WARN`
- Set `match.allow_host_loopback=false`
- Increase `database.max_open_conns` for high load

---

### PostgreSQL Configuration

#### Self-Hosted (Docker)

No additional setup - Docker Compose provisions automatically. Data persists in Docker volume `data`.

**Backup volume**:
```bash
docker run --rm -v armored_archer_data:/data -v /backups:/backup alpine \
  tar czf /backup/armored_archer_data_$(date +%F).tar.gz -C /data .
```

#### Managed Database (AWS RDS, Cloud SQL, etc.)

1. Create PostgreSQL 14+ instance
2. Create database `nakama`
3. Create user with strong password
4. Configure connection SSL if required
5. Update `.env.production`:
```bash
DB_HOST=your-db-host.rds.amazonaws.com
DB_PORT=5432
DB_NAME=nakama
DB_USER=nakama_user
DB_PASSWORD=your_secure_password
DATABASE_ADDRESS=${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}
```
6. Whitelist application server IP in database firewall

---

### Database Migrations

Migrations run automatically on Nakama startup. To run manually:

```bash
cd backend
docker exec -it armored_archer_server /nakama/nakama migrate up
```

Check migration status:
```bash
docker exec -it armored_archer_server /nakama/nakama migrate status
```

Migrations are located in `backend/data/` as SQL files. They are forward-only; no auto-rollback.

---

### Production Deployment

1. **Prepare server** - Install Docker, Docker Compose
2. **Pull code** - Clone repository to `/opt/armored-archer`
3. **Build** - `npm ci && npm run build`
4. **Configure** - Create `.env.production` with all secrets
5. **Hardening** - Update `nakama.yml` with production values
6. **Start services** - `docker-compose up -d`
7. **Verify** - Health checks on ports 7350, 7351, 9100
8. **Run migrations** (if not auto-ran) - `docker exec armored_archer_server /nakama/nakama migrate up`
9. **Configure LB** - Set up load balancer if using (terminate SSL at LB)

For complete details, see `backend/docs/DEPLOYMENT.md`.

---

### Staging Deployment

Staging mirrors production but with:

- Reduced resources
- Sandbox RevenueCat keys
- Separate database
- INFO-level logging
- `NODE_ENV=staging`

Setup:

```bash
cp .env.staging .env.staging.local
# Edit with staging secrets
NODE_ENV=staging docker-compose up -d
```

See `backend/docs/ENVIRONMENTS.md` for environment configuration details.

---

## Godot Client Deployment

### Export Configuration

The project is configured in `export_presets.cfg` for iOS and Android.

**Bundle/ Package identifiers** (update for your organization):
- iOS: `com.yourcompany.ArmoredArcher`
- Android: `com.yourcompany.armoredarcher`

**Versioning**:
- iOS: `short_version` (1.0.0) and `version` (1)
- Android: `version` (1) and `version_code` (must increment)

---

### iOS Deployment

#### Prerequisites

- macOS with Xcode 14+
- Apple Developer Program membership ($99/year)
- Provisioning profile and certificate

#### Build Steps

1. Open project in Godot 4.x
2. **Project → Export** → Select iOS preset
3. Configure:
   - Bundle Identifier
   - Display Name: `Armored Archer`
   - Short Version & Version
   - Team (Apple Developer)
4. Click **Export** → `export/ios/ArmoredArcher.ipa`
5. Open generated Xcode project in `export/ios/`
6. Select **Generic iOS Device** or physical device
7. **Product → Archive**
8. In Organizer, **Distribute App** → **App Store Connect**
9. Upload and wait for processing

**Server URL**: Configure client to point to production API endpoint (via environment or config file).

For detailed troubleshooting and options, see `EXPORT_GUIDE.md`.

---

### Android Deployment

#### Prerequisites

- Android Studio installed
- JDK 11+
- Android SDK API 26+
- Keystore for signing

#### Build Steps

1. Create keystore (once):
```bash
keytool -genkey -v -keystore armored-archer-release.keystore \
  -alias armored-archer -keyalg RSA -keysize 2048 -validity 10000
```

2. In Godot **Project → Export** → Android preset
3. Configure:
   - Package: `com.yourcompany.armoredarcher`
   - Version & Version Code (increment)
   - Keystore path, alias, password
4. Click **Export** → `export/android/ArmoredArcher.apk` or `.aab`
5. Install/test: `adb install export/android/armored-archer.apk`
6. Sign with jarsigner if needed
7. Upload to Google Play Console

For detailed export options and build types, see `EXPORT_GUIDE.md`.

---

### Store Submission

#### App Store (iOS)

1. Complete app metadata in App Store Connect:
   - Screenshots (all device sizes)
   - Description, keywords
   - Support URL, Privacy Policy URL
   - Age rating
   - Content rights
2. Upload build via Xcode or Transporter
3. Submit for review (typically 1-7 days)
4. Release after approval (manual or automatic)

#### Google Play Store

1. Create store listing:
   - Title, description, graphics
   - Category (Game/Action)
   - Content rating questionnaire
2. Upload APK or AAB to appropriate track:
   - Internal testing
   - Closed beta
   - Open beta
   - Production
3. Submit for review (typically few hours to 2 days)
4. Roll out to production

**Important**: Both stores require:
- Privacy policy URL
- Terms of service (recommended)
- Proper content ratings
- Compliance with store guidelines

---

## Infrastructure

### SSL/TLS

Nakama does not provide native TLS; terminate at load balancer or reverse proxy.

**Recommended: Load Balancer (AWS ALB, GCP LB, nginx)**

Example nginx stream (TCP) proxy:
```nginx
stream {
    upstream nakama_backend {
        server 10.0.1.10:7350;
        server 10.0.1.11:7350;
    }

    server {
        listen 443;
        proxy_pass nakama_backend;
        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/private/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
    }
}
```

Client connects via `wss://api.armored-archer.com` (secure WebSocket).

Obtain certificates with **Let's Encrypt**:
```bash
sudo certbot --nginx -d api.armored-archer.com
```

---

### Firewall Rules

Allow only necessary ports:

```bash
# ufw example
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow HTTPS/HTTP
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Nakama API (or restrict to LB only)
sudo ufw allow from LOAD_BALANCER_IP to any port 7350

# Allow admin console from restricted IPs only
sudo ufw allow from ADMIN_IP to any port 7351

# SSH from admin IPs only
sudo ufw allow from ADMIN_IP to any port 22

sudo ufw enable
```

---

### Monitoring & Alerting

#### Prometheus Metrics

Metrics exposed on port `9100` (configurable via `PROMETHEUS_PORT`):

- `nakama_request_duration_seconds`
- `nakama_requests_total`
- `armored_archer_rate_limit_violations_total`
- `armored_archer_cache_hits_total`, `cache_misses_total`
- Database connection metrics

**Prometheus config**:
```yaml
scrape_configs:
  - job_name: 'nakama'
    static_configs:
      - targets: ['your-server:9100']
```

#### Logs

All logs output JSON to stdout. Collect via:
- Docker logging driver
- Systemd journal
- Cloud logging (CloudWatch, Stackdriver)

Search: `level=error`, `level=warn`, userId, endpoint.

#### Alerting (Prometheus Alertmanager)

```yaml
alert:
  - alert: NakamaDown
    expr: up{job="nakama"} == 0
    for: 5m

  - alert: HighErrorRate
    expr: rate(nakama_requests_total{status=~"5.."}[5m]) > 0.05
    for: 10m

  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(nakama_request_duration_seconds_bucket[5m])) > 0.5
    for: 5m
```

See `backend/docs/DEPLOYMENT.md` for detailed monitoring setup.

---

## Operations

### Backup & Restore

#### Automated Daily Backups

```bash
#!/bin/bash
# /etc/cron.daily/nakama-backup
BACKUP_DIR=/backups/nakama
DATE=$(date +%Y%m%d)
docker exec armored_archer_db \
  pg_dump -U postgres -Fc nakama > $BACKUP_DIR/backup_$DATE.dump

# Retain 30 days
find $BACKUP_DIR -mtime +30 -delete
```

#### Restore

```bash
# Stop services
docker-compose down

# Restore database
docker exec -i armored_archer_db pg_restore -U postgres -d nakama < backup_20240115.dump

# Start services
docker-compose up -d
```

For complete backup strategy including WAL archiving, see `backend/docs/DEPLOYMENT.md`.

---

### Rollback Procedures

#### Application Rollback

```bash
# If using Docker with registry
docker pull yourregistry/armored-archer:previous_tag
docker-compose down
docker-compose up -d
```

#### Database Rollback

Restore from most recent backup (see above). Nakama migrations are forward-only; manual revert may be needed if migration caused issues.

#### Secrets Rollback

Restore previous `.env.production` from secure backup and restart services.

Detailed rollback for each component: see `SECRETS_ROTATION.md` and `backend/docs/DEPLOYMENT.md`.

---

### Secrets Rotation

Rotate quarterly to annually depending on secret type:

| Secret | Frequency | Impact |
|--------|-----------|--------|
| Database password | Quarterly | Requires restart |
| Nakama server key | Semi-annually | Invalidates sessions |
| Session encryption keys | Monthly | Forces re-login |
| RevenueCat keys | Quarterly | Minimal |
| Firebase keys | Semi-annually | Varies |

**Generation**: `openssl rand -base64 32` for most keys.

Complete procedures: see `SECRETS_ROTATION.md`.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Build
        run: |
          cd backend
          npm ci
          npm run build
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/armored-archer/backend
            docker-compose down
            docker-compose pull
            docker-compose up -d
            docker exec armored_archer_server /nakama/nakama migrate up
```

Store secrets in GitHub repository settings.

---

## Deployment Checklist

### Pre-Deployment

- [ ] Security scan: `npm audit` (no high/critical vulnerabilities)
- [ ] All environment variables set with strong random values
- [ ] `.env.production` created and secured (chmod 600)
- [ ] `nakama.yml` production-hardened
- [ ] Database backup taken (staging/production only)
- [ ] Build successful: `npm run build`
- [ ] Docker images built/pulled
- [ ] Load balancer configured (if applicable)
- [ ] Monitoring/alerting in place
- [ ] Rollback plan documented

### Deployment Steps

- [ ] Pull latest code to server
- [ ] Install dependencies: `npm ci --only=production`
- [ ] Build: `npm run build`
- [ ] Copy `.env.production` to server (securely)
- [ ] Update `nakama.yml` if needed
- [ ] Start services: `docker-compose up -d`
- [ ] Run migrations: `docker exec armored_archer_server /nakama/nakama migrate up`
- [ ] Wait 30 seconds for initialization

### Post-Deployment Verification

- [ ] Containers running: `docker ps` shows `postgres` and `nakama`
- [ ] Health endpoint returns 200: `curl http://localhost:7350/health`
- [ ] Console accessible (from allowed IP): `curl http://localhost:7351`
- [ ] Metrics endpoint: `curl http://localhost:9100/metrics`
- [ ] No errors in logs: `docker logs armored_archer_server | grep -i error`
- [ ] Database connection: `docker exec armored_archer_server /nakama/nakama migrate status`
- [ ] Rate limiting active: check metrics for `armored_archer_rate_limit_violations_total`
- [ ] Cache metrics: hit rate >80% for player_stats
- [ ] Client can connect and authenticate
- [ ] Sample API calls succeed (combat, matchmaking)
- [ ] Monitoring dashboards showing data

### 24-Hour Post

- [ ] Review logs for warnings/errors
- [ ] Check database growth and disk usage
- [ ] Verify backup job succeeded
- [ ] Confirm metrics collection
- [ ] Assess performance (latency, CPU, memory)

---

## Troubleshooting

### Backend Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Nakama won't start | Invalid config or env vars | Check logs: `docker-compose logs nakama` |
| Database connection failed | Wrong `DATABASE_ADDRESS` | Verify `.env` and `nakama.yml` |
| High latency | Insufficient resources or cache misses | Check CPU/memory; review cache strategy |
| 500 errors on endpoints | RPC module errors | Check logs for stack traces |
| Rate limit errors too low/high | Misconfigured limits | Adjust `RATE_LIMIT_*` variables |

### Client Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Cannot connect to server | Wrong server URL/port | Verify `NetworkManager` config |
| Authentication fails | Invalid server key or session keys | Check `NAKAMA_SERVER_KEY` matches |
| App crashes on launch (iOS) | Code signing issue | Verify provisioning profile and bundle ID |
| Build fails (Android) | Keystore misconfigured | Check keystore path, alias, password |

### Database Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Out of connections | `max_open_conns` too low | Increase in `nakama.yml` |
| Slow queries | Missing indexes or table bloat | See `backend/DB_OPTIMIZATION.md` |
| Disk full | Large tables or WAL accumulation | Run `VACUUM`, increase disk, archive old data |

---

## Reference

### Existing Detailed Documentation

| Topic | Document |
|-------|----------|
| Backend Environment Variables | `backend/docs/ENVIRONMENTS.md` |
| Backend Deployment (comprehensive) | `backend/docs/DEPLOYMENT.md` |
| Rate Limiting | `backend/RATE_LIMITING.md` |
| Database Optimization | `backend/DB_OPTIMIZATION.md` |
| Caching Strategy | `backend/CACHE_STRATEGY.md` |
| Secrets Rotation | `SECRETS_ROTATION.md` |
| Godot Export (iOS/Android) | `EXPORT_GUIDE.md` |
| Firebase Setup | `FIREBASE_SETUP.md` |
| App Store Submission | `APP_STORE_IOS.md`, `APP_STORE_ANDROID.md` |
| Submission Checklist | `APP_SUBMISSION_CHECKLIST.md` |

### External Resources

- [Nakama Documentation](https://heroiclabs.com/docs/nakama/)
- [Godot Export Docs](https://docs.godotengine.org/en/stable/tutorials/export/index.html)
- [Apple App Store Connect](https://appstoreconnect.apple.com)
- [Google Play Console](https://play.google.com/console)

---

## Appendix: Full Stack Deployment Flow

1. **Backend**: Deploy Nakama + PostgreSQL to staging → Test → Promote to production
2. **Database**: Run migrations, verify data integrity
3. **Client**: Build Godot export for iOS/Android (internal test) → Submit to stores → Release
4. **Monitoring**: Verify metrics, logs, alerts
5. **Post-release**: Watch for errors, user feedback, performance metrics

---

**Need Help?** Open an issue on GitHub or contact the team.
