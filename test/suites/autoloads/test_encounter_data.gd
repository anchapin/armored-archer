extends GutTest

var EncounterDataClass = load("res://autoloads/EncounterData.gd")

func before_each():
	super.before_each()
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)

func test_encounter_data_initializes():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	assert_true(ed != null, "EncounterData should instantiate")
	assert_true(ed.has_method("get_encounter"), "Should have get_encounter method")
	assert_true(ed.has_method("get_all_encounters"), "Should have get_all_encounters method")

func test_encounters_dictionary_exists():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	assert_true(ed.encounters != null, "Encounters dictionary should exist")
	assert_true(ed.encounters.size() > 0, "Encounters should not be empty")

func test_get_all_encounters():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var all_encounters = ed.get_all_encounters()
	assert_true(all_encounters.size() > 0, "Should return encounters")
	assert_true(all_encounters.size() == 9, "Should have 9 encounters")

func test_get_encounter_by_id():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var encounter = ed.get_encounter("forest_goblin")
	assert_true(encounter.size() > 0, "Should return encounter data")
	assert_eq(encounter.get("id"), "forest_goblin", "ID should match")

func test_get_encounter_not_found():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var encounter = ed.get_encounter("invalid_id")
	assert_true(encounter.is_empty(), "Should return empty dict for invalid ID")

func test_get_encounters_by_difficulty():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var difficulty_1 = ed.get_encounters_by_difficulty(1)
	assert_true(difficulty_1.size() > 0, "Should have difficulty 1 encounters")
	var difficulty_2 = ed.get_encounters_by_difficulty(2)
	assert_true(difficulty_2.size() > 0, "Should have difficulty 2 encounters")
	var difficulty_3 = ed.get_encounters_by_difficulty(3)
	assert_true(difficulty_3.size() > 0, "Should have difficulty 3 encounters")

func test_get_encounters_by_biome():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var forest = ed.get_encounters_by_biome("forest")
	assert_true(forest.size() > 0, "Should have forest encounters")
	var cavern = ed.get_encounters_by_biome("cavern")
	assert_true(cavern.size() > 0, "Should have cavern encounters")
	var sky = ed.get_encounters_by_biome("sky")
	assert_true(sky.size() > 0, "Should have sky encounters")

func test_is_boss_encounter():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	assert_true(ed.is_boss_encounter("forest_alpha"), "forest_alpha should be boss")
	assert_true(ed.is_boss_encounter("cavern_warlord"), "cavern_warlord should be boss")
	assert_true(ed.is_boss_encounter("ancient_guardian"), "ancient_guardian should be boss")
	assert_false(ed.is_boss_encounter("forest_goblin"), "forest_goblin should not be boss")

func test_encounter_enemy_stats():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var encounter = ed.get_encounter("forest_goblin")
	var enemy = encounter.get("enemy")
	assert_true(enemy.has("health"), "Should have health")
	assert_true(enemy.has("attack"), "Should have attack")
	assert_true(enemy.has("defense"), "Should have defense")
	assert_true(enemy.has("speed"), "Should have speed")

func test_encounter_loot():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var encounter = ed.get_encounter("forest_goblin")
	var loot = encounter.get("loot")
	assert_true(loot.has("xp"), "Should have xp")
	assert_true(loot.has("gold"), "Should have gold")

func test_all_biomes_represented():
	var ed = EncounterDataClass.new()
	add_child_autofree(ed)
	var all_encounters = ed.get_all_encounters()
	var biomes = {}
	for encounter_id in all_encounters:
		var encounter = ed.get_encounter(encounter_id)
		var biome = encounter.get("biome")
		biomes[biome] = true
	assert_true(biomes.has("forest"), "Should have forest biome")
	assert_true(biomes.has("cavern"), "Should have cavern biome")
	assert_true(biomes.has("sky"), "Should have sky biome")
