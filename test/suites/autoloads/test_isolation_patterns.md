# Autoload Test Isolation Patterns

> Last updated: 2026-03-21
>
> This document documents established patterns for testing Godot autoloads with GUT framework.

## Overview

Autoloads in Godot are singletons loaded at game startup. Testing autoloads requires special patterns to:
- Prevent state pollution between tests
- Isolate file I/O operations
- Mock external dependencies (network, analytics, etc.)
- Verify signal emissions correctly

## Patterns Reference

### ISO-04: Fresh Instance Isolation

**What:** Create a fresh autoload instance for each test to prevent state pollution.

**When to use:** Testing autoloads that maintain state (all autoloads).

**Example:**
```gdscript
extends GutTest

var _manager: ThemeManager

func before_each():
	# Create fresh instance for each test
	_manager = ThemeManager.new(ConfigFile.new())
	add_child_autofree(_manager)

func after_each():
	_manager = null  # GUT handles cleanup via autofree

func test_multiple_tests_dont_share_state():
	var manager2 = ThemeManager.new(ConfigFile.new())
	_manager.set_theme("light")
	manager2.set_theme("dark")

	assert_eq(_manager.get_theme_name(), "light", "Manager1 should be light")
	assert_eq(manager2.get_theme_name(), "dark", "Manager2 should be dark")
```

**Why:** Autoloads are global singletons; tests sharing an instance pollute state.

**Key benefits:**
- Each test starts with clean state
- Tests don't depend on execution order
- No shared memory between tests

### MOCK-03: ConfigFile Dependency Injection

**What:** Inject mock ConfigFile to prevent file I/O during tests.

**When to use:** Autoloads that read/write to disk via ConfigFile.

**Example:**
```gdscript
extends GutTest

var _manager: AccessibilityManager
var _mock_config: ConfigFile

func before_each():
	# Create fresh mock ConfigFile
	_mock_config = ConfigFile.new()
	# Inject mock to avoid file I/O
	_manager = AccessibilityManager.new(_mock_config)
	add_child_autofree(_manager)

func test_config_file_injection():
	_manager.set_font_scale(1.3)
	# Verify ConfigFile was used (no actual file written)
	assert_eq(_mock_config.get_value("accessibility", "font_scale", 1.0), 1.3)
```

**Autoload side (requires constructor modification):**
```gdscript
extends Node

var _config: ConfigFile

func _init(config: ConfigFile = null) -> void:
	_config = config

func _ready() -> void:
	if _config == null:
		_config = ConfigFile.new()
		# Load from file only if no injected config
		_load_settings()
```

**Why:** File I/O in tests causes side effects and slows execution.

**Key benefits:**
- Tests run faster (no disk I/O)
- No test artifacts left on disk
- Deterministic test behavior

### SIG-01: Signal Testing with watch_signals()

**What:** Use GUT's watch_signals() to verify signal emissions.

**When to use:** Testing autoloads that emit signals (most autoloads).

**Example:**
```gdscript
extends GutTest

var _manager: GameManager

func before_each():
	_manager = GameManager.new()
	add_child_autofree(_manager)

func test_health_changed_signal():
	watch_signals(_manager)  # Enable signal watching

	_manager.take_player_damage(30)

	# Verify signal was emitted with correct parameters
	assert_signal_emitted(_manager, "health_changed")
	assert_signal_emitted_with_parameters(_manager, "health_changed", [70, 100])

func test_multiple_signals():
	watch_signals(_manager)

	_manager.take_player_damage(30)
	_manager.heal_player(20)

	assert_signal_emitted(_manager, "health_changed", "Should emit once per change")
```

**Why:** Signals are the primary communication mechanism in Godot; tests must verify they emit correctly.

**Key benefits:**
- Verifies signals are emitted (not just methods called)
- Tests signal emission with correct parameters
- Detects missing signal connections

## Anti-Patterns to Avoid

### Don't: Access Global Autoloads Directly

```gdscript
# BAD - accesses global singleton
func test_autoload_directly():
	var nm = get_node("/root/NetworkManager")
	nm.session_token = "test"

# GOOD - creates fresh instance
func test_autoload_isolated():
	var nm = load("res://autoloads/NetworkManager.gd").new()
	nm.session_token = "test"
```

### Don't: Share State Between Tests

```gdscript
# BAD - _manager is shared across tests
var _manager: GameManager

func before_all():
	_manager = GameManager.new()  # Created once for all tests

# GOOD - fresh instance per test
func before_each():
	_manager = GameManager.new()  # Created per test
```

### Don't: Test Private Methods

```gdscript
# BAD - tests implementation detail
func test_private_calculate():
	_manager._calculate_internal(10)  # Tests private method

# GOOD - tests public behavior
func test_public_behavior():
	var result = _manager.public_method(10)  # Tests contract
```

## NetworkManager-Specific Patterns

NetworkManager has special considerations due to HTTPRequest and RPC functionality.

### MOCK-04: HTTPRequest Mocking

**What:** Mock HTTPRequest to prevent real network calls during tests.

**Example:**
```gdscript
extends GutTest

var _network: NetworkManager
var _mock_http: Node

func before_each():
	_network = NetworkManager.new()
	add_child_autofree(_network)

	# Create mock HTTPRequest using GUT's double() functionality
	_mock_http = double(HTTPRequest).new()
	_mock_http.request_completed = Signal()
	add_child_autofree(_mock_http)

	# Stub HTTPRequest.request() to return OK and prevent actual network calls
	stub(_mock_http, "request").to_return(OK)

	# Replace the http_request node in NetworkManager
	_network.http_request = _mock_http

func test_rpc_without_real_network():
	# Test RPC behavior without actual network calls
	_network.is_connected = true
	_network.session_token = "test_token"

	var result = await _network.send_rpc("test_rpc", "{}")
	# Verify mock received the call (check internal state)
```

**Why:** Real network calls are slow, flaky, and can fail during tests.

**Key benefits:**
- Tests run instantly (no network latency)
- Deterministic behavior (no network flakiness)
- No external dependencies required

### SIG-02: Async Signal Waiting with wait_for_signal()

**What:** Use wait_for_signal() for asynchronous operations like authentication.

**Example:**
```gdscript
extends GutTest

var _network: NetworkManager

func before_each():
	_network = NetworkManager.new()
	add_child_autofree(_network)

func test_async_authentication():
	watch_signals(_network)

	# Set up to handle the async signal
	var auth_success = false
	var auth_error = ""

	_network.session_created.connect(func(success, error):
		auth_success = success
		auth_error = error
	)

	_network.authenticate_device()

	# Wait for the signal with timeout
	await wait_for_signal(_network.session_created, 1.0)

	assert_true(auth_success, "Should successfully authenticate")
	assert_eq(auth_error, "", "Should have no error message")
```

**Why:** Network operations are asynchronous; tests must wait for completion.

**Key benefits:**
- Tests async operations correctly
- Prevents race conditions
- Clear test flow (setup → act → verify)

### RECONN-01: Reconnection State Testing

**What:** Test reconnection logic without actually reconnecting.

**Example:**
```gdscript
extends GutTest

var _network: NetworkManager

func before_each():
	_network = NetworkManager.new()
	add_child_autofree(_network)

func test_reconnection_attempts():
	# Test reconnection state without actual network operations
	_network._retry_attempts = 0
	_network._is_reconnecting = false

	_network.attempt_reconnection()

	assert_eq(_network._retry_attempts, 1, "Should increment attempts")
	assert_true(_network._is_reconnecting, "Should be reconnecting")

func test_max_retry_attempts():
	# Test that reconnection stops after MAX_RETRY_ATTEMPTS
	_network._retry_attempts = 0
	_network._is_reconnecting = false

	for i in range(NetworkManager.MAX_RETRY_ATTEMPTS + 1):
		_network.attempt_reconnection()

	assert_eq(_network._retry_attempts, NetworkManager.MAX_RETRY_ATTEMPTS, "Should cap at max attempts")
```

**Why:** Reconnection logic is complex; testing state transitions ensures correctness.

**Key benefits:**
- Tests all reconnection paths
- Verifies retry limits
- No real network disruption required

## Best Practices

1. **Always use before_each() and after_each()** for test lifecycle management
2. **Use add_child_autofree()** for automatic resource cleanup
3. **Watch signals before triggering** to ensure emissions are captured
4. **Use descriptive failure messages** in assertions for debugging
5. **Test boundary conditions** explicitly (0, 100, min, max values)
6. **Verify multiple instances have independent state** to catch shared state bugs
7. **Mock all external dependencies** (network, analytics, file I/O) for isolation
8. **Test both sync and async operations** with appropriate verification methods

## CombatManager-Specific Patterns

CombatManager has special considerations for damage calculations and RPC dependencies.

### MOCK-05: NetworkManager Mocking for Combat

**What:** Mock NetworkManager in CombatManager tests to prevent RPC calls.

**Example:**
```gdscript
extends GutTest

var _combat: CombatManager
var _mock_network: Node

func before_each():
	# Create fresh CombatManager instance for each test (ISO-04 pattern)
	_combat = CombatManager.new()
	add_child_autofree(_combat)

	# Create mock NetworkManager using GUT's double() functionality
	_mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)

	# Stub NetworkManager methods that CombatManager uses
	stub(_mock_network, "is_connected").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true, "result": {}})

	# Inject mock by setting the @onready property directly
	_combat.set("network_manager", _mock_network)
```

**Why:** CombatManager depends on NetworkManager for RPC calls; mocking isolates combat logic.

**Key benefits:**
- Tests combat calculations independently
- No network latency or failures
- Predictable test behavior

### CALC-01: Deterministic Random Testing

**What:** Handle randf() in tests by either setting seed or verifying range-based behavior.

**Example:**
```gdscript
extends GutTest

var _combat: CombatManager

func before_each():
	_combat = CombatManager.new()
	add_child_autofree(_combat)

	# Create mock NetworkManager for isolation
	var _mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	stub(_mock_network, "is_connected").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true, "result": {}})
	_combat.set("network_manager", _mock_network)
	add_child_autofree(_mock_network)

func test_damage_calculation_with_crit():
	# Use 100% crit_rate for deterministic behavior
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 0, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)

	# With 100% crit_rate, damage should be doubled
	assert_eq(damage, 40, "Should apply crit multiplier")

func test_damage_calculation_with_dodge():
	# Use 100% dodge for deterministic behavior
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 0, "dodge": 100}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)

	# With 100% dodge, damage should be 0
	assert_eq(damage, 0, "Should dodge all attacks")

func test_damage_minimum_boundary():
	# Test damage never goes below 1
	var attacker_stats = {"attack": 0, "crit_rate": 0}
	var defender_stats = {"defense": 100, "dodge": 0}
	var damage = _combat.calculate_damage(10, attacker_stats, defender_stats, 1.0)

	# Even with negative calculation, min is 1
	assert_eq(damage, 1, "Damage should floor at 1")
```

**Why:** randf() makes tests non-deterministic; use 100% rates or test boundaries.

**Key benefits:**
- Deterministic test results
- Tests all boundary conditions
- No flaky tests due to randomness

## GameManager-Specific Patterns

GameManager has special considerations for game state and analytics integration.

### ANALYTICS-01: Analytics Mocking

**What:** Mock AnalyticsManager to prevent real analytics calls.

**Example:**
```gdscript
extends GutTest

var _game: GameManager
var _mock_analytics: Node

func before_each():
	# Create fresh GameManager instance for each test (ISO-04 pattern)
	_game = GameManager.new()
	add_child_autofree(_game)

	# Create mock AnalyticsManager using GUT's double() functionality
	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)

	# Stub AnalyticsManager methods that GameManager uses
	stub(_mock_analytics, "log_custom_event").to_call_super()
	stub(_mock_analytics, "log_pve_stage_started").to_call_super()
	stub(_mock_analytics, "log_pve_stage_completed").to_call_super()
	stub(_mock_analytics, "log_pve_stage_failed").to_call_super()

	# Inject mock by setting the @onready property directly
	_game.set("analytics", _mock_analytics)
```

**Why:** Analytics calls can be slow and may fail; mocking isolates game logic.

**Key benefits:**
- Tests game flow without analytics overhead
- No external service dependencies
- Faster test execution

### FLOW-01: Complete Game Flow Testing

**What:** Test complete game loop (start -> play -> end) rather than individual methods.

**Example:**
```gdscript
extends GutTest

var _game: GameManager
var _mock_analytics: Node

func before_each():
	_game = GameManager.new()
	add_child_autofree(_game)

	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	stub(_mock_analytics, "log_custom_event").to_call_super()
	stub(_mock_analytics, "log_pve_stage_started").to_call_super()
	_game.set("analytics", _mock_analytics)
	add_child_autofree(_mock_analytics)

func test_complete_game_flow():
	watch_signals(_game)

	# Start game
	_game.start_game()
	assert_eq(_game.player_current_health, 100, "Start should reset health to max")
	assert_true(_game.is_game_active, "Game should be active after start")
	assert_signal_emitted(_game, "health_changed")

	# Take damage during gameplay
	_game.take_player_damage(30)
	assert_eq(_game.player_current_health, 70, "Damage should reduce health")
	assert_signal_emitted(_game, "health_changed")

	# Take lethal damage
	_game.take_player_damage(80)  # Overkill
	assert_eq(_game.player_current_health, 0, "Health should be 0")
	assert_signal_emitted(_game, "player_died")

	# End game (loss)
	_game.end_game(false)
	assert_false(_game.is_game_active, "Game should not be active after end")

func test_complete_stage_flow():
	watch_signals(_game)

	# Start stage
	_game.start_game()
	assert_eq(_game.current_stage, 1, "Should start at stage 1")

	# Complete stage (advances to next)
	_game.complete_stage()
	assert_eq(_game.current_stage, 2, "Stage should increment")
	assert_false(_game.is_game_active, "Game should end after stage complete")
	assert_signal_emitted(_game, "stage_completed")
	assert_signal_emitted(_game, "game_won")

func test_reset_flow():
	watch_signals(_game)

	# Start and advance to stage 3
	_game.start_game()
	_game.current_stage = 3
	_game.player_current_health = 50

	# Reset
	_game.reset_stage()
	assert_eq(_game.current_stage, 1, "Stage should reset to 1")
	assert_eq(_game.player_current_health, 100, "Health should reset to max")
	assert_true(_game.is_game_active, "Game should be active after reset")
```

**Why:** Testing complete flows ensures integration between methods works correctly.

**Key benefits:**
- Catches integration bugs
- Tests real-world usage patterns
- Verifies signal emission throughout flow
