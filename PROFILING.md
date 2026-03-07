# Profiling Guide

This document describes the profiling instrumentation implemented in Armored Archer and how to use it.

## Overview

Armored Archer includes comprehensive profiling instrumentation for both:
1. **Godot Frontend** - Using GDScript profiling utilities
2. **Nakama Backend** - Using TypeScript profiling and external profiling tools

## Godot Frontend Profiling

### ProfilingInstrumentation.gd

The Godot frontend includes a `ProfilingInstrumentation` autoload that provides profiling capabilities:

```gdscript
# Get the profiler reference
var _profiler = get_node_or_null("/root/ProfilingInstrumentation")

# Profile a block of code
var block = _profiler.create_profile_block("my_operation")
# ... code to profile ...
block.end()

# Check if profiling is enabled
if _profiler.is_profiling_enabled():
    # ... profiling code ...
```

### Profiler Usage in Godot

The `PerformanceProfiler` class provides detailed performance tracking:

```gdscript
var profiler = PerformanceProfiler.new()
profiler.start_profiling("combat")

# ... code to profile ...

var results = profiler.stop_profiling()
print("Profile results: ", results)
```

### Adding Profiling to Godot Code

To add profiling to a new critical code path in Godot:

```gdscript
extends Node

@onready var _profiler = get_node_or_null("/root/ProfilingInstrumentation")

func my_critical_function():
    # Create profile block
    var _block = _profiler.create_profile_block("MyClass.my_critical_function") if _profiler else null
    
    # ... code ...
    
    # End profiling (even on early return)
    if _block:
        _block.end()
```

### Godot Profiling Instruments

- **create_profile_block(name: String) -> ProfileBlock**: Creates a profiling block
- **is_profiling_enabled() -> bool**: Checks if profiling is enabled
- **get_profile_report() -> Dictionary**: Gets accumulated profile data
- **clear_profile_data()**: Clears all profile data

## Nakama Backend Profiling

### Profiling Module

The backend includes a `profiling.ts` module with several profiling utilities:

```typescript
import { profileFunction, profileAsync, createProfileBlock } from './modules/profiling';

// Profile a function (sync or async)
export function rpcMyHandler(ctx, logger, nk, payload): string {
  return profileFunction('my_handler', () => {
    // ... handler code ...
  });
}

// Profile an async operation
async function processMatchmaking() {
  await profileAsync('matchmaking.process', async () => {
    // ... async code ...
  });
}

// Manual profile block
function manualProfiling() {
  const block = createProfileBlock('my.operation');
  // ... code ...
  block.end();
}
```

### Configuration

Backend profiling is controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PROFILING_ENABLED` | `false` | Enable/disable profiling instrumentation |
| `PROFILING_SLOW_THRESHOLD_MS` | `100` | Log operations slower than this (ms) |
| `PROFILING_LOG_SLOW` | `true` | Enable logging of slow operations |

### Profiling Functions

- **profileFunction(name, fn)**: Profile a sync or async function
- **profileAsync(name, fn)**: Profile an async function
- **profileSync(name, fn)**: Profile a sync function
- **createProfileBlock(name)**: Create a manual profiling block
- **getProfileReport()**: Get profiling statistics
- **getFormattedProfileReport()**: Get formatted text report

## External Profiling Tools

### 0x - Flame Graph Profiler

0x generates flame graph visualizations of Node.js performance:

```bash
# Install 0x
npm install -g 0x

# Run with 0x profiling
cd backend
npx 0x npm run dev
```

This will open a browser with interactive flame graphs.

### clinic.js

Clinic.js provides several profiling tools:

```bash
# Install clinic.js
npm install -g clinic

# Doctor - analyzes performance and provides recommendations
npx clinic doctor -- node build/index.js

# Flame - generates flame graphs
npx clinic flame -- node build/index.js

# Bubbleprof - shows async operations and event loop delays
npx clinic bubbleprof -- node build/index.js
```

### Node.js Built-in Profiler

```bash
# Run with V8 profiler
node --prof build/index.js

# Process log files
node --prof-process logfile.log
```

### Chrome DevTools

```bash
# Start with inspector
node --inspect=0.0.0.0:9229 build/index.js

# Connect via chrome://inspect
```

## Backend Profiling Script

A convenience script is provided for easy profiling:

```bash
# Show help
./backend/scripts/profile.sh help

# Run with 0x flame graphs
./backend/scripts/profile.sh flame

# Run with clinic doctor
./backend/scripts/profile.sh doctor

# Run with clinic flame
./backend/scripts/profile.sh flame2

# Run with clinic bubbleprof
./backend/scripts/profile.sh bubble

# Run with Node inspector
./backend/scripts/profile.sh inspect
```

## Profile Reports

### Viewing Profile Data

```typescript
import { getFormattedProfileReport, getProfileReport } from './modules/profiling';

// Get array of profile data sorted by total time
const report = getProfileReport();

// Get formatted text report
const text = getFormattedProfileReport();
console.log(text);
```

### Report Format

```
=== Profiling Report ===
Profiling Enabled: true
Slow Threshold: 100ms

Top Operations (by total time):
Operation                              Calls    Total(ms)  Avg(ms)     Max(ms)     Errors  
----------------------------------------------------------------------------------------------------
combat.submit_combat_action            150      1250.45    8.34        45.23       0
matchmaker.find_match                 80       890.12     11.13       120.45      2
```

## Critical Code Paths Instrumented

### Godot Frontend

- **NetworkManager**: Network communication profiling
- **CombatManager**: Combat action submission and match state retrieval
- **GameManager**: Game state management

### Nakama Backend

- **combat.submit_combat_action**: Combat action processing
- **combat.get_match_state**: Match state retrieval

## Best Practices

1. **Enable in Development**: Set `PROFILING_ENABLED=true` during development
2. **Monitor Slow Operations**: Check logs for operations exceeding threshold
3. **Use Profile Reports**: Review profile reports to identify bottlenecks
4. **Use External Tools**: For deeper analysis, use 0x or clinic.js
5. **Clean Up**: Call `clearProfileData()` periodically to avoid memory buildup

## Performance Impact

- Profiling instrumentation has minimal overhead when disabled
- When enabled, overhead is typically <1% for simple operations
- External profilers (0x, clinic) have higher overhead but provide detailed insights
