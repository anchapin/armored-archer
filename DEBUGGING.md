# Debugging Guide

This guide covers debugging techniques and configurations for the Armored Archer project, including both the Godot client and Nakama backend.

## Table of Contents

- [Backend Debugging (TypeScript)](#backend-debugging-typescript)
- [Frontend Debugging (Godot/GDScript)](#frontend-debugging-godotgdscript)
- [Database Debugging](#database-debugging)
- [Common Debugging Scenarios](#common-debugging-scenarios)
- [Logging Best Practices](#logging-best-practices)
- [Tools and Techniques](#tools-and-techniques)

---

## Backend Debugging (TypeScript)

### VS Code Debugging Setup

The `.vscode/launch.json` file contains several pre-configured debugging configurations:

1. **Debug Nakama Server** - Full debug mode with breakpoints
2. **Run Nakama Server (No Debug)** - Run without debugging overhead
3. **Debug Nakama Module** - Debug individual TypeScript modules
4. **Run Backend Tests** - Run tests with debugger attached

### Starting the Debugger

1. Open the VS Code Run and Debug panel (`Ctrl+Shift+D` or `Cmd+Shift+D`)
2. Select a configuration from the dropdown
3. Press `F5` or click the green play button
4. Set breakpoints in your TypeScript code by clicking the gutter next to line numbers

### Console Debugging

For quick debugging without VS Code, use `console.log()` or `console.error()`:

```typescript
console.log("User ID:", userId);
console.error("Failed to process request:", error);
console.debug("Current state:", gameState);
```

### Nakama-Specific Debugging

#### RPC Debugging

When debugging Nakama RPCs:

```typescript
// In your RPC handler
const logger = nk.logger();
logger.debug("Processing RPC call from user: %s", userId);
logger.info("RPC payload: %s", JSON.stringify(payload));

// Use error logging for exceptions
logger.error("RPC failed: %s", error.message);
```

#### Module Debugging

Access Nakama logger from modules:

```typescript
// In custom modules
export const rpcMatchStart: nkruntime.RpcFunction = (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) => {
    logger.debug("Match start requested");
    
    try {
        const matchId = nk.match_create(ctx, moduleName);
        logger.info("Match created: %s", matchId);
        return JSON.stringify({ matchId });
    } catch (error) {
        logger.error("Match creation failed: %s", error);
        throw error;
    }
};
```

### Debugging Database Issues

#### Inspect Nakama Storage

```typescript
// Read a storage object
const objects = nk.storageRead([
    { collection: "loadouts", key: `user_${userId}`, userId: userId }
]);
logger.debug("Loaded loadouts:", JSON.stringify(objects));

// List all objects in a collection
const list = nk.storageList(userId, "loadouts", 100, "");
logger.debug("Total loadouts: %d", list.objects.length);
```

#### Direct Database Access

For advanced debugging, connect directly to PostgreSQL:

```bash
# Connect to PostgreSQL
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Query player data
SELECT * FROM users WHERE id = 'user_id_here';

# Check storage objects
SELECT * FROM storage WHERE collection = 'loadouts';
```

---

## Frontend Debugging (Godot/GDScript)

### Built-in Godot Debugger

Godot includes a powerful built-in debugger:

1. Click "Run Project" (F5) in the editor with the "Debug" option checked
2. Set breakpoints by clicking the gutter next to line numbers in scripts
3. Use the Debugger panel to:
   - Inspect variables
   - View call stacks
   - Step through code (F10 step over, F11 step into)
   - Execute expressions in the immediate window

### Print Debugging

Use `print()` statements for quick debugging:

```gdscript
print("Player health:", health)
print("Position: ", position)
print_debug("This only prints in debug builds")
```

### Using the Debugger

#### Remote Debugging

1. Start Godot with remote debugging enabled:
   ```
   godot --path /path/to/project --remote-debug 127.0.0.1:6007
   ```
2. In VS Code, use the "Attach to Godot" configuration

#### Breakpoints

- Click in the gutter to set/remove breakpoints
- Conditional breakpoints: Right-click → "Add Conditional Breakpoint"
- Logpoints: Right-click → "Add Logpoint" (logs message without pausing)

### Inspector Debugging

The Godot Inspector is invaluable for debugging:

1. Select any node in the scene tree
2. View and modify properties in real-time
3. Use the "Remote" tree to inspect running game state
4. Monitor signals in the "Node" tab

### Visual Debugging

#### Draw Debug Shapes

```gdscript
func _draw():
    draw_circle(global_position, 50, Color.RED)
    draw_line(start, end, Color.BLUE)
```

#### Debug Collisions

```gdscript
func _physics_process(delta):
    move_and_slide()
    if get_slide_collision_count() > 0:
        var collision = get_slide_collision(0)
        print("Collided with: ", collision.get_collider().name)
```

### Performance Profiling

#### Monitor Performance

1. Enable "Monitor" in the top menu (or press Shift+F4)
2. View metrics:
   - FPS
   - Physics time
   - Processing time
   - Draw calls

#### Profile Scripts

1. Run the game with profiling enabled
2. View the "Profiler" tab in the Debugger panel
3. Analyze function call times

---

## Database Debugging

### PostgreSQL Access

#### Connect via Docker

```bash
# Connect to the PostgreSQL container
docker exec -it armored_archer_postgres psql -U postgres -d nakama
```

#### Common Queries

```sql
-- List all users
SELECT id, username, display_name, created_at FROM users;

-- Check user sessions
SELECT user_id, expire, token FROM user_device WHERE user_id = 'user_id';

-- View storage objects
SELECT collection, key, user_id, value FROM storage 
WHERE user_id = 'user_id' 
ORDER BY created_at;

-- Check match states
SELECT match_id, state, created_at, updated_at FROM match;

-- Inspect leaderboard entries
SELECT leaderboard_id, owner_id, score, subscore FROM leaderboard_record 
WHERE leaderboard_id = 'leaderboard_id';
```

### Nakama Console

Access the admin console at `http://localhost:7351`:

1. **Accounts** - View and manage user accounts
2. **Storage** - Inspect and modify storage objects
3. **Matches** - View active matches and their state
4. **Leaderboards** - Check rankings and scores
5. **Runtime** - Execute Lua scripts and RPCs for testing

### Database Migrations

#### View Migration Status

```bash
docker exec -it armored_archer_server /nakama/nakama migrate up --dry-run
```

#### Apply Migrations

```bash
docker exec -it armored_archer_server /nakama/nakama migrate up
```

---

## Common Debugging Scenarios

### Client-Server Communication Issues

#### Problem: RPC call failing

**Backend:**
```typescript
logger.debug("RPC called: %s", ctx.rpc_id);
logger.debug("Payload: %s", payload);
logger.debug("User ID: %s", ctx.user_id);
```

**Frontend:**
```gdscript
func call_rpc():
    var payload = JSON.stringify({"action": "start_match"})
    client.send_rpc("matchmaker.start_match", payload)
```

Check Nakama console logs for errors.

### Authentication Failures

#### Debug JWT Tokens

```typescript
// Backend: Verify token structure
const decoded = jwt.decode(token);
logger.debug("Token payload:", JSON.stringify(decoded));
logger.debug("Token expires at:", new Date(decoded.exp * 1000));
```

```gdscript
// Frontend: Check session
func _on_session_created(session):
    print("Session created:", session.token)
    print("Expires:", session.expires_at)
```

### Performance Issues

#### Godot FPS Drops

1. Open Monitor (Shift+F4)
2. Check "Physics FPS" and "Process FPS"
3. Profile scripts in the Debugger panel
4. Look for:
   - Excessive function calls
   - Large allocations
   - Expensive operations in `_process()`

#### Backend Slow Response Times

```typescript
// Time your RPCs
const start = Date.now();
try {
    const result = await someOperation();
    const duration = Date.now() - start;
    logger.info("Operation completed in %d ms", duration);
} catch (error) {
    logger.error("Operation failed: %s", error);
}
```

### Memory Leaks

#### Godot Memory Debugging

```gdscript
func _process(delta):
    print_debug("Node count:", get_tree().get_node_count())
    print_debug("Free queue size:", Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
```

Common causes:
- Not using `queue_free()` on projectiles
- Connecting signals without disconnecting
- Creating arrays that grow indefinitely

#### Backend Memory Monitoring

```bash
# Check Nakama memory usage
docker stats armored_archer_server

# Check PostgreSQL memory
docker stats armored_archer_postgres
```

### Multiplayer Desync

#### Debug State Sync

```gdscript
# Log state changes
func on_state_received(new_state):
    print("Old state: ", current_state)
    print("New state: ", new_state)
    print("Diff: ", get_state_diff(current_state, new_state))
    current_state = new_state
```

```typescript
// Backend: Log state updates
logger.info("State update for match %s: %s", matchId, JSON.stringify(state));
```

---

## Logging Best Practices

### Backend Logging

#### Log Levels

```typescript
logger.debug("Detailed diagnostic info - disabled in production");
logger.info("Important events - always enabled");
logger.warn("Warning conditions - potential issues");
logger.error("Error conditions - something went wrong");
```

#### Structured Logging

```typescript
logger.info("Player joined match", {
    userId: ctx.user_id,
    matchId: matchId,
    timestamp: Date.now()
});
```

#### Never Log Sensitive Data

```typescript
// BAD
logger.info("User password: %s", userPassword);

// GOOD
logger.info("User authenticated: %s", userId);
```

### Frontend Logging

#### Use Appropriate Log Functions

```gdscript
# Always visible
print("Game started")

# Debug builds only
print_debug("Debug info: ", variable)

# Warnings (yellow in editor)
push_warning("This feature is deprecated")

# Errors (red in editor)
push_error("Critical error occurred")
```

#### Contextual Logging

```gdscript
print("[%s] Player health: %d" % [str(OS.get_ticks_msec()), health])
print_debug("At position: %s, velocity: %s" % [position, velocity])
```

#### Performance Logging

```gdscript
var _start_time: float

func start_timer():
    _start_time = OS.get_ticks_msec()

func log_timer(label: String):
    var elapsed = OS.get_ticks_msec() - _start_time
    print("%s took %.2f ms" % [label, elapsed])
```

---

## Tools and Techniques

### VS Code Extensions

Recommended extensions (already in `.vscode/extensions.json`):

- **geequlim.godot-tools** - Godot syntax highlighting and debugging
- **dbaeumer.vscode-eslint** - TypeScript linting
- **esbenp.prettier-vscode** - Code formatting
- **usernamehw.errorlens** - Inline error display
- **streetsidesoftware.code-spell-checker** - Spell checking

### Godot Tools

#### Script Editor

- **Auto-indent** - Ctrl+I
- **Find in files** - Ctrl+Shift+F
- **Go to definition** - Ctrl+Click
- **Toggle breakpoint** - F9

#### Scene Editor

- **Select root** - Shift+A
- **Toggle visibility** - V
- **Lock/unlock node** - L
- **Duplicate** - Ctrl+D

### Backend Tools

#### Postman / Insomnia

Test Nakama APIs and RPCs:

1. Import Nakama API spec
2. Create requests for authentication, storage, etc.
3. Test RPC payloads

#### Docker Monitoring

```bash
# View all logs
docker logs -f armored_archer_server

# View recent logs
docker logs --tail 100 armored_archer_server

# Follow multiple containers
docker-compose logs -f
```

### Network Debugging

#### Nakama WebSocket Debugging

```bash
# Use websocat or similar tool
websocat ws://localhost:7350/api/socket
```

#### Godot Network Profiler

Use Godot's "Network Profiler" to monitor:
- Packet rates
- Bandwidth usage
- Latency

### Browser Developer Tools

When testing web export:

1. Open Developer Tools (F12)
2. Check Network tab for WebSocket connections
3. Monitor Console for errors
4. Use Performance tab for profiling

---

## Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Godot won't connect to Nakama | Check `127.0.0.1:7350` in NetworkManager |
| TypeScript compilation fails | Run `npm install` in backend/ |
| Database connection refused | Run `docker-compose up -d` |
| Breakpoints not hitting | Ensure debug mode is enabled |
| Performance drop | Check Godot Monitor and Profile tab |
| User can't login | Check Nakama Console → Accounts |
| Storage not saving | Verify user ID and collection name |
| Match not starting | Check Nakama Console → Matches |

---

## Additional Resources

- [Godot 4 Debugging Documentation](https://docs.godotengine.org/en/stable/tutorials/debugging/debugging_introduction.html)
- [Nakama Server Documentation](https://heroiclabs.com/docs/)
- [TypeScript Debugger Documentation](https://code.visualstudio.com/docs/typescript/typescript-debugging)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
