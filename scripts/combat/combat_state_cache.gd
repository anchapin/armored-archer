class_name CombatStateCache
extends RefCounted

## ADR-0009 follow-up (issue #1714 option b): single read-through cache for
## the latest server-known combat snapshot. Both write paths feed it -
## CombatSyncManager's polling loop and CombatManager's post-RPC echo - and
## reads collapse onto these statics so every screen shows the same value.
## Last write wins by receive time; the server remains the only authority
## (ADR-0002, ADR-0005).

static var my_health: int = 0
static var opponent_health: int = 0
static var is_my_turn: bool = false
static var match_status: String = ""
static var source: String = ""  # "poll" | "rpc" | ""
static var received_at_msec: int = 0

static func update_snapshot(p_my_health: int, p_opponent_health: int, p_is_my_turn: bool, p_match_status: String, p_source: String) -> void:
	"""Records the latest server-known snapshot from either write path."""
	my_health = maxi(0, p_my_health)
	opponent_health = maxi(0, p_opponent_health)
	is_my_turn = p_is_my_turn
	match_status = p_match_status
	source = p_source
	received_at_msec = Time.get_ticks_msec()

static func reset() -> void:
	"""Clears the snapshot (combat end / test isolation)."""
	my_health = 0
	opponent_health = 0
	is_my_turn = false
	match_status = ""
	source = ""
	received_at_msec = 0
