extends GutTest

# Unit tests for const.gd
# Tests that constants are correctly defined and accessible

const Const = preload("res://autoloads/const.gd")

func test_default_player_health() -> void:
	assert_eq(Const.DEFAULT_PLAYER_HEALTH, 100, "Default player health should be 100")

func test_default_player_speed() -> void:
	assert_eq(Const.DEFAULT_PLAYER_SPEED, 300.0, "Default player speed should be 300.0")

func test_max_stages() -> void:
	assert_eq(Const.MAX_STAGES, 50, "Max stages should be 50")

func test_waves_per_stage() -> void:
	assert_eq(Const.WAVES_PER_STAGE, 3, "Waves per stage should be 3")

func test_default_server_url() -> void:
	assert_eq(Const.DEFAULT_SERVER_URL, "http://localhost:7350", "Default server URL should match")

func test_api_version() -> void:
	assert_eq(Const.API_VERSION, "v2", "API version should be v2")

func test_request_timeout() -> void:
	assert_eq(Const.REQUEST_TIMEOUT, 10.0, "Request timeout should be 10.0")

func test_critical_hit_chance() -> void:
	assert_eq(Const.CRITICAL_HIT_CHANCE, 0.15, "Critical hit chance should be 0.15")

func test_critical_hit_multiplier() -> void:
	assert_eq(Const.CRITICAL_HIT_MULTIPLIER, 2.0, "Critical hit multiplier should be 2.0")

func test_base_damage() -> void:
	assert_eq(Const.BASE_DAMAGE, 10, "Base damage should be 10")

func test_default_animation_duration() -> void:
	assert_eq(Const.DEFAULT_ANIMATION_DURATION, 0.3, "Default animation duration should be 0.3")

func test_fast_animation_duration() -> void:
	assert_eq(Const.FAST_ANIMATION_DURATION, 0.15, "Fast animation duration should be 0.15")

func test_slow_animation_duration() -> void:
	assert_eq(Const.SLOW_ANIMATION_DURATION, 0.5, "Slow animation duration should be 0.5")

func test_ui_transition_duration() -> void:
	assert_eq(Const.UI_TRANSITION_DURATION, 0.25, "UI transition duration should be 0.25")

func test_damage_popup_duration() -> void:
	assert_eq(Const.DAMAGE_POPUP_DURATION, 1.0, "Damage popup duration should be 1.0")

func test_screen_shake_duration() -> void:
	assert_eq(Const.SCREEN_SHAKE_DURATION, 0.3, "Screen shake duration should be 0.3")

func test_hit_effect_duration() -> void:
	assert_eq(Const.HIT_EFFECT_DURATION, 0.5, "Hit effect duration should be 0.5")

func test_equipment_slots() -> void:
	assert_eq(Const.EQUIPMENT_SLOTS.size(), 5, "Equipment slots should have 5 items")
	assert_true(Const.EQUIPMENT_SLOTS.has("helm"), "Equipment slots should include helm")
	assert_true(Const.EQUIPMENT_SLOTS.has("armor"), "Equipment slots should include armor")
	assert_true(Const.EQUIPMENT_SLOTS.has("bow"), "Equipment slots should include bow")
	assert_true(Const.EQUIPMENT_SLOTS.has("arrow"), "Equipment slots should include arrow")
	assert_true(Const.EQUIPMENT_SLOTS.has("amulet"), "Equipment slots should include amulet")

func test_gear_rarities() -> void:
	assert_eq(Const.GEAR_RARITIES.size(), 4, "Gear rarities should have 4 items")
	assert_true(Const.GEAR_RARITIES.has("common"), "Gear rarities should include common")
	assert_true(Const.GEAR_RARITIES.has("rare"), "Gear rarities should include rare")
	assert_true(Const.GEAR_RARITIES.has("epic"), "Gear rarities should include epic")
	assert_true(Const.GEAR_RARITIES.has("legendary"), "Gear rarities should include legendary")

func test_joystick_deadzone() -> void:
	assert_eq(Const.JOYSTICK_DEADZONE, 0.1, "Joystick deadzone should be 0.1")

func test_max_fps() -> void:
	assert_eq(Const.MAX_FPS, 60, "Max FPS should be 60")

func test_target_frame_time() -> void:
	assert_between(Const.TARGET_FRAME_TIME, 0.016, 0.017, "Target frame time should be ~0.016")

func test_constants_are_immutable() -> void:
	var health = Const.DEFAULT_PLAYER_HEALTH
	assert_eq(health, 100, "Constants should be readable")

func test_equipment_slots_order() -> void:
	var slots = Const.EQUIPMENT_SLOTS
	assert_eq(slots[0], "helm", "First slot should be helm")
	assert_eq(slots[4], "amulet", "Last slot should be amulet")

func test_gear_rarities_order() -> void:
	var rarities = Const.GEAR_RARITIES
	assert_eq(rarities[0], "common", "First rarity should be common")
	assert_eq(rarities[3], "legendary", "Last rarity should be legendary")

func test_combat_constants_relationship() -> void:
	assert_true(Const.CRITICAL_HIT_MULTIPLIER > 1.0, "Critical multiplier should be greater than 1")
	assert_true(Const.CRITICAL_HIT_CHANCE > 0.0 and Const.CRITICAL_HIT_CHANCE < 1.0, "Crit chance should be between 0 and 1")

func test_animation_constants_relationship() -> void:
	assert_true(Const.FAST_ANIMATION_DURATION < Const.DEFAULT_ANIMATION_DURATION, "Fast should be less than default")
	assert_true(Const.SLOW_ANIMATION_DURATION > Const.DEFAULT_ANIMATION_DURATION, "Slow should be greater than default")

func test_effect_constants_are_positive() -> void:
	assert_true(Const.DAMAGE_POPUP_DURATION > 0.0, "Damage popup duration should be positive")
	assert_true(Const.SCREEN_SHAKE_DURATION > 0.0, "Screen shake duration should be positive")
	assert_true(Const.HIT_EFFECT_DURATION > 0.0, "Hit effect duration should be positive")

func test_performance_constants() -> void:
	assert_true(Const.MAX_FPS > 0, "Max FPS should be positive")
	assert_true(Const.TARGET_FRAME_TIME > 0.0, "Target frame time should be positive")
	assert_eq(Const.TARGET_FRAME_TIME, 1.0 / Const.MAX_FPS, "Target frame time should equal 1/MAX_FPS")

func test_network_constants() -> void:
	assert_true(Const.REQUEST_TIMEOUT > 0.0, "Request timeout should be positive")
	assert_true(Const.DEFAULT_SERVER_URL.begins_with("http"), "Server URL should be valid HTTP URL")
	assert_ne(Const.API_VERSION, "", "API version should not be empty")
