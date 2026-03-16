# Connection Troubleshooting Guide

This document helps diagnose and fix connection issues when running the game in Godot editor (F5).

## Quick Fixes

### 1. Check Backend Services Status

```bash
# Check if all services are running
docker ps --filter "name=armored_archer"

# Expected output: All containers should show "Up" status
```

### 2. Test Nakama Server Directly

```bash
# Test basic connectivity
curl http://127.0.0.1:7350/

# Test device authentication
curl -X POST "http://127.0.0.1:7350/v2/account/authenticate/device" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic ZGVmYXVsdGtleTo=" \
  -d '{"id": "test-device", "create": true}'
```

Expected response: JSON with `token` and `refresh_token`

### 3. View Server Logs

```bash
# View Nakama server logs
docker logs armored_archer_server --tail 50

# Follow logs in real-time
docker logs -f armored_archer_server
```

### 4. Restart Backend Services

```bash
cd backend
docker-compose restart server
```

## Using the Debug Tools

### Connection Test Scene

A dedicated test scene is available to diagnose connection issues:

**Option 1: From Login Screen**
- When connection fails, click "Test Connection (Debug)" button
- This opens the Connection Test Scene
- Click "Test Connection" to run diagnostics

**Option 2: Run Directly**
```bash
./scripts/run_connection_test.sh
```

**Option 3: From Godot Editor**
- Open `res://scenes/ui/connection_test_scene.tscn`
- Press F6 to run the scene

### What the Test Scene Does

1. Loads server configuration from NetworkManager
2. Generates a test device ID
3. Sends authentication request to Nakama
4. Displays detailed logs of the request/response
5. Shows success or failure with troubleshooting tips

## Debug Logging

The NetworkManager now includes extensive debug logging. When you press F5:

1. Open the **Output** panel in Godot (bottom panel)
2. Look for `[NetworkManager] DEBUG:` messages
3. Key log points:
   - `NetworkManager._ready()` - Initialization
   - `Starting Device Authentication` - Auth started
   - `HTTP Response Received` - Server responded
   - `session_created(TRUE)` - Success!

### Sample Debug Output

```
[NetworkManager] DEBUG: ============ NetworkManager._ready() ============
[NetworkManager] DEBUG: Environment: DEVELOPMENT
[NetworkManager] DEBUG: Server URL: 127.0.0.1
[NetworkManager] DEBUG: Server Port: 7350
[NetworkManager] DEBUG: Final Base URL: http://127.0.0.1:7350
[NetworkManager] DEBUG: === Starting Device Authentication ===
[NetworkManager] DEBUG: Auth URL: http://127.0.0.1:7350/v2/account/authenticate/device
[NetworkManager] DEBUG: Sending HTTP POST request...
[NetworkManager] DEBUG: === HTTP Response Received ===
[NetworkManager] DEBUG: Result: 0, Response Code: 200
[NetworkManager] DEBUG: Emitting session_created(TRUE)
```

## Common Issues and Solutions

### Issue 1: "No internet connection" / Error Code 0

**Symptoms:**
- Status shows "No internet connection"
- Debug log shows error code 0 or -1

**Causes:**
- Nakama server not running
- Wrong server URL/port
- Firewall blocking connection

**Solutions:**
```bash
# Start backend services
cd backend && docker-compose up -d

# Verify server is responding
curl http://127.0.0.1:7350/

# Check firewall
sudo ufw status
```

### Issue 2: Authentication Failed (code: 401)

**Symptoms:**
- Response code 401
- "Invalid credentials" error

**Causes:**
- Wrong server key in .env file

**Solutions:**
```bash
# Check .env configuration
cat .env | grep NAKAMA

# Should show:
# NAKAMA_SERVER_KEY=defaultkey

# Restart Nakama with correct key
docker-compose restart server
```

### Issue 3: Connection Timeout

**Symptoms:**
- Request hangs for 30 seconds
- Then fails with timeout error

**Causes:**
- Server is slow/unresponsive
- Network latency

**Solutions:**
```bash
# Check server health
docker exec armored_archer_server /nakama/nakama healthcheck

# View server resource usage
docker stats armored_archer_server

# Restart if needed
docker-compose restart server
```

### Issue 4: Stale Session Data

**Symptoms:**
- Login worked before, now fails
- Session token expired

**Solutions:**
```bash
# Clear session data
rm -rf ~/.local/share/Godot/app_userdata/Armored Archer/sessions/
rm -f ~/.local/share/Godot/app_userdata/Armored Archer/session_data.json

# Or in Godot 4.6:
rm -rf .godot/sessions/
rm -f .godot/user_data/session_data.json
```

## Environment Configuration

### Required .env Variables

```bash
NAKAMA_SERVER_URL=127.0.0.1
NAKAMA_SERVER_PORT=7350
NAKAMA_SERVER_KEY=defaultkey
```

### Verify Environment Loading

The NetworkManager logs environment info on startup:

```
=== NetworkManager Environment Info ===
Environment: DEVELOPMENT
Server URL: 127.0.0.1
Server Port: 7350
Server Key: [SET]
========================================
```

## Manual Testing with curl

### Test Device Authentication

```bash
curl -v -X POST "http://127.0.0.1:7350/v2/account/authenticate/device" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic ZGVmYXVsdGtleTo=" \
  -d '{"id": "test-device-123", "create": true}'
```

### Test Session Refresh

```bash
curl -v -X POST "http://127.0.0.1:7350/v2/session/refresh" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"token": "YOUR_REFRESH_TOKEN"}'
```

## Getting Help

If issues persist:

1. **Collect logs:**
   ```bash
   # Godot output logs
   # Save the Output panel content
   
   # Nakama server logs
   docker logs armored_archer_server > nakama_logs.txt
   ```

2. **Run connection test:**
   ```bash
   ./scripts/run_connection_test.sh
   # Screenshot the results
   ```

3. **Check configuration:**
   ```bash
   cat .env
   docker inspect armored_archer_server | grep -A 20 Env
   ```

## Quick Reference Commands

```bash
# Service management
docker ps                                    # Check running containers
docker-compose -f backend/docker-compose.yml ps  # Backend status
docker-compose -f backend/docker-compose.yml up -d  # Start all
docker-compose -f backend/docker-compose.yml down   # Stop all
docker-compose -f backend/docker-compose.yml restart server  # Restart Nakama

# Logs
docker logs armored_archer_server --tail 50
docker logs -f armored_archer_server  # Follow logs

# Testing
curl http://127.0.0.1:7350/
./scripts/run_connection_test.sh

# Clear session data
rm -rf .godot/sessions/ .godot/user_data/session_data.json
```
