extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running EncounterData Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_encounter_count()
	await test_get_encounter()
	await test_get_encounter_not_found()
	await test_get_all_encounters()
	await test_get_encounters_by_difficulty()
	await test_get_encounters_by_biome()
	await test_is_boss_encounter()
	await test_encounter_data_structure()
	await test_encounter_progression()

	print("\n=== EncounterData Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_encounter_data() -> Node:
	var ed = load("res://autoloads/EncounterData.gd").new()
	add_child(ed)
	await get_tree().process_frame
	return ed

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_encounter_count() -> void:
	var ed = await _create_encounter_data()

	if ed.encounters.size() == 9:
		_pass("test_encounter_count")
	else:
		_fail("test_encounter_count", "Should have 9 encounters, got %d" % ed.encounters.size())

	ed.queue_free()

func test_get_encounter() -> void:
	var ed = await _create_encounter_data()

	var encounter = ed.get_encounter("forest_goblin")

	if encounter.has("id") and encounter["id"] == "forest_goblin":
		_pass("test_get_encounter_by_id")
	else:
		_fail("test_get_encounter_by_id", "Should return encounter with matching ID")

	if encounter.has("name") and encounter["name"] == "Forest Goblin":
		_pass("test_get_encounter_name")
	else:
		_fail("test_get_encounter_name", "Should return encounter with correct name")

	ed.queue_free()

func test_get_encounter_not_found() -> void:
	var ed = await _create_encounter_data()

	var encounter = ed.get_encounter("nonexistent_encounter")

	if encounter.is_empty():
		_pass("test_get_encounter_not_found")
	else:
		_fail("test_get_encounter_not_found", "Should return empty dict for unknown encounter")

	ed.queue_free()

func test_get_all_encounters() -> void:
	var ed = await _create_encounter_data()

	var all_ids = ed.get_all_encounters()

	if all_ids.size() == 9:
		_pass("test_get_all_encounters_count")
	else:
		_fail("test_get_all_encounters_count", "Should return 9 encounter IDs")

	if "forest_goblin" in all_ids and "ancient_guardian" in all_ids:
		_pass("test_get_all_encounters_contains")
	else:
		_fail("test_get_all_encounters_contains", "Should contain expected encounters")

	ed.queue_free()

func test_get_encounters_by_difficulty() -> void:
	var ed = await _create_encounter_data()

	var diff1 = ed.get_encounters_by_difficulty(1)
	if diff1.size() == 3:
		_pass("test_difficulty_1_count")
	else:
		_fail("test_difficulty_1_count", "Difficulty 1 should have 3 encounters, got %d" % diff1.size())

	var diff2 = ed.get_encounters_by_difficulty(2)
	if diff2.size() == 3:
		_pass("test_difficulty_2_count")
	else:
		_fail("test_difficulty_2_count", "Difficulty 2 should have 3 encounters, got %d" % diff2.size())

	var diff3 = ed.get_encounters_by_difficulty(3)
	if diff3.size() == 3:
		_pass("test_difficulty_3_count")
	else:
		_fail("test_difficulty_3_count", "Difficulty 3 should have 3 encounters, got %d" % diff3.size())

	if "forest_goblin" in diff1 and "cavern_golem" in diff2 and "sky_drake" in diff3:
		_pass("test_difficulty_correct_encounters")
	else:
		_fail("test_difficulty_correct_encounters", "Difficulty filtering should return correct encounters")

	ed.queue_free()

func test_get_encounters_by_biome() -> void:
	var ed = await _create_encounter_data()

	var forest = ed.get_encounters_by_biome("forest")
	if forest.size() == 3:
		_pass("test_biome_forest_count")
	else:
		_fail("test_biome_forest_count", "Forest biome should have 3 encounters, got %d" % forest.size())

	var cavern = ed.get_encounters_by_biome("cavern")
	if cavern.size() == 3:
		_pass("test_biome_cavern_count")
	else:
		_fail("test_biome_cavern_count", "Cavern biome should have 3 encounters, got %d" % cavern.size())

	var sky = ed.get_encounters_by_biome("sky")
	if sky.size() == 3:
		_pass("test_biome_sky_count")
	else:
		_fail("test_biome_sky_count", "Sky biome should have 3 encounters, got %d" % sky.size())

	ed.queue_free()

func test_is_boss_encounter() -> void:
	var ed = await _create_encounter_data()

	if ed.is_boss_encounter("forest_alpha"):
		_pass("test_boss_forest_alpha")
	else:
		_fail("test_boss_forest_alpha", "forest_alpha should be a boss")

	if ed.is_boss_encounter("cavern_warlord"):
		_pass("test_boss_cavern_warlord")
	else:
		_fail("test_boss_cavern_warlord", "cavern_warlord should be a boss")

	if ed.is_boss_encounter("ancient_guardian"):
		_pass("test_boss_ancient_guardian")
	else:
		_fail("test_boss_ancient_guardian", "ancient_guardian should be a boss")

	if not ed.is_boss_encounter("forest_goblin"):
		_pass("test_not_boss_forest_goblin")
	else:
		_fail("test_not_boss_forest_goblin", "forest_goblin should not be a boss")

	if not ed.is_boss_encounter("nonexistent"):
		_pass("test_not_boss_nonexistent")
	else:
		_fail("test_not_boss_nonexistent", "Nonexistent encounter should not be a boss")

	ed.queue_free()

func test_encounter_data_structure() -> void:
	var ed = await _create_encounter_data()

	var encounter = ed.get_encounter("forest_goblin")

	if encounter.has("enemy") and encounter["enemy"].has("health"):
		_pass("test_encounter_has_enemy_stats")
	else:
		_fail("test_encounter_has_enemy_stats", "Encounter should have enemy with health")

	if encounter.has("loot") and encounter["loot"].has("xp"):
		_pass("test_encounter_has_loot")
	else:
		_fail("test_encounter_has_loot", "Encounter should have loot with xp")

	if encounter.has("biome") and encounter.has("difficulty"):
		_pass("test_encounter_has_metadata")
	else:
		_fail("test_encounter_has_metadata", "Encounter should have biome and difficulty")

	ed.queue_free()

func test_encounter_progression() -> void:
	var ed = await _create_encounter_data()

	# Verify difficulty scaling
	var forest_boss = ed.get_encounter("forest_alpha")
	var cavern_boss = ed.get_encounter("cavern_warlord")
	var sky_boss = ed.get_encounter("ancient_guardian")

	if sky_boss["enemy"]["health"] > cavern_boss["enemy"]["health"]:
		_pass("test_boss_health_scaling")
	else:
		_fail("test_boss_health_scaling", "Boss health should scale with difficulty")

	if sky_boss["enemy"]["attack"] > cavern_boss["enemy"]["attack"]:
		_pass("test_boss_attack_scaling")
	else:
		_fail("test_boss_attack_scaling", "Boss attack should scale with difficulty")

	if sky_boss["loot"]["xp"] > cavern_boss["loot"]["xp"]:
		_pass("test_boss_xp_scaling")
	else:
		_fail("test_boss_xp_scaling", "Boss XP reward should scale with difficulty")

	ed.queue_free()
