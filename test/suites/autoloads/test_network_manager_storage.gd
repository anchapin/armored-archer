extends GutTest

# Tests for NetworkManager's synchronous storage cache (issue #1022).
#
# get_storage_sync() must return a non-null handle exposing the duck-typed
# surface the callers rely on: get()/put()/erase()/has() over a local
# last-known-value cache persisted to user://. Reads of missing keys yield
# null so every caller's default-value fallback keeps working. No RPCs are
# issued — Nakama storage I/O stays on the domain RPCs (see RPC_MAP.md).

# --- Fixtures ---

const NetworkManagerScript = preload("res://autoloads/NetworkManager.gd")
const TEST_CACHE_PATH: String = "user://test_network_manager_storage_cache.json"
const TEST_CACHE_NAME: String = "test_network_manager_storage_cache.json"

var _network_manager: Node

func before_each() -> void:
	_remove_test_cache_file()
	# Not added to the tree: get_storage_sync() and the cache helpers are
	# plain methods and must not trigger _ready()'s auth/connect flow.
	_network_manager = NetworkManagerScript.new()
	autofree(_network_manager)
	_network_manager.set("storage_cache_path", TEST_CACHE_PATH)

func after_each() -> void:
	_remove_test_cache_file()

## Removes the redirected cache file so tests start from a clean slate.
func _remove_test_cache_file() -> void:
	if not FileAccess.file_exists(TEST_CACHE_PATH):
		return
	var dir: DirAccess = DirAccess.open("user://")
	if dir == null:
		push_warning("Could not open user:// to clean up test cache file")
		return
	var error: Error = dir.remove(TEST_CACHE_NAME)
	if error != OK:
		push_warning("Could not remove test cache file (error %d)" % error)

# --- Tests ---

func test_get_storage_sync_returns_valid_handle() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	assert_not_null(storage, "get_storage_sync() must never return null")
	assert_true(storage.has_method("put"), "handle must expose put()")
	assert_true(storage.has_method("erase"), "handle must expose erase()")
	assert_true(storage.has_method("has"), "handle must expose has()")

func test_get_storage_sync_returns_same_handle_instance() -> void:
	var first: Variant = _network_manager.get_storage_sync()
	var second: Variant = _network_manager.get_storage_sync()
	assert_eq(first, second, "repeated calls should reuse the cached handle")

func test_put_then_get_roundtrips_string_value() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	storage.put("match_results_m1", JSON.stringify({"winner": "player_a"}))
	var stored: Variant = storage.get("match_results_m1")
	assert_eq(stored, JSON.stringify({"winner": "player_a"}), "stored JSON string should read back unchanged")

func test_put_then_get_roundtrips_dictionary_value() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	var ratings: Dictionary = {"one_v_one": 1200, "two_v_two": 1150}
	storage.put("player_ratings", ratings)
	var stored: Variant = storage.get("player_ratings")
	assert_true(stored is Dictionary, "dictionary values should survive the roundtrip")
	assert_eq(stored.get("one_v_one"), 1200)

func test_get_missing_key_returns_null() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	assert_null(storage.get("player_ratings"), "missing keys must read as null so callers apply defaults")

func test_erase_removes_key() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	storage.put("pvp_pending_state", "{\"level\": 3}")
	assert_true(storage.has("pvp_pending_state"))
	storage.erase("pvp_pending_state")
	assert_false(storage.has("pvp_pending_state"), "erase() must drop the key")
	assert_null(storage.get("pvp_pending_state"))

func test_erase_missing_key_is_safe_noop() -> void:
	var storage: Variant = _network_manager.get_storage_sync()
	storage.erase("never_stored")
	assert_false(storage.has("never_stored"))

func test_cache_persists_across_manager_instances() -> void:
	var first: Variant = _network_manager.get_storage_sync()
	first.put("player_last_active", {"timestamp": 1712345678901})
	# A fresh manager over the same cache file models an app restart: the
	# last-known-value cache is what get_storage_sync() serves synchronously.
	var restarted: Node = NetworkManagerScript.new()
	autofree(restarted)
	restarted.set("storage_cache_path", TEST_CACHE_PATH)
	var storage: Variant = restarted.get_storage_sync()
	var stored: Variant = storage.get("player_last_active")
	assert_true(stored is Dictionary, "cached value should survive a restart")
	assert_eq(stored.get("timestamp"), 1712345678901)

func test_caller_duck_typing_contract() -> void:
	# Mirrors the exact guard sequence MatchResultsManager and
	# scenes/ui/pvp/match_results.gd use, then the unguarded get()/put()
	# style of PlayerRatingManager and MatchTransitionManager.
	assert_true(_network_manager.has_method("get_storage_sync"))
	var storage: Variant = _network_manager.get_storage_sync()
	if storage and storage.has_method("put"):
		storage.put("match_results_match_1", "{\"winner\": \"player_b\"}")
	if storage and storage.has_method("erase"):
		storage.erase("match_results_match_1")
	assert_false(storage.has("match_results_match_1"))
	storage.put("player_ratings", {"one_v_one": 1000})
	var stored: Variant = storage.get("player_ratings")
	assert_true(stored is Dictionary)
