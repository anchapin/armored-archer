# Go Module Deployment Guide
**Armored Archer - Alpha Deployment**
**Version**: 2.1.0-alpha
**Last Updated**: 2026-03-16

---

## Overview

This guide covers the deployment of the Go backend module to the Nakama server for the alpha environment.

---

## Prerequisites

### System Requirements

- **Go**: 1.21 or higher
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.0 or higher
- **SSH Access**: To alpha server with deploy user

### Required Tools

```bash
# Verify Go installation
go version

# Verify Docker installation
docker --version
docker-compose --version

# Verify SSH access
ssh -i ~/.ssh/id_ed25519 deploy@alpha.armored-archer.com
```

### Environment Setup

1. **Copy environment file**:
   ```bash
   cd backend
   cp .env.alpha.example .env.alpha
   ```

2. **Edit `.env.alpha`** with alpha-specific values:
   - Generate unique encryption keys (32+ characters)
   - Set strong database password
   - Configure Nakama console credentials
   - Update server URLs and API keys

3. **Generate encryption keys**:
   ```bash
   # Generate secure random keys
   openssl rand -base64 32  # Use for SESSION_ENCRYPTION_KEY
   openssl rand -base64 32  # Use for REFRESH_ENCRYPTION_KEY
   openssl rand -base64 32  # Use for TOKEN_ENCRYPTION_KEY
   ```

---

## Deployment Steps

### Step 1: Build Go Module

```bash
cd backend

# Build for production
./scripts/build-production.sh

# Expected output:
# [INFO] Go version: go1.21.x
# [STEP] Building Go module with production optimizations...
# [SUCCESS] Build Successful!
# Output: build/server.so
# Size:   9.4M
```

**Verification**:
- Binary created: `build/server.so`
- File type: ELF 64-bit LSB shared object
- Size: 9-10MB

### Step 2: Pre-Deployment Checks

```bash
# Run pre-deployment checklist
./scripts/pre-deployment-check.sh

# Manual checks:
# 1. Verify Go module compiles
go build -buildmode=plugin -o /dev/null ./cmd/server

# 2. Check dependencies
go mod verify

# 3. Run tests
go test ./...
```

### Step 3: Transfer to Alpha Server

#### Option A: Automated Deployment (Recommended)

```bash
# Deploy to alpha server
./scripts/deploy-alpha.sh

# With custom server/user:
./scripts/deploy-alpha.sh -s alpha.server.com -u deploy -p 22
```

#### Option B: Manual Deployment

```bash
# Transfer module
scp build/server.so deploy@alpha.armored-archer.com:/opt/nakama/modules/

# SSH to server
ssh deploy@alpha.armored-archer.com

# Set permissions
sudo chmod 755 /opt/nakama/modules/server.so
sudo chown nakama:nakama /opt/nakama/modules/server.so

# Verify checksum
sha256sum /opt/nakama/modules/server.so
```

### Step 4: Update Nakama Configuration

#### Docker Deployment (Recommended)

```bash
cd backend

# Start with alpha configuration
docker-compose -f docker-compose.yml -f docker-compose.alpha.yml up -d

# View logs
docker-compose logs -f nakama
```

#### Systemd Deployment (Bare Metal)

1. **Update Nakama config** (`/etc/nakama/config.yml`):
   ```yaml
   runtime:
     go_entrypoint: /opt/nakama/modules/server.so
   ```

2. **Restart Nakama**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart nakama
   sudo systemctl status nakama
   ```

### Step 5: Verify Deployment

```bash
# Check Nakama logs
docker-compose logs nakama | grep -i "armored"

# Expected output:
# "=== Armored Archer Backend Initializing ==="
# "Configuration loaded successfully"
# "RPC handlers registered"
# "=== Armored Archer Backend Ready ==="

# Run verification script
./scripts/verify-module-load.sh

# Check health endpoint
curl http://localhost:7350/health

# Expected: {"status":"ok"}
```

### Step 6: Health Check

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Manual health checks:
# 1. Health endpoint
curl -f http://localhost:7350/health

# 2. API responsiveness
curl -f -H "Authorization: Basic $(echo -n 'defaultkey:' | base64)" \
  http://localhost:7350/v2/storage

# 3. Check Nakama status
docker-compose ps nakama
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment name | `alpha` | Yes |
| `NAKAMA_SERVER_KEY` | Server authentication key | - | Yes |
| `NAKAMA_CONSOLE_PASSWORD` | Console admin password | - | Yes |
| `DATABASE_ADDRESS` | PostgreSQL connection string | - | Yes |
| `SESSION_ENCRYPTION_KEY` | Session token encryption | - | Yes |
| `REFRESH_ENCRYPTION_KEY` | Refresh token encryption | - | Yes |
| `TOKEN_ENCRYPTION_KEY` | Token encryption | - | Yes |
| `LOG_LEVEL` | Logging verbosity | `INFO` | No |
| `ALLOW_HOST_LOOPBACK` | Allow localhost | `false` | No |

### Nakama Configuration

```yaml
runtime:
  go_entrypoint: modules/server.so  # Go module path
  js_entrypoint: ""                 # Disable JS
  ts_entrypoint: ""                 # Disable TypeScript

socket:
  server_key: ${NAKAMA_SERVER_KEY}
  port: 7350

session:
  expiry_sec: 7200
  refresh_encryption_key: ${REFRESH_ENCRYPTION_KEY}
  token_encryption_key: ${TOKEN_ENCRYPTION_KEY}

logger:
  level: INFO
  format: json
  output: stdout
```

---

## Troubleshooting

### Build Issues

**Problem**: Build fails with CGO errors
```
Solution: Ensure CGO is enabled
export CGO_ENABLED=1
```

**Problem**: Wrong architecture
```
Solution: Set correct GOARCH
export GOARCH=amd64
export GOOS=linux
```

### Deployment Issues

**Problem**: Module not loading
```
Check: Nakama logs for errors
docker-compose logs nakama | grep -i error

Check: Module file permissions
ls -la /opt/nakama/modules/server.so
```

**Problem**: Permission denied
```
Solution: Set correct ownership
sudo chown nakama:nakama /opt/nakama/modules/server.so
```

### Runtime Issues

**Problem**: RPC handlers not registering
```
Check: Module initialization logs
docker-compose logs nakama | grep "RPC"

Check: Go module entry point
grep "InitModule" build/server.so
```

**Problem**: Database connection failed
```
Check: DATABASE_ADDRESS environment variable
docker-compose exec nakama env | grep DATABASE

Check: PostgreSQL is running
docker-compose ps postgres
```

---

## Rollback Procedure

If deployment fails, rollback to previous version:

### Docker Deployment

```bash
# Stop current deployment
docker-compose -f docker-compose.yml -f docker-compose.alpha.yml down

# Restore previous module version
ssh deploy@alpha.armored-archer.com
sudo cp /opt/nakama/modules/server.so.backup.* /opt/nakama/modules/server.so
sudo systemctl restart nakama

# Or revert to TypeScript module
docker-compose up -d
```

### Systemd Deployment

```bash
# Stop Nakama
sudo systemctl stop nakama

# Restore backup
sudo cp /opt/nakama/modules/server.so.backup.YYYYMMDD_HHMMSS /opt/nakama/modules/server.so

# Restart Nakama
sudo systemctl start nakama
sudo systemctl status nakama
```

---

## Post-Deployment Verification

### Automated Verification

```bash
# Run all verification checks
./scripts/verify-module-load.sh
./scripts/health-check.sh
```

### Manual Verification

1. **Check module loaded**:
   ```bash
   docker-compose logs nakama | grep "Armored Archer Backend Ready"
   ```

2. **Test RPC endpoint**:
   ```bash
   curl -X POST http://localhost:7350/v2/session/authenticate \
     -u "defaultkey:" \
     -H "Content-Type: application/json" \
     -d '{"custom": {"id": "test_user"}}'
   ```

3. **Verify metrics**:
   ```bash
   curl http://localhost:9100/metrics | grep armored_archer
   ```

4. **Check active connections**:
   ```bash
   docker-compose exec nakama netstat -an | grep 7350
   ```

---

## Security Checklist

- [ ] All default passwords changed
- [ ] Encryption keys are unique (32+ characters)
- [ ] Database credentials are secure
- [ ] SSH access restricted to deploy user
- [ ] Firewall rules configured
- [ ] HTTPS enabled (if applicable)
- [ ] Rate limiting configured
- [ ] Monitoring and alerting active

---

## Support

For issues or questions:
- Check logs: `docker-compose logs -f nakama`
- Review documentation: `/docs/`
- Contact: ops@armored-archer.com

---

**Document Version**: 1.0
**Last Reviewed**: 2026-03-16
**Next Review**: 2026-04-16
