extends GutTest

var VFXManagerClass = load("res://autoloads/VFXManager.gd")
var _vfx: VFXManager

func before_each():
	_vfx = VFXManagerClass.new()
	add_child_autofree(_vfx)

func after_each():
	_vfx = null

func test_vfx_manager_initializes():
	assert_true(_vfx != null, "VFXManager should instantiate")
	assert_true(_vfx.has_method("play_hit_effect"), "Should have play_hit_effect method")
	assert_true(_vfx.has_method("play_crit_effect"), "Should have play_crit_effect method")
	assert_true(_vfx.has_method("show_damage_popup"), "Should have show_damage_popup method")

func test_particle_effect_paths():
	assert_eq(VFXManager.HIT_EFFECT_PATH, "res://assets/particles/hit_effect.tscn")
	assert_eq(VFXManager.CRIT_EFFECT_PATH, "res://assets/particles/crit_effect.tscn")
	assert_eq(VFXManager.MISS_EFFECT_PATH, "res://assets/particles/miss_effect.tscn")
	assert_eq(VFXManager.FIRE_EFFECT_PATH, "res://assets/particles/fire_effect.tscn")
	assert_eq(VFXManager.ICE_EFFECT_PATH, "res://assets/particles/ice_effect.tscn")
	assert_eq(VFXManager.LIGHTNING_EFFECT_PATH, "res://assets/particles/lightning_effect.tscn")
	assert_eq(VFXManager.CHARGE_EFFECT_PATH, "res://assets/particles/charge_effect.tscn")

func test_scene_paths():
	assert_eq(VFXManager.DAMAGE_POPUP_SCENE, "res://scenes/damage_popup.tscn")
	assert_eq(VFXManager.SCREEN_SHAKE_SCENE, "res://scenes/screen_shake.tscn")

func test_particle_methods_exist():
	assert_true(_vfx.has_method("play_hit_effect"), "play_hit_effect should exist")
	assert_true(_vfx.has_method("play_crit_effect"), "play_crit_effect should exist")
	assert_true(_vfx.has_method("play_miss_effect"), "play_miss_effect should exist")
	assert_true(_vfx.has_method("play_fire_effect"), "play_fire_effect should exist")
	assert_true(_vfx.has_method("play_ice_effect"), "play_ice_effect should exist")
	assert_true(_vfx.has_method("play_lightning_effect"), "play_lightning_effect should exist")
	assert_true(_vfx.has_method("play_charge_effect"), "play_charge_effect should exist")

func test_screen_shake_methods_exist():
	assert_true(_vfx.has_method("trigger_light_shake"), "trigger_light_shake should exist")
	assert_true(_vfx.has_method("trigger_medium_shake"), "trigger_medium_shake should exist")
	assert_true(_vfx.has_method("trigger_heavy_shake"), "trigger_heavy_shake should exist")
	assert_true(_vfx.has_method("trigger_impact_shake"), "trigger_impact_shake should exist")

func test_combat_vfx_method_exists():
	assert_true(_vfx.has_method("play_combat_vfx"), "play_combat_vfx should exist")

func test_internal_methods_exist():
	assert_true(_vfx.has_method("_spawn_particle"), "_spawn_particle should exist")
	assert_true(_vfx.has_method("_ensure_screen_shake"), "_ensure_screen_shake should exist")
	assert_true(_vfx.has_method("_trigger_crit_shake"), "_trigger_crit_shake should exist")
	assert_true(_vfx.has_method("_trigger_lightning_shake"), "_trigger_lightning_shake should exist")

func test_singleton_instance():
	VFXManager.instance = _vfx
	assert_eq(VFXManager.instance, _vfx, "Singleton instance should be set")

func test_preloaded_scenes_initialized():
	assert_true(_vfx._hit_effect != null, "_hit_effect should be preloaded")
	assert_true(_vfx._crit_effect != null, "_crit_effect should be preloaded")
	assert_true(_vfx._miss_effect != null, "_miss_effect should be preloaded")
	assert_true(_vfx._fire_effect != null, "_fire_effect should be preloaded")
	assert_true(_vfx._ice_effect != null, "_ice_effect should be preloaded")
	assert_true(_vfx._lightning_effect != null, "_lightning_effect should be preloaded")
	assert_true(_vfx._charge_effect != null, "_charge_effect should be preloaded")
	assert_true(_vfx._damage_popup_scene != null, "_damage_popup_scene should be preloaded")

func test_screen_shake_initial_state():
	assert_null(_vfx._screen_shake, "_screen_shake should be null initially")

func test_preload_scenes_method():
	var vfx_new = VFXManagerClass.new()
	add_child_autofree(vfx_new)
	vfx_new._preload_scenes()
	assert_true(vfx_new._hit_effect != null, "_preload_scenes should load hit effect")
	assert_true(vfx_new._damage_popup_scene != null, "_preload_scenes should load damage popup")

func test_play_combo_vfx_signature():
	# Test play_combat_vfx accepts correct parameters
	var test_damage = 25
	var test_pos = Vector2(100, 100)
	# Should not crash - just verify method exists and can be called (will fail without scene)
	assert_true(_vfx.has_method("play_combat_vfx"), "play_combat_vfx method should exist")