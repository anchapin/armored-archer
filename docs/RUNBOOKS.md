# Runbooks

This document provides step-by-step operational procedures for common tasks in the Armored Archer project, including failure scenario runbooks, troubleshooting steps for critical components, escalation paths, and contact information. These runbooks are designed to help developers and operators quickly respond to incidents and handle common issues.

## Table of Contents

- [Quick Access - Critical Incidents](#quick-access---critical-incidents)
- [Failure Scenario Runbooks](#failure-scenario-runbooks)
  - [Critical (Immediate Action)](#critical-immediate-action)
  - [Warning (Attention Required)](#warning-attention-required)
  - [Security Incidents](#security-incidents)
- [Escalation Paths](#escalation-paths)
- [Contact Information](#contact-information)
- [Backend Operations](#backend-operations)
- [Database Operations](#database-operations)
- [Development Operations](#development-operations)
- [Game Export Operations](#game-export-operations)
- [Monitoring and Logs](#monitoring-and-logs)
- [Troubleshooting](#troubleshooting)

---

## Quick Access - Critical Incidents

| Incident Type | Severity | Response Time | Go To Section |
|---------------|----------|---------------|---------------|
| Game Server Down | Critical | 15 min | [Game Server Down](#game-server-down) |
| Database Down | Critical | 15 min | [Database Down](#database-down) |
| Payment Failures | Critical | 15 min | [Payment Processing Failures](#payment-processing-failures) |
| High Error Rate | Critical | 15 min | [High Error Rate](#high-error-rate) |
| Connection Pool Exhausted | Critical | 15 min | [Database Connection Pool Exhausted](#database-connection-pool-exhausted) |
| Suspicious Login Activity | Critical | 15 min | [Suspicious Login Activity](#suspicious-login-activity) |

---

## Failure Scenario Runbooks

### Critical (Immediate Action)

#### Game Server Down

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** Game Server (Nakama)

**Symptoms:**
- Players cannot connect to the game
- `GameServerDown` alert triggered (up{job="nakama"} == 0 for 1m)
- Nakama server not responding on port 7350

**Diagnosis:**
```bash
# 1. Check if Nakama container is running
docker ps | grep nakama

# 2. Check container status and restarts
docker inspect armored_archer_server | grep -E "(State|RestartCount)"

# 3. View recent logs for errors
docker logs armored_archer_server --tail 100

# 4. Check system resources
docker stats armored_archer_server

# 5. Verify ports are available
lsof -i :7350
lsof -i :7351
```

**Resolution Steps:**

1. **If container not running:**
   ```bash
   # Start the backend
   cd backend
   docker-compose up -d

   # Verify it starts
   docker ps | grep nakama
   sleep 10
   curl -s http://localhost:7350
   ```

2. **If container running but not responding:**
   ```bash
   # Restart the Nakama service
   docker-compose restart server

   # Check logs during restart
   docker logs -f armored_archer_server
   ```

3. **If container keeps crashing:**
   ```bash
   # Check for OOM (Out of Memory) kills
   dmesg | grep -i "killed process"

   # Check disk space
   df -h

   # Review recent configuration changes
   git log --oneline -10 backend/
   ```

4. **If after deployment:**
   ```bash
   # Check for recent changes
   git log --oneline -5

   # Consider rollback if issues started after deployment
   # (deployment-specific rollback commands)
   ```

**Escalation:**
- If not resolved within 15 minutes → Escalate to Secondary On-Call
- If not resolved within 30 minutes → Escalate to Team Lead
- If data loss suspected → Contact Database Lead immediately

**Post-Incident:**
- Document timeline in incident report
- Update runbook if new failure pattern discovered
- Schedule post-mortem for significant incidents

---

#### Database Down

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** Database (PostgreSQL)

**Symptoms:**
- All game operations fail
- `DatabaseDown` alert triggered (up{job="postgres"} == 0 for 1m)
- Database connection errors in Nakama logs

**Diagnosis:**
```bash
# 1. Check if PostgreSQL container is running
docker ps | grep postgres

# 2. Check database health
docker exec armored_archer_postgres pg_isready -U postgres

# 3. View database logs
docker logs armored_archer_postgres --tail 100

# 4. Check disk space for database volume
docker exec armored_archer_postgres df -h
```

**Resolution Steps:**

1. **If container not running:**
   ```bash
   # Start the backend (includes database)
   cd backend
   docker-compose up -d postgres

   # Wait for PostgreSQL to be ready
   sleep 15
   docker exec armored_archer_postgres pg_isready -U postgres
   ```

2. **If container running but not ready:**
   ```bash
   # Restart PostgreSQL
   docker-compose restart postgres

   # Wait and verify
   sleep 10
   docker exec armored_archer_postgres pg_isready -U postgres
   ```

3. **If database corrupted (check logs for corruption):**
   ```bash
   # Check for corruption
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT 1;"

   # If tables corrupted, may need to restore from backup
   # Contact DevOps Lead for backup restoration
   ```

4. **If disk full:**
   ```bash
   # Check disk usage
   docker exec armored_archer_postgres df -h

   # Clean up old logs
   docker exec armored_archer_postgres pg_archivecleanup

   # If critical, extend disk space (cloud provider specific)
   ```

**Escalation:**
- If not resolved within 15 minutes → Escalate to Secondary On-Call
- If data loss suspected → Contact Database Lead + Team Lead immediately
- External dependency failure (cloud) → Contact DevOps Lead

---

#### High Error Rate

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** API

**Symptoms:**
- Error rate > 5% over 5 minutes
- `HighErrorRate` alert triggered
- Players experiencing failed operations

**Diagnosis:**
```bash
# 1. Check current error rate in Grafana
# Dashboard: http://localhost:3000 (or production URL)
# Look for: armored_archer_error_rate_5m

# 2. View recent backend logs for errors
docker logs armored_archer_server --tail 200 | grep -iE "(error|exception|fail)"

# 3. Check specific error types
docker logs armored_archer_server 2>&1 | grep -oP "error: \K.*" | sort | uniq -c | sort -rn

# 4. Check recent deployments
git log --oneline -10
```

**Resolution Steps:**

1. **Identify error pattern:**
   ```bash
   # Get top errors
   docker logs armored_archer_server 2>&1 | grep -E "(Error|Exception)" | tail -50
   ```

2. **If recent deployment caused it:**
   ```bash
   # Rollback to previous version
   # (deployment-specific rollback command)
   
   # Or revert specific commit
   git revert <commit-hash>
   ```

3. **If database issue:**
   ```bash
   # Check database connection
   docker exec armored_archer_server curl -s http://localhost:7350
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT 1;"
   ```

4. **If external service issue:**
   ```bash
   # Check Nakama status
   curl -s http://localhost:7350
   
   # Check external APIs (payment, etc.)
   # Ping external endpoints
   ```

5. **If unknown cause:**
   ```bash
   # Restart server to clear potential state issues
   docker-compose restart server
   
   # Monitor for improvement
   watch -n 5 'docker logs armored_archer_server --tail 20 | grep -i error'
   ```

**Communication:**
- Post in `#armored-archer-critical` Slack channel
- Update status every 15 minutes
- If sustained > 30 minutes → Create incident ticket

---

#### Database Connection Pool Exhausted

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** Database

**Symptoms:**
- New connections to database fail
- `DatabaseConnectionPoolExhausted` alert triggered (>90% connections)
- "Too many connections" errors in logs

**Diagnosis:**
```bash
# 1. Check current connection count
docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Check active connections by state
docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# 3. Check long-running queries
docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT pid, usename, query_start, query FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# 4. Check Nakama connection config
grep -i "database" backend/nakama.yml
```

**Resolution Steps:**

1. **Kill long-running queries (if safe):**
   ```bash
   # Get PID of long-running query
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT pid, query FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
   
   # Kill if needed (replace <pid>)
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT pg_terminate_backend(<pid>);"
   ```

2. **Restart Nakama to clear connections:**
   ```bash
   docker-compose restart server
   ```

3. **If recurring, increase pool size:**
   ```yaml
   # In nakama.yml
   database:
     max_connections: 200  # Increase from default
     max_idle_connections: 20
   ```

4. **Identify leak source:**
   ```bash
   # Check for connection leaks in code
   grep -r "Acquire" backend/src/
   
   # Monitor connection growth
   watch -n 5 'docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT count(*) FROM pg_stat_activity;"'
   ```

---

#### Payment Processing Failures

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** Payments

**Symptoms:**
- Players cannot make purchases
- `PaymentProcessingFailures` alert triggered
- Revenue drops to zero

**Diagnosis:**
```bash
# 1. Check payment gateway status
# - Stripe: https://status.stripe.com
# - RevenueCat: https://status.revenuecat.com

# 2. Check API keys are valid
docker logs armored_archer_server | grep -i "payment" | tail -20

# 3. Check for configuration issues
grep -i "stripe\|revenuecat" backend/nakama.yml
```

**Resolution Steps:**

1. **If payment gateway down:**
   ```bash
   # Monitor for resolution
   # No action needed - wait for provider
   
   # Notify players via in-game message if sustained
   ```

2. **If API key issue:**
   ```bash
   # Verify keys in environment/secrets
   # Check for expired/invalid keys
   
   # Rotate keys if compromised (with Security Lead)
   ```

3. **If configuration issue:**
   ```bash
   # Review payment configuration
   cat backend/nakama.yml | grep -A 10 payment
   
   # Restart server after config change
   docker-compose restart server
   ```

4. **If sandbox/test mode enabled in production:**
   ```bash
   # Check environment variables
   env | grep -i "stripe\|revenuecat\|payment"
   
   # Fix to production mode
   # Restart server
   ```

**Communication:**
- Post in `#armored-archer-critical` immediately
- Notify Product Lead
- If revenue impact > 1 hour → Notify Finance

---

### Warning (Attention Required)

#### High Memory Usage

**Severity:** Warning | **Response SLA:** 30 minutes | **Component:** Infrastructure

**Symptoms:**
- Memory usage > 85%
- `HighMemoryUsage` alert triggered
- System may become unresponsive

**Diagnosis:**
```bash
# 1. Check memory usage
docker stats armored_archer_server

# 2. Check system memory
free -h

# 3. Check for memory leaks in logs
docker logs armored_archer_server --tail 100 | grep -iE "(out of memory|oom)"
```

**Resolution Steps:**

1. **If container using high memory:**
   ```bash
   # Restart Nakama to clear memory
   docker-compose restart server
   
   # Monitor memory after restart
   watch -n 5 'docker stats armored_archer_server --no-stream'
   ```

2. **If memory keeps growing:**
   ```bash
   # Check for memory leak
   # Look at memory trend over time in Grafana
   
   # May need to restart regularly until fix found
   # Set up more aggressive restart schedule temporarily
   ```

3. **If system-level memory issue:**
   ```bash
   # Check for other processes using memory
   docker stats --no-stream
   
   # Consider adding more memory to host
   ```

---

#### High CPU Usage

**Severity:** Warning | **Response SLA:** 30 minutes | **Component:** Infrastructure

**Symptoms:**
- CPU usage > 80%
- `HighCPUUsage` alert triggered
- Game operations slow

**Diagnosis:**
```bash
# 1. Check CPU usage
docker stats armored_archer_server

# 2. Check for runaway processes
docker exec armored_archer_server top

# 3. Check for computational intensive operations
docker logs armored_archer_server --tail 50
```

**Resolution Steps:**

1. **If temporary spike:**
   ```bash
   # Monitor for auto-recovery
   watch -n 5 'docker stats armored_archer_server --no-stream'
   ```

2. **If sustained high CPU:**
   ```bash
   # Identify the process
   docker exec armored_archer_server ps aux
   
   # Check for runaway queries
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT pid, query FROM pg_stat_activity WHERE state = 'active';"
   
   # Kill if safe (with Team Lead approval)
   ```

3. **If due to high load:**
   ```bash
   # Consider scaling (if using orchestrator)
   # Or optimize code
   
   # Monitor in Grafana for patterns
   ```

---

#### Matchmaking Queue Building

**Severity:** Warning | **Response SLA:** 30 minutes | **Component:** Matchmaking

**Symptoms:**
- Players stuck in matchmaking queue > 5 minutes
- `MatchmakingQueueBuilding` alert triggered
- Queue size > 100

**Diagnosis:**
```bash
# 1. Check matchmaking status
docker logs armored_archer_server | grep -i match | tail -20

# 2. Check active matches
docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM matchmaking_matches LIMIT 10;"

# 3. Check matchmaker configuration
grep -i "matchmaker" backend/nakama.yml
```

**Resolution Steps:**

1. **If not enough players:**
   ```bash
   # This is expected during low population times
   # Monitor and wait
   
   # Consider lowering matchmaker thresholds temporarily
   ```

2. **If matchmaking algorithm stuck:**
   ```bash
   # Restart matchmaker
   docker-compose restart server
   
   # Clear stuck queues in database if needed
   docker exec armored_archer_postgres psql -U postgres -d nakama -c "DELETE FROM matchmaking_queue;"
   ```

3. **If configuration issue:**
   ```bash
   # Review matchmaker settings
   # Adjust tick rate, pool sizes, etc.
   # Restart to apply
   ```

---

### Security Incidents

#### Suspicious Login Activity

**Severity:** Critical | **Response SLA:** 15 minutes | **Component:** Authentication

**Symptoms:**
- Failed login rate > 10/minute
- `SuspiciousLoginActivity` alert triggered
- Possible brute force attack

**Diagnosis:**
```bash
# 1. Check failed login patterns
docker logs armored_archer_server | grep -i "login failed" | tail -50

# 2. Identify source IPs
docker logs armored_archer_server | grep -i "login" | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | sort | uniq -c | sort -rn

# 3. Check for targeted accounts
docker logs armored_archer_server | grep -i "login" | grep -oE "user: \K.*" | sort | uniq -c | sort -rn
```

**Resolution Steps:**

1. **Block suspicious IPs:**
   ```bash
   # Block at firewall (if applicable)
   # iptables -A INPUT -s <suspicious_ip> -j DROP
   
   # Or use Nakama configuration
   ```

2. **Enable rate limiting (if not already):**
   ```yaml
   # In nakama.yml
   login:
     max_count: 5
     max_time: 300  # 5 minutes
   ```

3. **Notify affected users (with Security Lead):**
   - Force password reset for targeted accounts
   - Send security notification

4. **If DDoS pattern:**
   ```bash
   # Contact cloud provider for DDoS mitigation
   # Enable additional rate limiting
   ```

**Communication:**
- Post in `#security-incidents` immediately
- Contact Security Lead immediately
- Document all IPs and accounts affected

---

#### Unusual API Call Pattern

**Severity:** Warning | **Response SLA:** 30 minutes | **Component:** API

**Symptoms:**
- API request rate > 1000 req/min
- `UnusualAPICallPattern` alert triggered
- Possible bot activity or DDoS

**Diagnosis:**
```bash
# 1. Check request patterns in Grafana
# Look for: armored_archer_request_rate

# 2. Identify top endpoints
docker logs armored_archer_server | grep -oE "GET /api/.*|POST /api/.*|RPC .*" | sort | uniq -c | sort -rn | head -20

# 3. Check source IPs
docker logs armored_archer_server | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | sort | uniq -c | sort -rn | head -10
```

**Resolution Steps:**

1. **If bot activity:**
   ```bash
   # Block suspicious IPs
   # Implement stricter rate limiting
   
   # Enable bot detection if available
   ```

2. **If legitimate spike (marketing, event):**
   ```bash
   # Scale services if possible
   # Monitor for degradation
   
   # Pre-approve with Product Lead
   ```

3. **If DDoS:**
   ```bash
   # Enable cloud DDoS protection
   # Contact DevOps Lead immediately
   
   # Implement emergency rate limiting
   ```

---

## Escalation Paths

### Severity-Based Escalation

| Severity | First Ack | Resolution Target | Escalation Path |
|----------|-----------|-------------------|-----------------|
| **Critical** | 15 min | 1 hour | Primary → Secondary → Team Lead → Department Head |
| **Warning** | 30 min | 4 hours | Primary → Secondary → Team Lead |
| **Info** | 24 hours | N/A | Add to weekly review |

### Escalation Flow

```
ALERT TRIGGERED
      │
      ▼
┌───────────────────────┐
│   Primary On-Call     │
│   (15 min - Critical) │
│   (30 min - Warning)  │
└───────────────────────┘
      │ No Ack / No Resolution
      ▼
┌───────────────────────┐
│  Secondary On-Call    │
│   (10 min after)      │
└───────────────────────┘
      │ No Ack / No Resolution
      ▼
┌───────────────────────┐
│   Team Lead          │
│   (10 min after)     │
└───────────────────────┘
      │ No Ack / No Resolution
      ▼
┌───────────────────────┐
│   Department Head     │
│   (10 min after)     │
└───────────────────────┘
```

### Who to Contact

| Issue Type | Primary Contact | Secondary Contact |
|------------|-----------------|-------------------|
| Game Server | Backend Lead | DevOps Lead |
| Database | DevOps Lead | Backend Lead |
| Payments | Backend Lead | Product Lead |
| Security | Security Lead | DevOps Lead |
| Client/Gameplay | Product Lead | Frontend Lead |

---

## Contact Information

### Internal Team

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Backend Lead | [Name] | +1-XXX-XXX-XXXX | backend-lead@armored-archer.example.com | @backend-lead |
| DevOps Lead | [Name] | +1-XXX-XXX-XXXX | devops@armored-archer.example.com | @devops |
| Security Lead | [Name] | +1-XXX-XXX-XXXX | security@armored-archer.example.com | @security-lead |
| Product Lead | [Name] | +1-XXX-XXX-XXXX | product@armored-archer.example.com | @product-lead |

### External Contacts

| Service | Contact | URL |
|---------|---------|-----|
| AWS Support | [Account] | console.aws.amazon.com/support |
| Nakama Support | Heroic Labs | heroiclabs.com/support |
| Stripe Support | [Account] | dashboard.stripe.com/support |
| RevenueCat Support | [Account] | app.revenuecat.com/support |
| PagerDuty Support | [Account] | support.pagerduty.com |

### Slack Channels

| Channel | Purpose |
|---------|---------|
| #armored-archer-critical | Critical incident communication |
| #armored-archer-warnings | Warning-level alerts |
| #security-incidents | Security-related incidents |
| #armored-archer-alerts | All alerts (read-only for awareness) |

---

## Backend Operations

### Starting the Backend

Start the Nakama backend with Docker Compose.

```bash
# Using Makefile
make backend-start

# Or directly with Docker Compose
cd backend
docker-compose up -d
```

**Expected Output:**
```
Starting Nakama backend...
Nakama started: http://localhost:7350
Admin Console: http://localhost:7351 (admin:password)
```

**Verification:**
- Wait 10-15 seconds for services to initialize
- Access Nakama Console at http://localhost:7351
- Login with credentials: `admin` / `password`

---

### Stopping the Backend

Stop all backend services gracefully.

```bash
# Using Makefile
make backend-stop

# Or directly with Docker Compose
cd backend
docker-compose down
```

**Options:**
- `docker-compose down` - Stops containers but preserves data
- `docker-compose down -v` - Stops and removes volumes (destroys data)
- `docker-compose down --remove-orphans` - Removes orphaned containers

---

### Restarting Backend Services

Restart all backend services.

```bash
# Restart all services
cd backend
docker-compose restart

# Restart specific service
docker-compose restart server
docker-compose restart postgres
```

**Note:** Restarting the server will disconnect all connected clients.

---

### Checking Backend Status

Check if backend services are running.

```bash
# Using Docker
docker ps

# Expected output should show:
# - armored_archer_server (Nakama)
# - armored_archer_postgres (PostgreSQL)
```

---

## Database Operations

### Running Migrations

Apply pending database migrations.

**Prerequisites:**
- Backend must be running (`make backend-start`)

```bash
# Using Makefile
make backend-migrate

# Or directly with Docker
docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres://postgres:localdbpassword@postgres:5432/nakama
```

**Verification:**
```bash
# Check applied migrations
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM schema_migrations;"
```

---

### Creating New Migrations

Create a new database migration file.

```bash
# Using Makefile (interactive)
make backend-migrate-new

# Or manually create migration file
touch backend/data/002_new_migration_name.sql
```

**Manual Migration Template:**
```sql
--- Migration: your_migration_name
--- Created: 2024-01-01

BEGIN;

--- Add your SQL here
--- Example: CREATE TABLE IF NOT EXISTS example_table (
---     id SERIAL PRIMARY KEY,
---     name VARCHAR(255) NOT NULL
--- );

COMMIT;
```

**Naming Convention:**
- Format: `{number}_{migration_name}.sql`
- Use incremental numbers starting from existing migrations
- Use snake_case for migration names

---

### Viewing Database Schema

View current database tables and schema.

```bash
# Using Makefile
make backend-db-schema

# Or directly with Docker
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'
```

**View Table Details:**
```bash
# View specific table schema
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d table_name'

# List all tables with row counts
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;"
```

---

### Accessing the Database Directly

Connect to PostgreSQL for direct queries.

```bash
# Connect to PostgreSQL container
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Useful psql commands:
# \dt          - List all tables
# \d table     - Describe table
# \l           - List databases
# \q           - Quit

# Example queries:
SELECT * FROM users LIMIT 10;
SELECT * FROM storage WHERE collection = 'player_data';
```

---

## Development Operations

### Setting Up Development Environment

Install all dependencies and set up the development environment.

```bash
# Using Makefile
make setup

# This will:
# 1. Install backend npm dependencies
# 2. Display next steps
```

**Manual Setup:**
```bash
# Install backend dependencies
cd backend
npm install

# Verify installation
npm --version
node --version
```

---

### Running Backend in Development Mode

Start the backend with auto-reload for development.

```bash
# Using Makefile
make backend-dev

# Or directly
cd backend
npm run dev
```

**Note:** The backend will automatically reload when TypeScript files change.

---

### Running Tests

Run backend unit and integration tests.

```bash
# Run all tests
make backend-test

# Or directly
cd backend
npm test

# Run specific test file
cd backend
npm test -- --testPathPattern=test_file_name

# Run tests with coverage
cd backend
npm test -- --coverage
```

**Test Configuration:**
- Unit tests: `backend/tests/unit/`
- Integration tests: `backend/tests/integration/`
- Test results: `backend/test-results.txt`
- Coverage report: `backend/coverage/`

---

### Building the Backend

Build the TypeScript backend for production.

```bash
# Using Makefile
make backend-build

# Or directly
cd backend
npm run build
```

**Output:**
- Compiled JavaScript: `backend/build/`
- Source maps: `backend/build/*.map`

---

## Game Export Operations

### Exporting for Android

Export the Godot game for Android.

**Using Godot Editor:**
1. Open project in Godot 4.x
2. Go to **Project → Export**
3. Select **Android** preset
4. Configure signing (use `debug.keystore` for development)
5. Click **Export Project**
6. Save as `armored-archer.apk`

**Using Command Line:**
```bash
# Ensure export presets are configured
# Edit export_presets_android.cfg if needed

# Export debug build
godot --headless --export-release "Android" export/android/armored-archer.apk
```

**Verification:**
```bash
# Check APK was created
ls -lh export/android/armored-archer.apk

# Install to connected device
adb install export/android/armored-archer.apk
```

---

### Exporting for iOS

Export the Godot game for iOS (requires macOS with Xcode).

**Using Godot Editor:**
1. Open project in Godot 4.x
2. Go to **Project → Export**
3. Select **iOS** preset
4. Configure bundle identifier and signing
5. Click **Export Project**
6. Save to `export/ios/`

**Requirements:**
- macOS with Xcode installed
- Apple Developer account
- Valid provisioning profile

---

### Creating a Development Build

Create a debug build for testing.

```bash
# Android debug build
godot --headless --export-debug "Android" export/android/armored-archer-debug.apk

# Check the APK
ls -lh export/android/armored-archer-debug.apk
```

**Debug Build Features:**
- Verbose logging enabled
- Console output visible
- Development server connection
- No code obfuscation

---

## Monitoring and Logs

### Viewing Backend Logs

View Nakama server logs in real-time.

```bash
# Follow all backend logs
docker-compose logs -f server

# View recent logs
docker logs --tail 100 armored_archer_server

# View logs with timestamps
docker logs -t armored_archer_server | tail -50
```

**Log Levels:**
```bash
# View only errors
docker logs armored_archer_server 2>&1 | grep -i error

# View warnings and errors
docker logs armored_archer_server 2>&1 | grep -iE "(warn|error)"
```

---

### Viewing Database Logs

View PostgreSQL database logs.

```bash
# Follow database logs
docker-compose logs -f postgres

# View recent logs
docker logs --tail 100 armored_archer_postgres
```

---

### Checking Container Status

Check health and status of all containers.

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Check container health
docker inspect --format='{{.State.Health.Status}}' armored_archer_server

# View container resource usage
docker stats

# View specific container stats
docker stats armored_archer_server armored_archer_postgres
```

---

## Troubleshooting

### Backend Won't Start

**Symptoms:** `make backend-start` fails or containers exit immediately.

**Diagnosis:**
```bash
# Check container status
docker ps -a

# View logs for errors
docker logs armored_archer_server
docker logs armored_archer_postgres
```

**Common Causes and Solutions:**

1. **Port already in use**
   ```bash
   # Find what's using the port
   lsof -i :7350
   lsof -i :7351
   lsof -i :5432

   # Kill the process if needed
   kill <PID>
   ```

2. **Docker not running**
   ```bash
   # Start Docker
   sudo systemctl start docker

   # Or on macOS
   open -a Docker
   ```

3. **Missing environment variables**
   ```bash
   # Check .env file
   cat .env.development

   # Verify required variables
   export NAKAMA_SECRET="your_secret"
   export DATABASE_ADDRESS="postgres://..."
   ```

4. **Volume permission issues**
   ```bash
   # Remove old volumes and restart
   docker-compose down -v
   docker-compose up -d
   ```

---

### Database Connection Failed

**Symptoms:** Backend logs show "database connection refused" or "authentication failed".

**Diagnosis:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test database connectivity
docker exec -it armored_archer_postgres pg_isready -U postgres
```

**Solutions:**

1. **PostgreSQL not ready**
   ```bash
   # Wait for PostgreSQL to start
   sleep 10
   docker-compose restart postgres
   ```

2. **Wrong credentials**
   ```bash
   # Check docker-compose.yml for correct credentials
   # Default: postgres/postgres or postgres/localdbpassword
   ```

3. **Database doesn't exist**
   ```bash
   # Connect to PostgreSQL and create database
   docker exec -it armored_archer_postgres psql -U postgres -c "CREATE DATABASE nakama;"
   ```

---

### Tests Failing

**Symptoms:** `npm test` shows failing tests.

**Diagnosis:**
```bash
# Run tests with verbose output
cd backend
npm test -- --verbose

# Run specific failing test
npm test -- --testPathPattern=failing_test
```

**Common Causes:**

1. **Backend not running**
   ```bash
   make backend-start
   npm test
   ```

2. **Missing dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Database not migrated**
   ```bash
   make backend-migrate
   ```

4. **Environment variables missing**
   ```bash
   # Check test environment setup
   cat backend/.env.test
   ```

---

### Export Fails

**Symptoms:** Godot export fails with errors.

**Diagnosis:**

1. **Check Godot version**
   ```bash
   godot --version
   # Should be 4.x
   ```

2. **Verify export templates**
   ```bash
   # In Godot Editor: Editor → Manage Export Templates
   # Or via command line
   godot --headless --export-templates
   ```

3. **Check export presets**
   ```bash
   # Verify export_presets.cfg is valid
   cat export_presets.cfg
   ```

**Solutions:**

1. **Missing export templates**
   ```bash
   # Download export templates via Godot
   godot --headless --import
   ```

2. **Invalid keystore**
   ```bash
   # Use debug keystore for testing
   # Located at: debug.keystore
   ```

3. **Android SDK issues**
   ```bash
   # Verify Android SDK is installed
   echo $ANDROID_HOME
   ls $ANDROID_HOME
   ```

---

## Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Start backend | `make backend-start` |
| Stop backend | `make backend-stop` |
| Run migrations | `make backend-migrate` |
| Run tests | `make backend-test` |
| Build backend | `make backend-build` |
| View logs | `docker-compose logs -f` |
| Access database | `docker exec -it armored_archer_postgres psql -U postgres -d nakama` |

### Service URLs (Local Development)

| Service | URL | Credentials |
|---------|-----|-------------|
| Nakama Server | http://localhost:7350 | - |
| Nakama Console | http://localhost:7351 | admin:password |
| PostgreSQL | localhost:5432 | postgres:localdbpassword |

### File Locations

| File | Path |
|------|------|
| Backend source | `backend/src/` |
| Database migrations | `backend/data/*.sql` |
| Export presets | `export_presets.cfg` |
| Android APK | `export/android/` |
| Test files | `backend/tests/` |

---

## Related Documentation

- [DEBUGGING.md](../DEBUGGING.md) - Detailed debugging techniques
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment procedures
- [Makefile](../Makefile) - Available development commands
- [backend/README.md](../backend/README.md) - Backend-specific documentation
