extends GutTest
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")

# Pilot test for manual line execution instrumentation
# This test validates the coverage tracking approach before full implementation
# Tracks 10-15 key lines in CombatManager.gd for proof of concept

# Issue #1025: in headless GUT runs the autoloads are loaded, so the global
# identifier CombatManager resolves to the singleton INSTANCE — calling .new()
# on it fails with Nil errors. Load the script and instantiate that instead.
var CombatManagerClass = load("res://autoloads/CombatManager.gd")
var _combat
var _mock_network: StubNetworkManager

# The suite hand-rolls its NetworkManager stub instead of using
# `double(Node)`: GUT 9.6 doubles of native engine classes carry null
# doubling metadata and never record or intercept calls, so the old
# stub(_mock_network, ...) lines silently configured nothing (issue
# #1062). The stub class below implements exactly the NetworkManager
# surface CombatManager touches.

# --- Test Doubles ---

## Minimal NetworkManager stub. `send_rpc` returns `rpc_response`
## synchronously, so CombatManager's `await` resumes immediately.
class StubNetworkManager extends Node:
	var is_connected: bool = true
	var rpc_response: Dictionary = {"success": true, "result": {}}

	func send_rpc(_rpc_id: String, _payload: String, _timeout: float = 30.0) -> Dictionary:
		return rpc_response

# --- Fixtures ---

func before_each():
	# Create fresh CombatManager instance for each test (ISO-04 pattern)
	_combat = CombatManagerClass.new()
	add_child_autofree(_combat)

	# Create stub NetworkManager for RPC isolation (hand-rolled class —
	# GUT 9.6 native-class doubles never intercept, issue #1062)
	_mock_network = StubNetworkManager.new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	_combat.set("network_manager", _mock_network)

func test_basic_damage_calculation_tracks_coverage():
	"""Test basic damage calculation with coverage tracking."""
	# Track function entry (line 170: var attack = attacker_stats.get("attack", 0))
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 170)

	var attacker_stats = {"attack": 50, "crit_rate": 10.0}
	var defender_stats = {"defense": 20, "dodge": 0.0}
	var result = _combat.calculate_damage(100, attacker_stats, defender_stats, 1.5)

	# Track dodge check (line 176: var dodge_roll = randf() * 100.0)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 176)

	# Track damage calculation (line 187: var damage = base_damage + attack - defense)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 187)

	# Track minimum damage enforcement (line 188: damage = max(1, damage))
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 188)

	# Track return (line 193: return damage)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 193)

	assert_true(result > 0, "Damage should be greater than 0")

func test_dodge_branch_tracks_coverage():
	"""Test dodge branch with coverage tracking."""
	# Track dodge check entry (line 176: var dodge_roll = randf() * 100.0)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 176)

	var attacker_stats = {"attack": 50, "crit_rate": 0.0}
	var defender_stats = {"defense": 0, "dodge": 100.0}  # 100% dodge chance

	# Track dodged return (line 178: return 0  # Dodged)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 178)

	var result = _combat.calculate_damage(100, attacker_stats, defender_stats, 1.5)
	assert_eq(result, 0, "Damage should be 0 when dodged")

func test_critical_hit_branch_tracks_coverage():
	"""Test critical hit branch with coverage tracking."""
	# Track dodge check (line 176: var dodge_roll = randf() * 100.0)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 176)

	# Track critical hit check (line 182: var crit_roll = randf() * 100.0)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 182)

	var attacker_stats = {"attack": 50, "crit_rate": 100.0}  # 100% crit chance
	var defender_stats = {"defense": 20, "dodge": 0.0}

	# Track critical hit flag (line 184: is_crit = true)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 184)

	# Track critical hit multiplier (line 191: damage = int(damage * crit_multiplier))
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 191)

	var result = _combat.calculate_damage(100, attacker_stats, defender_stats, 1.5)
	assert_true(result > 100, "Critical hit should multiply damage")

func test_defense_reduction_tracks_coverage():
	"""Test defense reduction with coverage tracking."""
	# Track function entry (line 170: var attack = attacker_stats.get("attack", 0))
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 170)

	var attacker_stats = {"attack": 0, "crit_rate": 0.0}
	var defender_stats = {"defense": 50, "dodge": 0.0}

	# Track damage calculation (line 187: var damage = base_damage + attack - defense)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 187)

	# Track minimum damage enforcement (line 188: damage = max(1, damage))
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 188)

	var result = _combat.calculate_damage(100, attacker_stats, defender_stats, 1.0)
	assert_eq(result, 50, "Damage should be reduced by defense (100 + 0 - 50 = 50)")

func test_get_my_health_tracks_coverage():
	"""Test get_my_health with coverage tracking."""
	# Track function entry (line 139: func get_my_health() -> int:)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 139)

	# Set health and verify
	_combat.set("my_health", 75)
	var health = _combat.get_my_health()

	# Track return (line 140: return my_health)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 140)

	assert_eq(health, 75, "Should return my_health value")

func test_is_my_turn_sync_tracks_coverage():
	"""Test is_my_turn_sync with coverage tracking."""
	# Track function entry (line 145: func is_my_turn_sync() -> bool:)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 145)

	# Set turn and verify
	_combat.set("is_my_turn", true)
	var is_my_turn = _combat.is_my_turn_sync()

	# Track return (line 146: return is_my_turn)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 146)

	assert_true(is_my_turn, "Should return is_my_turn value")

func test_is_combat_active_tracks_coverage():
	"""Test is_combat_active with coverage tracking."""
	# Track function entry (line 154: func is_combat_active() -> bool:)
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 154)

	# Set match state and verify
	_combat.set("current_match_state", {"status": "active"})
	var is_active = _combat.is_combat_active()

	# Track return (line 155: return get_match_status() == "active")
	CoverageTracker.track_execution("res://autoloads/CombatManager.gd", 155)

	assert_true(is_active, "Should return true when status is active")
