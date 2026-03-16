# Grafana Dashboard Import Instructions

**Quick Reference Guide** - Phase 2.2 - Alpha Launch & Stabilization

---

## Quick Start (Recommended)

### Option 1: Auto-Provisioning (Automatic on Startup)

The dashboards are configured to auto-load when Grafana starts.

```bash
# Navigate to backend directory
cd /home/alex/armored-archer/backend

# Copy dashboards to provisioning directory
cp grafana/dashboards/*.json grafana/provisioning/dashboards/

# Start or restart Grafana
docker-compose restart grafana

# Wait 30 seconds for provisioning
sleep 30

# Access Grafana
open http://localhost:3000
```

**Login Credentials** (default):
- Username: `admin`
- Password: `admin`

**Navigate to**: Dashboards → Armored Archer folder

---

### Option 2: Manual Import via UI

If auto-provisioning doesn't work:

1. **Open Grafana**: `http://localhost:3000`

2. **Navigate to Import**:
   - Click **Dashboards** in left sidebar
   - Click **Import** button at top

3. **Import Each Dashboard**:
   - Click **Upload dashboard JSON file**
   - Select one of the JSON files:
     - `backend/grafana/dashboards/01-overview.json`
     - `backend/grafana/dashboards/02-performance.json`
     - `backend/grafana/dashboards/03-business-metrics.json`
     - `backend/grafana/dashboards/04-errors-alerts.json`
   - Click **Upload**
   - Select **Prometheus** as data source
   - Click **Import**
   - Repeat for each dashboard

---

## Detailed Setup Steps

### Step 1: Verify Prerequisites

```bash
# Check if Grafana is running
docker ps | grep grafana

# Check if Prometheus is running
docker ps | grep prometheus

# Verify provisioning directory exists
ls -la backend/grafana/provisioning/
```

**Expected Output**:
```
drwxr-xr-x  dashboards/
drwxr-xr-x  datasources/
```

### Step 2: Copy Dashboard Files

```bash
# Copy all dashboards
cd /home/alex/armored-archer/backend
cp grafana/dashboards/*.json grafana/provisioning/dashboards/

# Verify files were copied
ls -la grafana/provisioning/dashboards/*.json
```

**Expected Files**:
```
01-overview.json
02-performance.json
03-business-metrics.json
04-errors-alerts.json
```

### Step 3: Verify Docker Compose Configuration

Check that `docker-compose.yml` has correct Grafana configuration:

```yaml
grafana:
  image: grafana/grafana:10.1.0
  container_name: armored_archer_grafana
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=admin
  volumes:
    - grafana_data:/var/lib/grafana
    - ./grafana/provisioning:/etc/grafana/provisioning
  ports:
    - "3000:3000"
  depends_on:
    - prometheus
```

### Step 4: Restart Grafana

```bash
# Restart only Grafana
docker-compose restart grafana

# Or restart all services
docker-compose down
docker-compose up -d
```

### Step 5: Verify Provisioning

```bash
# Check Grafana logs for provisioning messages
docker logs armored_archer_grafana 2>&1 | grep -i "dashboard"

# Look for messages like:
# "Loading dashboards from provider"
# "Dashboard loaded: armored-archer-overview"
```

### Step 6: Access Grafana UI

1. Open browser to `http://localhost:3000`
2. Login with admin credentials
3. Click **Dashboards** in left sidebar
4. Look for **Armored Archer** folder
5. Click to expand and see all 4 dashboards

---

## Troubleshooting

### Problem: Dashboards Not Appearing

**Check 1: Verify Files Exist**
```bash
ls -la backend/grafana/provisioning/dashboards/
```

**Check 2: Verify Volume Mount**
```bash
docker inspect armored_archer_grafana | grep -A 10 "Mounts"
```

**Check 3: Check Logs**
```bash
docker logs armored_archer_grafana 2>&1 | tail -50
```

**Check 4: Restart Grafana**
```bash
docker-compose restart grafana
sleep 30
```

### Problem: "No Data" on Panels

**Check 1: Prometheus Connection**
1. In Grafana, go to **Configuration** → **Data Sources**
2. Click **Prometheus**
3. Click **Save & Test**
4. Should see "Data source is working"

**Check 2: Metrics Available**
```bash
# Access Prometheus UI
open http://localhost:9090

# Try querying a metric
armored_archer_health_status
```

**Check 3: Time Range**
- Ensure time range is set to "Last 1 hour" or similar
- Some panels need time to accumulate data

### Problem: Variables Not Populating

**Solution 1: Refresh Dashboard**
- Click refresh button in top right
- Or press `Ctrl + R` (Windows) / `Cmd + R` (Mac)

**Solution 2: Check Metric Labels**
```bash
# In Prometheus, check if metrics have expected labels
label_values(armored_archer_health_status, environment)
label_values(armored_archer_rpc_calls_total, rpc)
```

**Solution 3: Re-import Dashboard**
- Delete dashboard from Grafana
- Re-import using Option 2 above

---

## Dashboard Details

### Dashboard 1: Overview
- **UID**: `armored-archer-overview`
- **File**: `01-overview.json`
- **Panels**: 10
- **Refresh**: 10s
- **Purpose**: System health, active players, error rate, response times

### Dashboard 2: Performance
- **UID**: `armored-archer-performance`
- **File**: `02-performance.json`
- **Panels**: 12
- **Refresh**: 10s
- **Purpose**: Latency, database, cache, memory, CPU, throughput

### Dashboard 3: Business Metrics
- **UID**: `armored-archer-business`
- **File**: `03-business-metrics.json`
- **Panels**: 16
- **Refresh**: 30s
- **Purpose**: Registrations, matches, gear, store, season, leaderboards

### Dashboard 4: Errors & Alerts
- **UID**: `armored-archer-errors-alerts`
- **File**: `04-errors-alerts.json`
- **Panels**: 19
- **Refresh**: 5s
- **Purpose**: Error tracking, alerts, circuit breakers, health checks

---

## Post-Import Verification

### Checklist

After importing, verify:

- [ ] All 4 dashboards visible in Grafana
- [ ] Each dashboard loads without errors
- [ ] Panels show data (not "No data")
- [ ] Time range picker works
- [ ] Refresh button updates data
- [ ] Variables populate and filter data
- [ ] No JavaScript errors in browser console

### Browser Console Check

1. Open browser developer tools (F12)
2. Go to **Console** tab
3. Refresh dashboard page
4. Look for errors (red text)
5. No errors should appear

### Data Validation

**Overview Dashboard**:
- Server Health should show "Healthy" (green)
- Active Players should show a number
- Error Rate should show percentage
- Response time graphs should have lines

**Performance Dashboard**:
- RPC Latency graph should show P50/P95/P99 lines
- CPU Usage should show percentage
- Memory Usage should show bytes or percentage

**Business Metrics**:
- Total Registrations should show a number
- Match graphs should show activity
- Revenue should show currency value

**Errors & Alerts**:
- Error Rate should show percentage
- Active Alerts should show count
- Health Status panels should show "Healthy"

---

## Advanced Configuration

### Change Dashboard Refresh Rate

1. Open dashboard
2. Click gear icon (⚙️) in top right
3. Select **Settings**
4. Under **Time Options**, adjust **Auto refresh**
5. Click **Save Dashboard**

### Change Time Range

1. Click time range picker in top right
2. Select preset (Last 1 hour, Last 6 hours, etc.)
3. Or select **Custom** for specific range
4. Click **Apply**

### Export Dashboard

1. Open dashboard
2. Click gear icon (⚙️) in top right
3. Select **Settings**
4. Click **JSON Model** tab
5. Copy JSON or click **Save to file**

### Create Alert from Panel

1. Click panel title
2. Select **Alert** → **Create Alert**
3. Configure threshold
4. Select notification channel
5. Click **Save Alert**

---

## Backup and Restore

### Backup Dashboards

```bash
# Export all dashboards via API
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/search?folderIds=1 \
  > dashboard-backup.json

# Or simply copy JSON files
cp backend/grafana/provisioning/dashboards/*.json ./backup/
```

### Restore Dashboards

```bash
# Copy backup files to provisioning directory
cp ./backup/*.json backend/grafana/provisioning/dashboards/

# Restart Grafana
docker-compose restart grafana
```

---

## Support

### Documentation
- Dashboard Configuration Guide: `.planning/phases/02-monitoring/02-02-dashboards.md`
- Phase Summary: `.planning/phases/02-monitoring/02-02-SUMMARY.md`

### Grafana Resources
- Official Docs: https://grafana.com/docs/
- Dashboard Reference: https://grafana.com/grafana/dashboards/

### Project Contacts
- See `AGENTS.md` for team contact information

---

**Last Updated**: 2026-03-16  
**Version**: 1.0  
**Status**: Complete - Pending Human Verification
