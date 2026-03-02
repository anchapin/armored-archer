# Production Deployment Guide

This guide covers deploying the Armored Archer backend and client to production environments.

## Table of Contents

- [Production Environment Requirements](#production-environment-requirements)
- [Nakama Production Setup](#nakama-production-setup)
- [PostgreSQL Production Configuration](#postgresql-production-configuration)
- [Environment Variables](#environment-variables)
- [Database Migration Process](#database-migration-process)
- [Backup and Restore Procedures](#backup-and-restore-procedures)
- [Monitoring and Alerting Setup](#monitoring-and-alerting-setup)
- [Rollback Procedures](#rollback-procedures)
- [Godot Mobile Deployment](#godot-mobile-deployment)
- [Deployment Scripts](#deployment-scripts)
- [Security Best Practices](#security-best-practices)

## Production Environment Requirements

### Infrastructure

- **Minimum Requirements**:
  - 2 vCPU cores
  - 4 GB RAM
  - 20 GB SSD storage
  - Ubuntu 20.04+ / Debian 10+ / CentOS 7+

- **Recommended for Production**:
  - 4+ vCPU cores
  - 8 GB+ RAM
  - 50 GB+ SSD storage
  - Dedicated database server

### Network Configuration

- **Ports**:
  - TCP 80 (HTTP - redirect to HTTPS)
  - TCP 443 (HTTPS)
  - TCP 7350 (Nakama API)
  - TCP 7351 (Nakama Console - restricted access)
  - TCP 9100 (Prometheus metrics - internal only)

- **Firewall Rules**:
  ```bash
  # Allow HTTP/HTTPS
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  
  # Allow Nakama API
  sudo ufw allow 7350/tcp
  
  # Allow Nakama Console (restrict to admin IPs)
  sudo ufw allow from YOUR_ADMIN_IP to any port 7351
  
  # Allow Prometheus metrics (internal only)
  sudo ufw allow from 10.0.0.0/8 to any port 9100
  ```

## Nakama Production Setup

### Installation

```bash
# Download and install Nakama
curl -sSL https://github.com/heroiclabs/nakama/releases/latest/download/nakama-linux-amd64.tar.gz | tar xz
chmod +x nakama
mv nakama /usr/local/bin/
```

### Configuration

Create `/etc/nakama/config.yml`:

```yaml
server:
  # Production settings
  runtime.path: "./modules"
  runtime.http_key: "YOUR_SERVER_KEY"
  
  # Security
  allow_host_loopback: false
  
  # Ports
  socket_port: 7350
  console_port: 7351
  
  # Authentication
  console:
    username: "admin"
    password: "SECURE_PASSWORD"

# Database
database:
  address: "postgres://user:password@db_host:5432/nakama"
  max_open_connections: 100
  conn_timeout: 10

# Storage
storage:
  adapter: "postgres"

# Metrics
metrics:
  prometheus: true
  prometheus_port: 9100
```

## PostgreSQL Production Configuration

### Installation

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Secure installation
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'SECURE_PASSWORD';"
```

### Configuration

Edit `/etc/postgresql/13/main/postgresql.conf`:

```ini
# Production settings
max_connections = 200
work_mem = 4MB
maintenance_work_mem = 64MB
shared_buffers = 1GB
effective_cache_size = 4GB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1

# Security
listen_addresses = 'localhost'
port = 5432

# Performance
shared_preload_libraries = 'pg_stat_statements'
```

Edit `/etc/postgresql/13/main/pg_hba.conf`:

```conf
# Local access
local   all             postgres                                md5
local   all             all                                     md5

# IPv4 local connections
host    all             all             127.0.0.1/32            md5

# IPv6 local connections
host    all             all             ::1/128                 md5

# Nakama server access
host    all             nakama_user    192.168.1.0/24          md5
```

## Environment Variables

### Required Variables

| Variable | Description | Example | Production Notes |
|----------|-------------|---------|------------------|
| `NODE_ENV` | Environment name | `production` | Always set to `production` |
| `DB_HOST` | Database host | `db.example.com` | Use private IP in production |
| `DB_PORT` | Database port | `5432` | Keep default unless changed |
| `DB_NAME` | Database name | `nakama` | Use separate DB per environment |
| `DB_USER` | Database user | `nakama_user` | Create dedicated user |
| `DB_PASSWORD` | Database password | `SecurePass123!` | Use strong, unique password |
| `NAKAMA_SERVER_KEY` | Server key for auth | `prod-server-key` | Generate random key |
| `SESSION_ENCRYPTION_KEY` | Session encryption | `base64-random-key` | 32+ bytes, random |
| `REFRESH_ENCRYPTION_KEY` | Token refresh encryption | `base64-random-key` | 32+ bytes, random |

### Optional Variables

| Variable | Description | Default | Production Notes |
|----------|-------------|---------|------------------|
| `LOG_LEVEL` | Logging verbosity | `warn` | Use `error` in production |
| `METRICS_NAMESPACE` | Metrics namespace | `nakama` | Customize if needed |
| `PROMETHEUS_PORT` | Prometheus port | `9100` | Keep internal |

### Generating Secure Keys

```bash
# Generate encryption keys
openssl rand -base64 32
# Output: secure-base64-key-for-production
```

## Database Migration Process

### Pre-Migration Steps

1. **Backup Current Database**
   ```bash
   # Create backup
   pg_dump -U postgres -h localhost -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump nakama
   ```

2. **Test Migration**
   - Set up staging environment
   - Apply migrations to staging database
   - Verify application works correctly

### Migration Execution

1. **Stop Services**
   ```bash
   # Stop Nakama and backend
   sudo systemctl stop nakama
   sudo systemctl stop armored-archer-backend
   ```

2. **Apply Migrations**
   ```bash
   # Run migrations
   docker exec -it armored_archer_server /nakama/nakama migrate up
   ```

3. **Verify Migration**
   ```bash
   # Check migration status
   docker exec -it armored_archer_server /nakama/nakama migrate status
   ```

4. **Start Services**
   ```bash
   # Start services
   sudo systemctl start nakama
   sudo systemctl start armored-archer-backend
   ```

### Rollback Procedure

If migration fails:

1. **Restore Backup**
   ```bash
   # Restore from backup
   pg_restore -U postgres -h localhost -d nakama -c -v backup_file.dump
   ```

2. **Restart Services**
   ```bash
   sudo systemctl restart nakama
   sudo systemctl restart armored-archer-backend
   ```

## Backup and Restore Procedures

### Automated Backups

Create `/etc/cron.daily/nakama-backup`:

```bash
#!/bin/bash

# Backup script for Nakama database
BACKUP_DIR="/var/backups/nakama"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.dump"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database backup
pg_dump -U nakama_user -h localhost -F c -b -v -f "$BACKUP_FILE" nakama

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.dump" -mtime +7 -delete

# Compress old backups
echo "Backup completed: $BACKUP_FILE"
```

### Manual Backup

```bash
# Create manual backup
pg_dump -U nakama_user -h localhost -F c -b -v -f backup_manual.dump nakama
```

### Restore Procedure

```bash
# Stop services
sudo systemctl stop nakama armored-archer-backend

# Restore from backup
pg_restore -U postgres -h localhost -d nakama -c -v backup_file.dump

# Restart services
sudo systemctl start nakama armored-archer-backend
```

## Monitoring and Alerting Setup

### Prometheus Setup

Install Prometheus:

```bash
# Download and install
wget https://github.com/prometheus/prometheus/releases/download/v2.35.0/prometheus-2.35.0.linux-amd64.tar.gz
tar xvf prometheus-*.tar.gz
mv prometheus-* /opt/prometheus
sudo useradd --no-create-home --shell /bin/false prometheus
```

Create `/etc/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "/etc/prometheus/alert.rules"

scrape_configs:
  - job_name: 'nakama'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 30s

  - job_name: 'backend'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 30s
```

### AlertManager Setup

Create `/etc/prometheus/alert.rules`:

```yaml
groups:
- name: nakama_alerts
  rules:
  - alert: NakamaDown
    expr: up{job="nakama"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Nakama server is down"
      description: "Nakama has been down for more than 5 minutes"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 10% for 10 minutes"
```

### Grafana Dashboard

Import the Nakama dashboard (ID: 13350) and create custom dashboards for:
- Player activity metrics
- Match performance
- Database query performance
- API response times

## Rollback Procedures

### Emergency Rollback Steps

1. **Identify Issue**
   - Check logs: `docker-compose logs -f`
   - Monitor metrics: Grafana dashboard
   - Check application status

2. **Rollback Database**
   ```bash
   # Restore from last known good backup
   pg_restore -U postgres -h localhost -d nakama -c -v latest_backup.dump
   ```

3. **Rollback Application**
   ```bash
   # Revert to previous version
   git checkout previous_version
   docker-compose down
docker-compose up -d
   ```

4. **Verify Recovery**
   - Test API endpoints
   - Check player connectivity
   - Monitor system metrics

### Health Check Scripts

Create `/usr/local/bin/health-check.sh`:

```bash
#!/bin/bash

# Health check for production deployment

# Check Nakama
if ! curl -f http://localhost:7350/ > /dev/null 2>&1; then
    echo "❌ Nakama API is down"
    exit 1
fi

# Check database
if ! pg_isready -U nakama_user -h localhost -d nakama > /dev/null 2>&1; then
    echo "❌ Database is not ready"
    exit 1
fi

# Check backend
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ Backend is down"
    exit 1
fi

echo "✓ All services are healthy"
exit 0
```

## Godot Mobile Deployment

### iOS App Store Submission

#### Prerequisites

- Apple Developer Program membership
- Xcode 14+ installed
- iOS device for testing
- App Store Connect account

#### Export Configuration

1. **Open Project in Godot**
   - File → Export
   - Click "Add...” → iOS

2. **Configure Export Preset**
   - **Binary Format**: .ipa
   - **Engine**: Release
   - **Graphics API**: OpenGL ES 3.0
   - **Device Orientation**: Portrait
   - **App Store Publishing**: Enabled

3. **Code Signing**
   - Select provisioning profile
   - Set bundle identifier: `com.yourcompany.armoredarcher`
   - Set version number and build number

#### Build Process

```bash
# Export iOS project
godot --export iOS --path /path/to/project --export_path ~/Desktop/ArmoredArcher.ipa
```

#### App Store Submission

1. **Archive Build**
   - Open Xcode project
   - Product → Archive
   - Upload to App Store Connect

2. **App Store Connect**
   - Fill in app metadata
   - Upload screenshots
   - Set pricing and availability
   - Submit for review

### Google Play Submission

#### Prerequisites

- Google Play Developer account
- Android Studio installed
- Keystore for signing

#### Export Configuration

1. **Open Project in Godot**
   - File → Export
   - Click "Add...” → Android

2. **Configure Export Preset**
   - **Binary Format**: .apk
   - **Engine**: Release
   - **Graphics API**: OpenGL ES 3.0
   - **Minimum SDK**: API 24
   - **Target SDK**: API 34

3. **Keystore Setup**
   ```bash
   # Create keystore
   keytool -genkey -v -keystore armored-archer.keystore \
     -alias armored-archer -keyalg RSA -keysize 2048 -validity 10000
   ```

#### Build Process

```bash
# Export Android project
godot --export Android --path /path/to/project --export_path ~/Desktop/ArmoredArcher.apk
```

#### Google Play Publishing

1. **Create New Release**
   - Upload APK/AAB file
   - Fill in store listing
   - Set content rating
   - Choose pricing

2. **Release**
   - Internal test track
   - Closed beta testing
   - Production release

### Export Scripts

Create `export-scripts/export-ios.sh`:

```bash
#!/bin/bash

PROJECT_PATH="/path/to/armored-archer"
EXPORT_PATH="$HOME/Desktop/ArmoredArcher_$(date +%Y%m%d_%H%M%S).ipa"

echo "Exporting iOS build..."

godot --export iOS --path "$PROJECT_PATH" --export_path "$EXPORT_PATH"

if [ $? -eq 0 ]; then
    echo "✅ iOS build exported to: $EXPORT_PATH"
else
    echo "❌ iOS export failed"
    exit 1
fi
```

Create `export-scripts/export-android.sh`:

```bash
#!/bin/bash

PROJECT_PATH="/path/to/armored-archer"
EXPORT_PATH="$HOME/Desktop/ArmoredArcher_$(date +%Y%m%d_%H%M%S).apk"
KEYSTORE_PATH="/path/to/armored-archer.keystore"

echo "Exporting Android build..."

godot --export Android --path "$PROJECT_PATH" --export_path "$EXPORT_PATH" \
    --keystore "$KEYSTORE_PATH" --keystore-user armored-archer --keystore-password "your-password"

if [ $? -eq 0 ]; then
    echo "✅ Android build exported to: $EXPORT_PATH"
else
    echo "❌ Android export failed"
    exit 1
fi
```

## Deployment Scripts

### Production Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash

# Production deployment script for Armored Archer

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_PATH="/path/to/armored-archer"
BACKUP_DIR="/var/backups/armored-archer"
LOG_FILE="/var/log/armored-archer/deploy.log"

echo "🚀 Armored Archer Production Deployment"
echo "======================================"

# Backup current version
CURRENT_VERSION=$(git rev-parse --short HEAD)
echo "Backing up current version: $CURRENT_VERSION"

# Create backup directory
mkdir -p "$BACKUP_DIR/$CURRENT_VERSION"

# Backup database
if pg_dump -U nakama_user -h localhost -F c -b -v -f "$BACKUP_DIR/$CURRENT_VERSION/database.dump" nakama; then
    echo "✅ Database backup completed"
else
    echo "❌ Database backup failed"
    exit 1
fi

# Pull latest changes
cd "$PROJECT_PATH"
echo "Pulling latest changes..."
if git pull origin main; then
    echo "✅ Latest changes pulled"
else
    echo "❌ Git pull failed"
    exit 1
fi

# Install dependencies
if npm install; then
    echo "✅ Dependencies installed"
else
    echo "❌ Dependency installation failed"
    exit 1
fi

# Build backend
if npm run build; then
    echo "✅ Backend built successfully"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Run migrations
if docker exec -it armored_archer_server /nakama/nakama migrate up; then
    echo "✅ Database migrations completed"
else
    echo "❌ Database migration failed"
    exit 1
fi

# Restart services
if docker-compose down && docker-compose up -d; then
    echo "✅ Services restarted successfully"
else
    echo "❌ Service restart failed"
    exit 1
fi

# Health check
if ./health-check.sh; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "New version: $(git rev-parse --short HEAD)"
```

### Staging Deployment Script

Create `deploy-staging.sh`:

```bash
#!/bin/bash

# Staging deployment script for Armored Archer

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_PATH="/path/to/armored-archer"
STAGING_ENV="staging"

echo "📥 Armored Archer Staging Deployment"
echo "======================================"

# Switch to staging environment
cd "$PROJECT_PATH"
echo "Setting NODE_ENV to $STAGING_ENV"
export NODE_ENV="$STAGING_ENV"

# Pull latest changes
echo "Pulling latest changes..."
if git pull origin main; then
    echo "✅ Latest changes pulled"
else
    echo "❌ Git pull failed"
    exit 1
fi

# Install dependencies
if npm install; then
    echo "✅ Dependencies installed"
else
    echo "❌ Dependency installation failed"
    exit 1
fi

# Build backend
if npm run build; then
    echo "✅ Backend built successfully"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Run migrations
if docker exec -it armored_archer_server /nakama/nakama migrate up; then
    echo "✅ Database migrations completed"
else
    echo "❌ Database migration failed"
    exit 1
fi

# Restart services
if docker-compose down && docker-compose up -d; then
    echo "✅ Services restarted successfully"
else
    echo "❌ Service restart failed"
    exit 1
fi

# Health check
if ./health-check.sh; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

echo "🎉 Staging deployment completed successfully!"
echo "Version: $(git rev-parse --short HEAD)"
```

## Security Best Practices

### Data Protection

1. **Encryption at Rest**
   - Use PostgreSQL encryption for sensitive data
   - Encrypt session tokens
   - Secure API keys

2. **Network Security**
   - Use firewall rules
   - Implement rate limiting
   - Use HTTPS everywhere

3. **Access Control**
   - Principle of least privilege
   - Regular access reviews
   - Multi-factor authentication

### Monitoring Security

1. **Intrusion Detection**
   - Monitor failed login attempts
   - Track unusual API patterns
   - Set up security alerts

2. **Vulnerability Scanning**
   - Regular security audits
   - Dependency vulnerability checks
   - Penetration testing

## Troubleshooting Guide

### Common Issues

1. **Database Connection Issues**
   - Check PostgreSQL status: `sudo systemctl status postgresql`
   - Verify connection string in environment
   - Check firewall rules

2. **Nakama Service Not Starting**
   - Check logs: `docker-compose logs nakama`
   - Verify configuration file
   - Check port conflicts

3. **API Authentication Errors**
   - Verify server key
   - Check environment variables
   - Test authentication endpoints

### Performance Issues

1. **High Database Load**
   - Check slow queries
   - Optimize indexes
   - Consider read replicas

2. **Memory Issues**
   - Monitor memory usage
   - Adjust connection pool size
   - Add more RAM if needed

3. **Network Latency**
   - Check network configuration
   - Use CDN for static assets
   - Optimize API responses

## Emergency Contacts

- **Database Administrator**: DBA@company.com
- **Backend Developer**: Dev@company.com
- **DevOps Engineer**: DevOps@company.com
- **Security Team**: Security@company.com

## Documentation Links

- [Nakama Documentation](https://heroiclabs.com/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Godot Export Documentation](https://docs.godotengine.org/en/stable/tutorials/export/index.html)

---

**Last Updated**: $(date)
**Version**: 1.0
**Author**: Armored Archer Team