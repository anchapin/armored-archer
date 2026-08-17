extends GutTest

## Issue #910 guard test — stage-driven enemy spawning.
## Asserts the explicit enemy_scene_map, archetype map, and boss map
## cover every Ch1 archetype from data/campaigns.json.

const ENEMY_SPAWNER_PATH := "res://scenes/enemies/enemy_spawner.gd"
const CAMPAIGNS_PATH := "res://data/campaigns.json"

func before_all() -> void:
	pass

func after_all() -> void:
	pass

func before_each() -> void:
	pass

func after_each() -> void:
	pass

func _spawner_node() -> Node:
	var node := Node2D.new()
	node.set_script(load(ENEMY_SPAWNER_PATH))
	add_child_autofree(node)
	return node

func _archetypes_from_campaigns() -> Array:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(CAMPAIGNS_PATH))
	if typeof(parsed) != TYPE_DICTIONARY:
		return []
	var out: Array = []
	for campaign in parsed.get("campaigns", []):
		if campaign.get("id", "") != "chapter_1":
			continue
		for stage in campaign.get("stages", []):
			var enemy = stage.get("enemy", {})
			if enemy.has("type"):
				out.append(enemy["type"])
	return out

func test_enemy_scene_map_has_ch1_archetypes() -> void:
	var spawner: Node2D = _spawner_node()
	for archetype in _archetypes_from_campaigns():
		assert_true(spawner.archetype_scene_map.has(archetype),
			"Ch1 archetype '%s' must resolve through enemy_scene_map" % archetype)
		var scene = spawner.get_scene_for_archetype(archetype)
		assert_not_null(scene, "Scene for archetype '%s' should resolve" % archetype)

func test_ch1_stage_keys_resolve() -> void:
	var spawner: Node2D = _spawner_node()
	for stage_id in ["1_1", "1_2", "1_3", "1_4"]:
		var parts = stage_id.split("_")
		var ch := int(parts[0])
		var st := int(parts[1])
		spawner.current_chapter = ch
		spawner.current_stage = st
		spawner.last_stage_enemy_stats = {}
		var scene = spawner._resolve_current_stage_scene()
		assert_not_null(scene, "Stage %s must resolve to a PackedScene" % stage_id)

func test_boss_scene_map_covers_ch1_bosses() -> void:
	var spawner: Node2D = _spawner_node()
	for boss_id in ["boss_basic", "boss_wind", "boss_fire", "boss_ice", "boss_electric", "boss_king"]:
		assert_true(spawner.boss_scene_map.has(boss_id),
			"boss_id '%s' must be in boss_scene_map" % boss_id)
		var scene = spawner.get_boss_scene(boss_id)
		assert_not_null(scene, "Boss scene for '%s' should resolve" % boss_id)

func test_no_random_fallback_for_ch1_stages() -> void:
	# Set a stage context, ensure _resolve_current_stage_scene returns a
	# mapped PackedScene rather than falling back to the random path.
	var spawner: Node2D = _spawner_node()
	spawner.current_chapter = 1
	spawner.current_stage = 1
	spawner.last_stage_enemy_stats = {"type": "Goblin Scout"}
	var scene := spawner._resolve_current_stage_scene()
	assert_not_null(scene, "Ch1 stage 1_1 must resolve to a mapped scene")
	assert_eq(scene, spawner.SCOUT_ENEMY_SCENE,
		"Ch1 stage 1_1 (Goblin Scout) must map to SCOUT_ENEMY_SCENE")

func test_stage_stats_apply_to_enemy() -> void:
	var spawner: Node2D = _spawner_node()
	spawner.current_chapter = 1
	spawner.current_stage = 1
	spawner.last_stage_enemy_stats = {"type": "Goblin Scout", "health": 30, "attack": 8, "defense": 2, "speed": 10}
	var enemy = spawner.SCOUT_ENEMY_SCENE.instantiate()
	add_child_autofree(enemy)
	spawner._apply_stage_stats(enemy)
	assert_eq(int(enemy.max_health), 30, "Stage health should override scene default")
	assert_eq(int(enemy.damage), 8, "Stage attack should override scene default")
	assert_eq(int(enemy.move_speed), 10.0, "Stage speed should override scene default")

func test_set_active_stage_populates_context() -> void:
	var spawner: Node2D = _spawner_node()
	spawner.set_active_stage(1, 1, {"type": "Goblin Scout", "health": 30})
	assert_eq(spawner.current_chapter, 1)
	assert_eq(spawner.current_stage, 1)
	assert_eq(spawner.last_stage_enemy_stats["type"], "Goblin Scout")
	assert_eq(int(spawner.last_stage_enemy_stats["health"]), 30)
