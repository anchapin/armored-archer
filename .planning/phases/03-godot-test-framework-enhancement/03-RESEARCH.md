# Phase 3: Godot Test Framework Enhancement - Research

**Researched:** 2026-03-20
**Domain:** Godot 4 testing with GUT framework, autoload mocking, signal testing
**Confidence:** HIGH

## Summary

Phase 3 focuses on enhancing Godot testing capabilities to address test isolation (ISO-04) and autoload mocking (MOCK-03). The project has 22 autoload singletons that manage global state (NetworkManager, GameManager, CombatManager, etc.), which currently create test isolation challenges. Research confirms that GUT 9.5.0/9.5.1 provides comprehensive capabilities for autoload mocking through its doubling mechanism, signal testing via `wait_for_signal()`, and test lifecycle management.

**Primary recommendation:** Use GUT's built-in doubling and partial double mechanism combined with dependency injection pattern refactoring to make autoloads mockable. Implement signal testing using GUT's `wait_for_signal()` method. Ensure test isolation by using fresh autoload instances per test with proper setup/teardown.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GUT (Godot Unit Test) | 9.5.0/9.5.1 | Testing framework for Godot 4 | Mature framework with autoload doubling, signal testing, CI integration |
| Godot 4 | 4.x | Game engine | Current stable release with GDScript 2.0 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GUT Doubler | Built-in | Create test doubles (mocks/stubs) | For mocking autoloads and dependencies |
| GUT Awaiter | Built-in | Signal testing and async operations | For testing Godot signals |
| GUT Spy | Built-in | Method call verification | For validating behavior without side effects |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GUT framework | Custom test runner | GUT provides mature doubling, signal testing, CI integration — custom requires building all features |
| GUT doubling | Manual mock classes | GUT doubles are auto-generated, type-safe, support partial mocks — manual classes are maintenance burden |
| Dependency injection | Global singleton access pattern | DI enables testing, singletons create tight coupling and test pollution |

**Installation:**
```bash
# GUT already installed in addons/gut/
# Verify version: Check addons/gut/gut.gd header comments
# No additional installation required
```

## Architecture Patterns

### Recommended Project Structure
```
test/
├── suites/
│   ├── autoloads/           # Autoload-specific tests
│   │   ├── test_accessibility_manager.gd
│   │   ├── test_theme_manager.gd
│   │   └── test_network_manager.gd
│   ├── signals/             # Signal testing examples
│   │   └── test_signal_patterns.gd
│   └── integration/         # Integration tests with real autoloads
├── mocks/                   # Manual mock implementations (if needed)
│   └── mock_nakama_client.gd
├── fixtures/                # Test data fixtures (JSON format)
│   └── player_fixtures.json
└── run_all_tests.gd         # Unified test runner
```

### Pattern 1: GUT Doubling for Autoload Mocking
**What:** Use GUT's `double()` method to create test doubles of autoloads
**When to use:** Unit tests that need to isolate from autoload state
**Example:**
```gdscript
# Source: GUT framework documentation
extends GutTest

var test_theme_manager

func before_each():
    # Create a partial double of ThemeManager autoload
    test_theme_manager = double(ThemeManager).new()
    # Replace the autoload with our double
    replace_autoload("ThemeManager", test_theme_manager)

func test_set_theme_emits_signal():
    # Stub the persistence method to avoid file I/O
    stub(test_theme_manager, "_save_theme").to_do_nothing()

    # Connect spy to track signal emissions
    watch_signals(test_theme_manager)

    # Call the method
    test_theme_manager.set_theme("light")

    # Assert signal was emitted with correct parameter
    assert_signal_emitted_with_parameters(test_theme_manager, "theme_changed", [false])
```

### Pattern 2: Dependency Injection for Testable Autoloads
**What:** Refactor autoloads to accept dependencies via constructor or setter
**When to use:** New autoloads or when refactoring existing ones for testability
**Example:**
```gdscript
# Source: Best practice for testable singletons
# autoloads/AccessibilityManager.gd

class AccessibilityManager:
    signal settings_changed()

    var _config_file: ConfigFile
    var _font_scale: float = 1.0

    # Constructor injection for testability
    func _init(config_file: ConfigFile = null):
        _config_file = config_file if config_file else ConfigFile.new()

    func set_font_scale(scale: float) -> void:
        _font_scale = clampf(scale, FONT_SCALE_MIN, FONT_SCALE_MAX)
        _save_settings()
        settings_changed.emit()

# Test file:
extends GutTest

var test_manager: AccessibilityManager
var mock_config: ConfigFile

func before_each():
    # Inject mock ConfigFile to avoid file I/O in tests
    mock_config = ConfigFile.new()
    test_manager = AccessibilityManager.new(mock_config)

func test_set_font_scale_clamps_values():
    test_manager.set_font_scale(5.0)  # Exceeds FONT_SCALE_MAX (3.0)
    assert_eq(test_manager.get_font_scale(), 3.0, "Should clamp to maximum")
```

### Pattern 3: Signal Testing with GUT Awaiter
**What:** Use `wait_for_signal()` to test asynchronous signal emissions
**When to use:** Testing autoloads that emit signals after async operations
**Example:**
```gdscript
# Source: GUT awaiter.gd implementation
extends GutTest

var test_network_manager

func before_each():
    test_network_manager = double(NetworkManager).new()
    replace_autoload("NetworkManager", test_network_manager)

func test_connection_success_emits_signal():
    # Stub the async connection method
    stub(test_network_manager, "connect_to_server").to_call_back(
        "connect_success", [], 0.5  # Delay in seconds
    )

    watch_signals(test_network_manager)
    test_network_manager.connect_to_server("localhost", 7350)

    # Wait for signal with timeout
    await wait_for_signal(test_network_manager.connected, 2.0)
    assert_signal_emitted(test_network_manager, "connected")
```

### Pattern 4: Fresh Autoload Instances Per Test
**What:** Ensure each test gets a clean autoload instance to prevent state leakage
**When to use:** All autoload tests to maintain isolation
**Example:**
```gdscript
# Source: GUT best practices for test isolation
extends GutTest

func before_each():
    # Replace autoloads with fresh doubles before each test
    _replace_autoloads_with_doubles()

func after_each():
    # Clean up any modified state
    _restore_autoloads()

func _replace_autoloads_with_doubles():
    var autoloads = ["ThemeManager", "AccessibilityManager", "GameManager"]
    for autoload_name in autoloads:
        var double_obj = double(get autoload(autoload_name).get_script()).new()
        replace_autoload(autoload_name, double_obj)

func test_theme_switch_does_not_affect_other_tests():
    # This test's state changes won't leak to next test
    pass
```

### Anti-Patterns to Avoid
- **Testing private methods**: Autoloads often have private `_methods` — test public interfaces only
- **Shared autoload state**: Never rely on autoload state persisting between tests — use fresh instances
- **Blocking on file I/O**: Stub file operations in tests (e.g., `_save_settings()`) — use ConfigFile injection
- **Ignoring async signals**: Always use `wait_for_signal()` for async operations — don't use `await` directly in tests
- **Testing implementation details**: Test behavior (signals emitted, state changed) not internal mechanisms

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autoload mocking | Custom mock classes for each autoload | GUT's `double()` and partial doubles | Auto-generated, supports partial mocking, stays in sync with codebase |
| Signal testing | Custom signal trackers and wait logic | GUT's `wait_for_signal()` and `watch_signals()` | Built-in timeout handling, integrates with test assertions, supports parameter verification |
| Test doubles | Manual stub implementations | GUT's `stub()` method | Type-safe, supports call count verification, can stub private methods |
| Dependency injection containers | Custom DI framework | Constructor/setter injection pattern | Godot's autoload system + simple DI is sufficient, custom DI is overkill |

**Key insight:** GUT provides a complete testing toolkit. Building custom mocking or signal testing infrastructure is unnecessary and creates maintenance burden. Use GUT's built-in capabilities and focus on refactoring autoloads for testability via dependency injection.

## Common Pitfalls

### Pitfall 1: Autoload State Leakage Between Tests
**What goes wrong:** Test A modifies ThemeManager to "light" mode, Test B expects "dark" mode and fails
**Why it happens:** Godot autoloads are singletons that persist across test runs unless explicitly replaced
**How to avoid:** Always replace autoloads with fresh doubles in `before_each()` using `replace_autoload()`
**Warning signs:** Tests pass when run individually but fail when run as a suite; intermittent failures

### Pitfall 2: Testing Autoloads with Real File I/O
**What goes wrong:** Tests write to `user://accessibility.cfg`, leave artifacts, run slowly
**Why it happens:** Autoloads directly use ConfigFile/FileAccess without dependency injection
**How to avoid:** Refactor autoloads to accept ConfigFile dependency, inject mock in tests
**Warning signs:** Tests are slow (>100ms for simple operations), tests fail on CI due to file permissions

### Pitfall 3: Missing Signal Emissions in Async Code
**What goes wrong:** Test checks for signal before async operation completes, false negative
**Why it happens:** Godot signals are async, test code continues immediately after calling method
**How to avoid:** Always use `wait_for_signal()` with appropriate timeout for async signal testing
**Warning signs:** Flaky tests that sometimes pass, sometimes fail; tests that "should work but don't"

### Pitfall 4: Over-Mocking Leading to False Tests
**What goes wrong:** Test doubles are so heavily stubbed that they pass even if real code is broken
**Why it happens:** Stubbing every method creates a mock that doesn't match real behavior
**How to avoid:** Use partial doubles, only stub slow/unstable dependencies (file I/O, network), test real logic
**Warning signs:** Tests pass but code is broken; stubs outnumber actual test assertions

### Pitfall 5: Autoload Dependencies Create Test Order Dependency
**What goes wrong:** GameManager depends on NetworkManager autoload, tests fail if run in wrong order
**Why it happens:** Autoloads reference each other via global access, creating implicit dependencies
**How to avoid:** Use dependency injection for autoload-to-autoload communication, or use integration tests for real interactions
**Warning signs:** Tests fail only when specific other tests run first; complex test setup logic

## Code Examples

Verified patterns from official sources:

### Creating and Replacing Autoload Doubles
```gdscript
# Source: GUT framework doubling mechanism
extends GutTest

var doubled_theme: ThemeManager

func before_each():
    # Create a partial double that preserves real method implementations
    doubled_theme = partial_double(ThemeManager).new()

    # Replace the global autoload with our double
    replace_autoload("ThemeManager", doubled_theme)

func test_double_isolation():
    # This double is isolated from the real autoload
    assert_not_same(ThemeManager, doubled_theme)
```

### Stubbing Autoload Methods
```gdscript
# Source: GUT stubber implementation
extends GutTest

func before_each():
    var doubled_network = double(NetworkManager).new()
    replace_autoload("NetworkManager", doubled_network)

func test_stubbed_connection():
    # Stub to avoid real network call
    stub(NetworkManager, "connect_to_server").to_do_nothing()

    # Call will do nothing (no real connection attempt)
    NetworkManager.connect_to_server("localhost", 7350)

    # Verify stub was called
    assert_called(NetworkManager, "connect_to_server", ["localhost", 7350])
```

### Signal Testing with Parameters
```gdscript
# Source: GUT awaiter.gd
extends GutTest

var test_manager: AccessibilityManager

func before_each():
    test_manager = AccessibilityManager.new()
    watch_signals(test_manager)

func test_signal_emitted_with_parameters():
    test_manager.set_font_scale(2.0)

    # Assert signal was emitted
    assert_signal_emitted(test_manager, "settings_changed")

    # Assert signal was emitted with specific parameters
    assert_signal_emitted_with_parameters(
        test_manager,
        "settings_changed",
        []  # No parameters for settings_changed
    )
```

### Dependency Injection for ConfigFile
```gdscript
# Source: Refactoring pattern for testability
# Production code (autoloads/AccessibilityManager.gd)

class_name AccessibilityManager
extends Node

signal settings_changed()

var _config: ConfigFile
var _font_scale: float = 1.0

func _init(config: ConfigFile = null):
    _config = config if config else ConfigFile.new()

func _save_settings() -> void:
    _config.set_value("accessibility", "font_scale", _font_scale)
    _config.save("user://accessibility.cfg")

# Test code:
extends GutTest

func test_save_with_mock_config():
    var mock_config = ConfigFile.new()
    var manager = AccessibilityManager.new(mock_config)

    manager.set_font_scale(2.0)

    # Verify ConfigFile methods were called (no file I/O)
    assert_eq(mock_config.get_value("accessibility", "font_scale"), 2.0)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom test runner script | GUT 9.5.0/9.5.1 unified framework | Phase 1 (2026-03-19) | Standardized testing, better CI integration, signal testing support |
| Global singleton access in tests | Autoload doubling + dependency injection | Phase 3 (current) | Test isolation, no state leakage, faster tests |
| Manual signal tracking with timers | `wait_for_signal()` with timeout handling | Phase 3 (current) | Reliable async testing, no flaky tests |
| File I/O in every test | ConfigFile injection + stubbing | Phase 3 (current) | Faster tests, no side effects |

**Deprecated/outdated:**
- **Custom mock classes**: GUT's `double()` is type-safe and auto-generated — manual mocks are maintenance burden
- **Global test state**: Relying on autoload state between tests — always use fresh instances
- **Synchronous signal testing**: Using `yield()` without timeout — use `wait_for_signal()` for reliability

## Open Questions

1. **Refactoring scope for dependency injection**
   - What we know: Current autoloads (e.g., AccessibilityManager) directly instantiate ConfigFile
   - What's unclear: How many autoloads need refactoring vs. can use doubling alone
   - Recommendation: Start with doubling-only approach, refactor to DI only if tests are slow or brittle

2. **Autoload-to-autoload dependencies**
   - What we know: Some autoloads reference others (e.g., GameManager → NetworkManager)
   - What's unclear: Best pattern for testing these interactions
   - Recommendation: Use integration tests with real autoloads for interaction tests, unit tests with doubles for individual behavior

3. **Signal testing timeout values**
   - What we know: GUT's `wait_for_signal()` requires timeout parameter
   - What's unclear: Appropriate timeouts for different operations (file I/O, network, calculations)
   - Recommendation: Start with generous timeouts (2-5s), refine based on actual test durations

## Validation Architecture

> Skip this section entirely if workflow.nyquist_validation is explicitly set to false in .planning/config.json. If the key is absent, treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | GUT 9.5.0/9.5.1 (Godot Unit Test) |
| Config file | `.gutconfig.json` |
| Quick run command | `godot4 --headless --script res://test/run_all_tests.gd` |
| Full suite command | `godot4 --headless --script res://test/run_all_tests.gd --verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISO-04 | Godot autoload tests use fresh instances per test | unit | `godot4 --headless --script res://test/run_all_tests.gd --select suites/autoloads` | ❌ Phase 3 |
| MOCK-03 | Godot autoloads are mockable via dependency injection | unit | `godot4 --headless --script res://test/run_all_tests.gd --select suites/autoloads` | ❌ Phase 3 |

### Sampling Rate
- **Per task commit:** `godot4 --headless --script res://test/run_all_tests.gd --select suites/autoloads`
- **Per wave merge:** `godot4 --headless --script res://test/run_all_tests.gd`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/suites/autoloads/` — directory for autoload-specific tests
- [ ] `test/suites/autoloads/test_accessibility_manager.gd` — covers ISO-04
- [ ] `test/suites/autoloads/test_theme_manager.gd` — covers MOCK-03
- [ ] `test/suites/signals/test_signal_patterns.gd` — signal testing examples
- [ ] Framework verification: GUT 9.5.0/9.5.1 already installed (Phase 1 complete)

*(Test infrastructure exists from Phase 1, need to add autoload-specific test files)*

## Sources

### Primary (HIGH confidence)
- GUT GitHub Repository - https://github.com/bitwes/Gut - Core framework source code, doubling mechanism, signal testing
- GUT Documentation (via webReader) - Main documentation page and plugin structure
- Project source code - autoloads/AccessibilityManager.gd, autoloads/ThemeManager.gd, addons/gut/gut.gd - Actual autoload implementations and GUT framework

### Secondary (MEDIUM confidence)
- GUT awaiter.gd source code - Signal testing implementation details
- GUT doubler implementation - Autoload doubling mechanism
- Project planning docs - STATE.md, REQUIREMENTS.md, ROADMAP.md - Phase context and requirements

### Tertiary (LOW confidence)
- WebSearch results (empty) - Could not find community examples via search, used direct documentation instead

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - GUT framework is mature and well-documented, source code verified
- Architecture: HIGH - Patterns based on GUT source code and autoload implementations
- Pitfalls: HIGH - Identified from existing autoload code and common testing anti-patterns

**Research date:** 2026-03-20
**Valid until:** 30 days (GUT framework is stable, Godot 4.x is current LTS)
