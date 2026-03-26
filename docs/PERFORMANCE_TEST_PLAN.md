# Low-End Device Performance Test Plan

## Issue Reference

- **GitHub Issue**: #479 - Performance test on low-end devices
- **Priority**: QA-005 (medium)
- **Status**: In Progress

---

## 1. Overview

This test plan defines the procedures and benchmarks for testing Armored Archer on low-end (budget) devices to ensure acceptable performance across the device spectrum.

## 2. Current Performance Profiling Code

### 2.1 PerformanceProfiler.gd

The `PerformanceProfiler.gd` autoload provides comprehensive performance monitoring:

**Key Classes/Enums:**
- `DeviceTier` enum: `FLAGSHP`, `MID_RANGE`, `BUDGET`
- Signals: `fps_dropped`, `memory_warning`, `device_tier_detected`, `memory_leak_detected`

**Performance Targets:**
| Tier | Target FPS | Min FPS | Max Particles | Shadow Quality |
|------|------------|---------|---------------|----------------|
| Flagship | 60 | 45 | 100 | High (2) |
| Mid-Range | 45 | 30 | 75 | Low (1) |
| Budget | 30 | 24 | 50 | Off (0) |

**Memory Thresholds:**
- Budget: 256 MB
- Mid-Range: 512 MB
- Flagship: 1024 MB

**Key Methods:**
```gdscript
get_fps() -> float                    # Current FPS
get_average_fps() -> float            # Average FPS over sample period
get_frame_time_ms() -> float          # Current frame time in ms
get_memory_usage_mb() -> float         # Current memory in MB
get_device_tier() -> int              # 0=Flagship, 1=Mid-Range, 2=Budget
is_budget_device() -> bool             # Check if budget device
get_target_fps() -> int               # Target FPS for current device
get_profiling_snapshot() -> Dictionary  # Full profiling snapshot
get_memory_leak_status() -> Dictionary  # Memory leak detection status
```

**Memory Leak Detection:**
- Memory Growth Threshold: 50 MB
- Growth Rate Threshold: 10 MB/minute
- Sample Count Required: 60 samples

---

## 3. Test Scenarios

### 3.1 Startup Performance Test

**Objective:** Verify startup time meets budget device requirements

**Test Steps:**
1. Clear app cache and data
2. Launch the application
3. Measure time to reach main menu
4. Record initial memory usage
5. Record initial FPS

**Acceptance Criteria:**
| Device Type | Max Startup Time | Initial Memory |
|-------------|------------------|----------------|
| Budget | < 5 seconds | < 200 MB |
| Mid-Range | < 3 seconds | < 300 MB |
| Flagship | < 2 seconds | < 400 MB |

### 3.2 Frame Rate Stability Test

**Objective:** Verify FPS remains stable during gameplay

**Test Scenarios:**
- **PvE Combat**: 10 minutes of continuous PvE gameplay
- **PvP Match**: Complete 5 PvP matches
- **Menu Navigation**: Navigate through all menus

**Acceptance Criteria:**
| Device Type | Target FPS | Min Acceptable FPS | Max Frame Time |
|-------------|------------|--------------------| ---------------|
| Budget | 30 | 24 | 41.7 ms |
| Mid-Range | 45 | 30 | 33.3 ms |
| Flagship | 60 | 45 | 16.7 ms |

### 3.3 Memory Leak Detection Test

**Objective:** Verify no significant memory leaks during extended play

**Test Steps:**
1. Record startup memory
2. Play continuously for 30 minutes
3. Sample memory every 60 frames
4. Calculate memory growth and growth rate

**Acceptance Criteria:**
- Memory growth must be < 50 MB after 30 minutes
- Growth rate must be < 10 MB/minute
- No sustained memory increase above threshold

### 3.4 Performance Under Load Test

**Objective:** Verify performance during resource-intensive scenarios

**Test Scenarios:**
- Many enemies on screen (50+ enemies)
- Multiple projectiles (arrows, spells)
- Particle effects intensive scenes
- Background network operations during gameplay

**Acceptance Criteria:**
- FPS drop must not exceed 20% from target
- No memory spikes > 100 MB above baseline
- No frame time spikes > 2x average

### 3.5 Scene Transition Performance Test

**Objective:** Verify smooth scene transitions

**Test Scenarios:**
- Main menu to gameplay
- Gameplay to results screen
- Results to main menu
- Inventory access during gameplay

**Acceptance Criteria:**
- Transition time < 2 seconds on budget devices
- No visible frame drops during transition
- Memory properly released after transition

---

## 4. Performance Benchmarks

### 4.1 FPS Benchmarks

```
┌─────────────────────────────────────────────────────────────┐
│                    FPS BENCHMARKS                           │
├──────────────────┬──────────┬──────────┬────────────────────┤
│     Scenario     │ Budget  │Mid-Range │     Flagship      │
├──────────────────┼──────────┼──────────┼────────────────────┤
│ Startup          │   30+    │   45+    │       60+         │
│ Main Menu Idle   │   30+    │   45+    │       60+         │
│ PvE Combat       │   24+    │   30+    │       45+         │
│ PvP Combat       │   24+    │   30+    │       45+         │
│ Menu Navigation  │   30+    │   45+    │       60+         │
│ Inventory Open   │   30+    │   45+    │       60+         │
└──────────────────┴──────────┴──────────┴────────────────────┘
```

### 4.2 Memory Benchmarks

```
┌─────────────────────────────────────────────────────────────┐
│                  MEMORY BENCHMARKS (MB)                    │
├──────────────────┬──────────┬──────────┬────────────────────┤
│     Scenario     │ Budget  │Mid-Range │     Flagship      │
├──────────────────┼──────────┼──────────┼────────────────────┤
│ Startup          │  < 200   │  < 300   |      < 400       |
│ After 10min PvE  │  < 256   │  < 400   |      < 512       |
│ After 30min Play │  < 300   │  < 450   |      < 600       │
│ Peak Memory      │  < 350   │  < 500   |      < 700       │
└──────────────────┴──────────┴──────────┴────────────────────┘
```

### 4.3 Frame Time Benchmarks

```
┌─────────────────────────────────────────────────────────────┐
│                  FRAME TIME BENCHMARKS                      │
├──────────────────┬──────────┬──────────┬────────────────────┤
│     Scenario     │ Budget  │Mid-Range │     Flagship      │
├──────────────────┼──────────┼──────────┼────────────────────┤
│ Target Frame Time│ 33.3 ms  │ 22.2 ms  |     16.7 ms       │
│ Max Acceptable   │ 41.7 ms  │ 33.3 ms  |     22.2 ms       │
│ Spike Threshold  │ 83.4 ms  │ 66.6 ms  |     44.4 ms       │
└──────────────────┴──────────┴──────────┴────────────────────┘
```

---

## 5. Test Environment

### 5.1 Budget Devices for Testing

| Device | OS | RAM | SoC | Notes |
|--------|----|-----|-----|-------|
| Moto G7 | Android 9 | 4 GB | Snapdragon 632 | Primary budget test |
| iPhone SE | iOS 15 | 3 GB | A13 Bionic | iOS budget representative |
| Samsung Galaxy A10 | Android 9 | 2 GB | Exynos 7884 | Minimum spec Android |

### 5.2 Simulated Testing (CI/Headless)

For automated testing in CI, use:
- Godot headless mode: `godot --headless`
- Simulated device tier detection
- Frame time throttling simulation

---

## 6. Automated Test Implementation

### 6.1 Test Structure

```
tests/
├── unit/
│   └── test_performance_profiler.gd    # Unit tests for profiler
├── integration/
│   └── test_performance_benchmarks.gd  # Integration benchmarks
└── performance/
    └── perf_budget_device_tests.gd     # Simulated budget tests
```

### 6.2 Unit Tests (test_performance_profiler.gd)

```gdscript
# Test device tier detection
func test_device_tier_detection():
    # Test budget tier detection
    # Test mid-range tier detection
    # Test flagship tier detection

# Test FPS tracking
func test_fps_tracking():
    # Test average FPS calculation
    # Test FPS history management
    # Test FPS warning emission

# Test memory leak detection
func test_memory_leak_detection():
    # Test memory growth detection
    # Test growth rate calculation
    # Test leak signal emission

# Test performance settings application
func test_performance_settings():
    # Test budget device settings
    # Test mid-range device settings
    # Test flagship device settings
```

### 6.3 Benchmark Tests (test_performance_benchmarks.gd)

```gdscript
# Benchmark FPS stability
func benchmark_fps_stability():
    # Simulate 60 frames
    # Measure average FPS
    # Assert meets minimum threshold

# Benchmark memory tracking
func benchmark_memory_tracking():
    # Simulate memory samples
    # Measure leak detection accuracy

# Benchmark frame time calculation
func benchmark_frame_time():
    # Test frame time at various FPS
    # Verify accuracy within 1ms
```

---

## 7. Test Execution

### 7.1 Manual Testing Checklist

- [ ] Startup test on Moto G7
- [ ] Startup test on iPhone SE
- [ ] 10-minute PvE test on budget device
- [ ] 5-match PvP test on budget device
- [ ] 30-minute memory leak test
- [ ] Performance under load test
- [ ] Scene transition test
- [ ] Background/foreground test

### 7.2 Automated Testing

```bash
# Run performance unit tests
godot --headless --script tests/test_performance_profiler.gd

# Run benchmark tests
godot --headless --script tests/test_performance_benchmarks.gd

# Run all performance tests
godot --headless --script test/run_performance_tests.gd
```

---

## 8. Reporting

### 8.1 Performance Test Report Template

```markdown
## Performance Test Report

### Device Information
- Device Model: 
- OS Version: 
- RAM: 
- SoC: 

### Test Results
| Test | Result | Notes |
|------|--------|-------|
| Startup Time | PASS/FAIL | X.XX seconds |
| FPS Stability | PASS/FAIL | Avg: XX.X, Min: XX.X |
| Memory Test | PASS/FAIL | Growth: XX MB |
| Frame Time | PASS/FAIL | Avg: XX.X ms |

### Issues Found
1. 
2. 

### Recommendations
1. 
```

---

## 9. References

- [Performance Profiling Documentation](../docs/PROFILING.md)
- [Performance Budget Documentation](../docs/PERFORMANCE.md)
- [PerformanceProfiler.gd Source Code](../autoloads/PerformanceProfiler.gd)

---

*Document Version: 1.0*
*Last Updated: 2024*
*Issue: #479*
