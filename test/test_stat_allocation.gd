extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running StatAllocation Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_xp_level_1()
	await test_xp_level_2()
	await test_xp_level_3()
	await test_xp_level_5()
	await test_xp_level_10()
	await test_xp_monotonically_increasing()
	await test_button_disabled_at_zero_points()
	await test_button_enabled_with_points()

	print("\n=== StatAllocation Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_stat_allocation() -> Node:
	var control = Control.new()
	control.set_script(load("res://scenes/ui/stat_allocation.gd"))
	# Create required child nodes
	var vbox = VBoxContainer.new()
	vbox.name = "VBoxContainer"
	var stats_container = VBoxContainer.new()
	stats_container.name = "StatsContainer"

	# Level
	var level_container = HBoxContainer.new()
	level_container.name = "LevelContainer"
	var level_label = Label.new()
	level_label.name = "LevelLabel"
	level_container.add_child(level_label)
	stats_container.add_child(level_container)

	# XP
	var xp_container = HBoxContainer.new()
	xp_container.name = "XPContainer"
	var xp_label = Label.new()
	xp_label.name = "XPLabel"
	xp_container.add_child(xp_label)
	stats_container.add_child(xp_container)

	# Attack
	var attack_container = HBoxContainer.new()
	attack_container.name = "AttackContainer"
	var attack_value = Label.new()
	attack_value.name = "AttackValue"
	var attack_plus = Button.new()
	attack_plus.name = "AttackPlus"
	attack_container.add_child(attack_value)
	attack_container.add_child(attack_plus)
	stats_container.add_child(attack_container)

	# Defense
	var defense_container = HBoxContainer.new()
	defense_container.name = "DefenseContainer"
	var defense_value = Label.new()
	defense_value.name = "DefenseValue"
	var defense_plus = Button.new()
	defense_plus.name = "DefensePlus"
	defense_container.add_child(defense_value)
	defense_container.add_child(defense_plus)
	stats_container.add_child(defense_container)

	# Dodge
	var dodge_container = HBoxContainer.new()
	dodge_container.name = "DodgeContainer"
	var dodge_value = Label.new()
	dodge_value.name = "DodgeValue"
	var dodge_plus = Button.new()
	dodge_plus.name = "DodgePlus"
	dodge_container.add_child(dodge_value)
	dodge_container.add_child(dodge_plus)
	stats_container.add_child(dodge_container)

	# Crit Rate
	var crit_container = HBoxContainer.new()
	crit_container.name = "CritRateContainer"
	var crit_value = Label.new()
	crit_value.name = "CritRateValue"
	var crit_plus = Button.new()
	crit_plus.name = "CritRatePlus"
	crit_container.add_child(crit_value)
	crit_container.add_child(crit_plus)
	stats_container.add_child(crit_container)

	vbox.add_child(stats_container)

	var ability_label = Label.new()
	ability_label.name = "AbilityPointsLabel"
	vbox.add_child(ability_label)

	var xp_bar = ProgressBar.new()
	xp_bar.name = "XPProgressBar"
	vbox.add_child(xp_bar)

	var back_button = Button.new()
	back_button.name = "BackButton"
	vbox.add_child(back_button)

	var loading = Control.new()
	loading.name = "LoadingIndicator"
	control.add_child(loading)

	control.add_child(vbox)
	add_child(control)
	return control

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_xp_level_1() -> void:
	var sa = _create_stat_allocation()
	var xp = sa._get_xp_for_level(1)
	# Level 1 requires 0 XP (no iterations)
	if xp == 0:
		_pass("test_xp_level_1")
	else:
		_fail("test_xp_level_1", "Expected 0 got %d" % xp)
	sa.queue_free()

func test_xp_level_2() -> void:
	var sa = _create_stat_allocation()
	var xp = sa._get_xp_for_level(2)
	# Level 2 requires 100 XP (base_xp * 1 = 100)
	if xp == 100:
		_pass("test_xp_level_2")
	else:
		_fail("test_xp_level_2", "Expected 100 got %d" % xp)
	sa.queue_free()

func test_xp_level_3() -> void:
	var sa = _create_stat_allocation()
	var xp = sa._get_xp_for_level(3)
	# Level 3: 100 + int(100*1.5) = 100 + 150 = 250
	if xp == 250:
		_pass("test_xp_level_3")
	else:
		_fail("test_xp_level_3", "Expected 250 got %d" % xp)
	sa.queue_free()

func test_xp_level_5() -> void:
	var sa = _create_stat_allocation()
	var xp = sa._get_xp_for_level(5)
	# Level 5: 100 + 150 + 225 + 337 = 812
	if xp == 812:
		_pass("test_xp_level_5")
	else:
		_fail("test_xp_level_5", "Expected 812 got %d" % xp)
	sa.queue_free()

func test_xp_level_10() -> void:
	var sa = _create_stat_allocation()
	var xp = sa._get_xp_for_level(10)
	# Just verify it's a reasonable large number
	if xp > 1000:
		_pass("test_xp_level_10")
	else:
		_fail("test_xp_level_10", "Expected > 1000 got %d" % xp)
	sa.queue_free()

func test_xp_monotonically_increasing() -> void:
	var sa = _create_stat_allocation()
	var prev_xp = 0
	var passed = true
	for level in range(2, 15):
		var xp = sa._get_xp_for_level(level)
		if xp <= prev_xp:
			passed = false
			break
		prev_xp = xp
	if passed:
		_pass("test_xp_monotonically_increasing")
	else:
		_fail("test_xp_monotonically_increasing", "XP should increase monotonically")
	sa.queue_free()

func test_button_disabled_at_zero_points() -> void:
	var sa = _create_stat_allocation()
	sa.current_ability_points = 0
	sa._update_button_states()
	var attack_plus = sa.get_node("VBoxContainer/StatsContainer/AttackContainer/AttackPlus")
	if attack_plus.disabled:
		_pass("test_button_disabled_at_zero_points")
	else:
		_fail("test_button_disabled_at_zero_points", "Buttons should be disabled at 0 points")
	sa.queue_free()

func test_button_enabled_with_points() -> void:
	var sa = _create_stat_allocation()
	sa.current_ability_points = 5
	sa._update_button_states()
	var attack_plus = sa.get_node("VBoxContainer/StatsContainer/AttackContainer/AttackPlus")
	if not attack_plus.disabled:
		_pass("test_button_enabled_with_points")
	else:
		_fail("test_button_enabled_with_points", "Buttons should be enabled with ability points")
	sa.queue_free()
