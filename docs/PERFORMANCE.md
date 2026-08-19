# Performance Profiling & Budget Device Optimization

## Overview

This document outlines the performance targets, profiling methodology, and budget device optimization strategies for Armored Archer. The goal is to ensure the game runs smoothly on a wide range of devices, from flagship phones to budget devices like Moto G7 and iPhone SE.

## Issue Reference

- **GitHub Issue**: #133 - [QAQC] HIGH: Profile Performance & Optimize for Budget Devices
- **Problem**: No documented performance targets or budget device testing. No memory leak checks.
- **GitHub Issue**: #1073 - Make low-end benchmark gate measure real client performance
- **Canonical thresholds**: `backend/tests/fixtures/performance/performance-targets.json` is the single machine-readable source of truth consumed by the CI benchmark gate; the tables in this document are the human-readable mirror and must stay in sync (the gate enforces the Budget-tier row).

---

## Performance Targets by Device Tier

### Device Tiers

| Tier | Example Devices | Target FPS | Min FPS | Max Particles | Shadow Quality |
|------|-----------------|------------|---------|---------------|----------------|
| **Flagship** | iPhone 14+, Samsung S22+ | 60 | 45 | 100 | High (2) |
| **Mid-Range** | iPhone SE 2022, Moto G82 | 45 | 30 | 75 | Low (1) |
| **Budget** | Moto G7, iPhone 8, older Android | 30 | 24 | 50 | Off (0) |

### Memory Thresholds

| Tier | Memory Threshold | Notes |
|------|------------------|-------|
| **Flagship** | 1024 MB | Standard operation |
| **Mid-Range** | 512 MB | Aggressive cleanup |
| **Budget** | 256 MB | Minimal memory footprint |

---

## Budget Device Specifications

### Tested Budget Devices

| Device | OS | RAM | SoC | Target Performance |
|--------|----|-----|-----|-------------------|
| Moto G7 | Android 9 | 4 GB | Snapdragon 632 | 30 FPS |
| iPhone SE | iOS 15 | 3 GB | A13 Bionic | 30 FPS |
| Samsung Galaxy A10 | Android 9 | 2 GB | Exynos 7884 | 24 FPS |

### Performance Requirements

- **Startup Time**: < 5 seconds on budget devices
- **Memory Usage**: < 200 MB baseline on budget devices
- **Frame Time**: < 33.3ms for 30 FPS (budget), < 16.7ms for 60 FPS (flagship)
- **Network Latency Tolerance**: Up to 500ms for casual gameplay

---

## Memory Leak Detection

### Implementation

The `PerformanceProfiler` autoload provides built-in memory leak detection:

```gdscript
# Check memory leak status
var leak_status = PerformanceProfiler.get_memory_leak_status()
print("Leak detected: ", leak_status.leak_detected)
print("Memory growth: ", leak_status.memory_growth_mb, " MB")
print("Growth rate: ", leak_status.growth_rate_mb_per_min, " MB/min")
```

### Detection Thresholds

- **Memory Growth Threshold**: 50 MB
- **Growth Rate Threshold**: 10 MB/minute
- **Sample Count**: 60 samples over time

### Resetting Leak Detection

Call this when transitioning between scenes to start fresh tracking:

```gdscript
PerformanceProfiler.reset_memory_leak_detection()
```

### Signals

Connect to the memory leak signal for real-time alerts:

```gdscript
PerformanceProfiler.memory_leak_detected.connect(func(current, growth, rate):
    print("Memory leak detected! Current: ", current, " MB")
)
```

---

## Profiling API

### Getting Performance Snapshots

```gdscript
# Get current performance snapshot
var snapshot = PerformanceProfiler.get_profiling_snapshot()

# Log snapshot for debugging
PerformanceProfiler.log_profiling_snapshot("After 10-min PvE")
```

### Available Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get_fps()` | float | Current FPS |
| `get_average_fps()` | float | Average FPS over sample period |
| `get_frame_time_ms()` | float | Current frame time in ms |
| `get_memory_usage_mb()` | float | Current memory in MB |
| `get_peak_memory_mb()` | float | Peak memory since startup |
| `get_device_tier()` | int | 0=Flagship, 1=Mid-Range, 2=Budget |
| `is_budget_device()` | bool | True if budget device |
| `get_target_fps()` | int | Target FPS for current device |
| `get_performance_targets()` | Dictionary | All performance settings |
| `get_memory_leak_status()` | Dictionary | Memory leak detection status |

---

## Budget Device Optimization Checklist

### Graphics Settings

- [ ] Reduce shadow quality on budget devices
- [ ] Use texture compression (ETC2/ASTC)
- [ ] Limit particle count to 50 on budget
- [ ] Disable post-processing effects on budget
- [ ] Use lower resolution rendering on budget devices

### Memory Management

- [ ] Pool reusable objects (arrows, enemies)
- [ ] Unload unused scenes and resources
- [ ] Use weak references where appropriate
- [ ] Implement object recycling for projectiles
- [ ] Clear event connections when not needed

### Performance Patterns

- [ ] Use `_process` sparingly, prefer `_physics_process`
- [ ] Batch similar operations
- [ ] Avoid creating objects in `_process`
- [ ] Use static typing where possible
- [ ] Limit collision checks to visible area

---

## Testing Procedures

### Pre-Release Testing

1. **Startup Test**: Launch app on Moto G7, verify < 5s startup
2. **10-Minute PvE**: Play 10 minutes of PvE, monitor FPS and memory
3. **5-Match PvP**: Complete 5 PvP matches, check for memory growth
4. **Background Test**: Background app for 5 minutes, return, verify no crash
5. **Memory Leak Test**: Play for 30 minutes, verify memory growth < 50MB

### Profiling Integration Points

```gdscript
# At key points in gameplay
PerformanceProfiler.log_profiling_snapshot("Game Start")
# ... gameplay ...
PerformanceProfiler.log_profiling_snapshot("After 10-min PvE")
# ... more gameplay ...
PerformanceProfiler.log_profiling_snapshot("After 5 PvP Matches")
```

---

## CI Benchmark Gate (Real Measurement)

The "Benchmark Regression" workflow (`benchmark-regression.yml`) gates PRs on
**real client performance**, not simulated values (issue #1073):

1. A headless Godot 4.6 run boots the actual gameplay scene
   (`scenes/main.tscn`: player, enemy spawner, arrows, object pooling) via
   `test/benchmark/headless_benchmark.gd`.
2. After a short warm-up, the harness resets `PerformanceProfiler` statistics
   (`reset_frame_statistics()` / `reset_memory_leak_detection()`), uncaps
   `Engine.max_fps` (headless runs otherwise inherit the budget tier's 30 FPS
   cap, which hides real frame cost behind throttle sleep), and measures a
   clean window (≥ 600 frames and ≥ 10 s by default).
3. It exports a JSON snapshot — real FPS, real frame times, real static
   memory — to
   `backend/tests/fixtures/performance/generated/headless_benchmark.snapshot.json`
   (gitignored; regenerated every run).
4. `cd backend && npm run test:benchmark` validates the snapshot against the
   shared thresholds in `performance-targets.json`. **If the snapshot is
   missing the gate fails** — it can no longer pass vacuously on synthetic
   numbers.

### Running Locally

```bash
./scripts/run-headless-performance-benchmark.sh   # requires godot4 (or GODOT_BINARY=...)
cd backend && npm run test:benchmark
```

### Snapshot Schema

| Field | Description |
|-------|-------------|
| `schemaVersion` | Always `1` |
| `source` | `headless_godot` (provenance the gate requires) |
| `godotVersion` / `platform` / `displayServer` | Engine/runtime the measurement came from |
| `scenePath` | The measured scene — the gate requires `res://scenes/main.tscn` |
| `framesRun` / `measuredWallSeconds` | Size of the measurement window |
| `engineMaxFps` | `0` (uncapped) — the gate rejects throttled runs, which measure the cap interval instead of real frame cost |
| `benchmarkSceneNodeCount` | Nodes alive in the benchmark scene at teardown |
| `profiler` | Verbatim `PerformanceProfiler.get_profiling_snapshot()` output |

Device telemetry captures from real phones may be dropped into
`backend/tests/fixtures/performance/generated/` using the same schema;
override the gate's input path with `PERF_BENCHMARK_SNAPSHOT`.

---

## Performance Monitoring in Production

### Analytics Events

Track performance metrics in production:

| Event | Parameters |
|-------|------------|
| `performance_snapshot` | fps_avg, fps_min, memory_mb, device_tier |
| `memory_leak_detected` | growth_mb, growth_rate, session_duration |
| `performance_drop` | fps_before, fps_after, trigger_event |

### Crash Reporting

Include performance data in crash reports:

- Device tier and model
- Current FPS and memory usage
- Recent profiling snapshots
- Memory leak status

---

## Appendix: Performance Targets Summary

### Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    PERFORMANCE TARGETS                       │
├──────────────┬──────────┬───────────┬──────────────────────┤
│    Metric    │ Flagship │ Mid-Range │       Budget        │
├──────────────┼──────────┼───────────┼──────────────────────┤
│ Target FPS   │    60    │    45     │         30           │
│ Min FPS      │    45    │    30     │         24           │
│ Particles    │   100    │    75     │          50          │
│ Shadows      │   High   │    Low    │        Off           │
│ Memory       │  <512MB  │  <384MB   │       <256MB         │
└──────────────┴──────────┴───────────┴──────────────────────┘
```

### Memory Leak Detection Thresholds

```
Memory Growth > 50 MB AND Growth Rate > 10 MB/min → LEAK DETECTED
```

---

*Document Version: 1.1*
*Last Updated: 2026*
*Issues: #133, #1073*
