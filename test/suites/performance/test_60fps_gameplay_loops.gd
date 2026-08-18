extends GutTest

# Issue #1025: in headless GUT runs the autoloads are loaded, so the global
# identifiers GameManager/CombatManager resolve to the singleton INSTANCES —
# calling .new() on them fails with Nil errors. Load the scripts and
# instantiate those instead (same pattern as test_game_manager.gd /
# test_combat_manager.gd).
var GameManagerClass = load("res://autoloads/GameManager.gd")
var CombatManagerClass = load("res://autoloads/CombatManager.gd")

# Test core gameplay maintains 60 FPS target
func test_core_gameplay_60_fps() -> void:
	# Headless dummy renderer caps reported FPS at ~30, making the 55 FPS
	# gate unachievable in CI — gate on real display servers only (#976).
	if DisplayServer.get_name() == "headless":
		pending("ENV_DEPENDENT: FPS test is meaningless under headless dummy renderer; see issue #976")
		return

	# Setup - Create GameManager instance
	var game_manager = GameManagerClass.new()
	add_child_autofree(game_manager)

	# Initialize game
	game_manager.start_game()

	# FPS sampling - Simulate 60 seconds of gameplay (3600 frames at 60 FPS)
	var fps_samples: Array[float] = []
	var frame_time_samples: Array[float] = []
	var test_frames = 3600  # 60 seconds at 60 FPS

	print("[test_core_gameplay_60_fps] Starting 60-second gameplay simulation...")

	for i in range(test_frames):
		# Process game logic. GameManager is event-driven and defines no
		# per-frame callbacks (calling an unoverridden virtual like _process
		# is an error in Godot 4.6), so guard the same way the enemy loop
		# below does.
		var delta = 1.0 / 60.0
		if game_manager.has_method("_process"):
			game_manager._process(delta)
		if game_manager.has_method("_physics_process"):
			game_manager._physics_process(delta)

		# Collect FPS samples every 60 frames (1 second). Skip the frame-0
		# warmup sample: Engine.get_frames_per_second() has no stable window
		# before the first rendered frame (see headless baseline test).
		if i % 60 == 0 and i > 0:
			var current_fps = Engine.get_frames_per_second()
			fps_samples.append(current_fps)

			# Calculate frame time
			var frame_time = 1000.0 / max(current_fps, 1.0)
			frame_time_samples.append(frame_time)

		# Wait for next frame
		await get_tree().process_frame

	print("[test_core_gameplay_60_fps] Collected %d FPS samples" % fps_samples.size())

	# Validation - Calculate statistics
	var avg_fps: float = 0.0
	var min_fps: float = 999999.0
	for fps in fps_samples:
		avg_fps += fps
		if fps < min_fps:
			min_fps = fps
	avg_fps /= fps_samples.size()

	# Calculate P95 frame time
	frame_time_samples.sort()
	var p95_index = int(frame_time_samples.size() * 0.95)
	var p95_frame_time = frame_time_samples[p95_index]

	# Print results
	print("[test_core_gameplay_60_fps] Average FPS: %.2f" % avg_fps)
	print("[test_core_gameplay_60_fps] Minimum FPS: %.2f" % min_fps)
	print("[test_core_gameplay_60_fps] P95 Frame Time: %.2f ms" % p95_frame_time)

	# Assertions
	assert_gt(avg_fps, 55.0, "Average FPS should be >= 55 (target: 60)")
	assert_gt(min_fps, 30.0, "Minimum FPS should be > 30")
	assert_lt(p95_frame_time, 20.0, "Frame time P95 should be < 20ms")

# Test combat calculations are fast enough for 60 FPS
func test_combat_calculations_performance() -> void:
	# Setup - Create CombatManager instance
	var combat_manager = CombatManagerClass.new()
	add_child_autofree(combat_manager)

	# Benchmark parameters
	var iterations = 1000
	var base_damage = 100
	var attacker_stats = {"attack": 50, "crit_rate": 20}
	var defender_stats = {"defense": 40, "dodge": 10}
	var crit_multiplier = 1.5

	print("[test_combat_calculations_performance] Running %d combat calculations..." % iterations)

	# Measure start time
	var start_time = Time.get_ticks_msec()

	# Run combat calculations
	for i in range(iterations):
		var damage = combat_manager.calculate_damage(
			base_damage,
			attacker_stats,
			defender_stats,
			crit_multiplier
		)

		# Verify damage is calculated (not negative)
		assert_true(damage >= 0, "Damage should be non-negative")

	# Measure end time
	var end_time = Time.get_ticks_msec()
	var total_time_ms = end_time - start_time
	var avg_time_ms = float(total_time_ms) / float(iterations)

	# Print results
	print("[test_combat_calculations_performance] Total time: %d ms" % total_time_ms)
	print("[test_combat_calculations_performance] Average time per calculation: %.3f ms" % avg_time_ms)

	# Validation - Assert calculations are fast enough
	assert_lt(avg_time_ms, 1.0, "Combat calculation should take < 1ms")
	assert_true(total_time_ms < 1000, "1000 iterations should complete in < 1000ms")

# Test UI rendering maintains 60 FPS
func test_ui_rendering_performance() -> void:
	# Headless dummy renderer caps reported FPS at ~30, making the 55 FPS
	# gate unachievable in CI — gate on real display servers only (#976).
	if DisplayServer.get_name() == "headless":
		pending("ENV_DEPENDENT: FPS test is meaningless under headless dummy renderer; see issue #976")
		return

	# Setup - Create test scene with UI components
	var test_scene = Node.new()
	add_child_autofree(test_scene)

	# Create UI components
	var buttons: Array[Node] = []
	var labels: Array[Node] = []
	var progress_bars: Array[Node] = []

	# Load UI component scripts
	var base_button_script = load("res://scenes/ui/components/base_button.gd")
	var base_label_script = load("res://scenes/ui/components/base_label.gd")
	var base_progress_bar_script = load("res://scenes/ui/components/base_progress_bar.gd")

	# Create 10 buttons
	for i in range(10):
		var button = Node.new()
		button.set_script(base_button_script)
		test_scene.add_child(button)
		buttons.append(button)

	# Create 5 labels
	for i in range(5):
		var label = Node.new()
		label.set_script(base_label_script)
		test_scene.add_child(label)
		labels.append(label)

	# Create 3 progress bars
	for i in range(3):
		var progress_bar = Node.new()
		progress_bar.set_script(base_progress_bar_script)
		test_scene.add_child(progress_bar)
		progress_bars.append(progress_bar)

	print("[test_ui_rendering_performance] Created %d buttons, %d labels, %d progress bars" % [buttons.size(), labels.size(), progress_bars.size()])

	# Simulate - Run 300 frames (5 seconds at 60 FPS)
	var fps_samples: Array[float] = []
	var test_frames = 300

	print("[test_ui_rendering_performance] Starting 300-frame UI simulation...")

	for i in range(test_frames):
		var delta = 1.0 / 60.0

		# Process each UI component
		for button in buttons:
			if button.has_method("_process"):
				button._process(delta)

		for label in labels:
			if label.has_method("_process"):
				label._process(delta)

		for progress_bar in progress_bars:
			if progress_bar.has_method("_process"):
				progress_bar._process(delta)

		# Simulate state changes
		if i % 60 == 0:
			# Simulate button hover/click every second
			for button in buttons:
				if button.has_method("_on_mouse_entered"):
					button._on_mouse_entered()

			# Simulate progress bar value changes
			for progress_bar in progress_bars:
				if progress_bar.has_method("set_value"):
					progress_bar.set_value(float(i % 100) / 100.0)

		# Collect FPS samples every 60 frames (1 second)
		if i % 60 == 0:
			var current_fps = Engine.get_frames_per_second()
			fps_samples.append(current_fps)

		await get_tree().process_frame

	print("[test_ui_rendering_performance] Collected %d FPS samples" % fps_samples.size())

	# Validation - Calculate statistics
	var avg_fps: float = 0.0
	var min_fps: float = 999999.0
	for fps in fps_samples:
		avg_fps += fps
		if fps < min_fps:
			min_fps = fps
	avg_fps /= fps_samples.size()

	# Print results
	print("[test_ui_rendering_performance] Average FPS: %.2f" % avg_fps)
	print("[test_ui_rendering_performance] Minimum FPS: %.2f" % min_fps)

	# Assertions
	assert_gt(avg_fps, 55.0, "Average FPS should be >= 55 during UI rendering")
	assert_gt(min_fps, 40.0, "Minimum FPS should be > 40 during UI updates")

# Looser baseline that also holds under the headless dummy renderer (~30 FPS cap),
# so CI still catches catastrophic UI frame-loop regressions (#976).
# Uses native Control types: the component scripts emit pre-existing engine
# errors in a bare scene context, which GUT's error watcher would flag.
func test_ui_rendering_performance_headless_baseline() -> void:
	# Setup - Create test scene with native UI controls
	var test_scene = Node.new()
	add_child_autofree(test_scene)

	# Create 10 buttons, 5 labels, 3 progress bars (18 controls)
	var buttons: Array[Button] = []
	var labels: Array[Label] = []
	var progress_bars: Array[ProgressBar] = []

	for i in range(10):
		var button := Button.new()
		test_scene.add_child(button)
		buttons.append(button)

	for i in range(5):
		var label := Label.new()
		label.text = "Sample %d" % i
		test_scene.add_child(label)
		labels.append(label)

	for i in range(3):
		var progress_bar := ProgressBar.new()
		test_scene.add_child(progress_bar)
		progress_bars.append(progress_bar)

	print("[test_ui_rendering_performance_headless_baseline] Created %d buttons, %d labels, %d progress bars" % [buttons.size(), labels.size(), progress_bars.size()])

	# Simulate - Run 300 frames, sampling FPS every 60 frames.
	# Skip the frame-0 warmup sample: Engine.get_frames_per_second()
	# has no stable window before the first rendered frame.
	var fps_samples: Array[float] = []
	var test_frames = 300

	for i in range(test_frames):
		# Simulate state changes every second
		if i % 60 == 0 and i > 0:
			for button in buttons:
				button.mouse_entered.emit()

			for progress_bar in progress_bars:
				progress_bar.value = float(i % 100) / 100.0

			fps_samples.append(Engine.get_frames_per_second())

		await get_tree().process_frame

	# Validation - Calculate average
	var avg_fps: float = 0.0
	for fps in fps_samples:
		avg_fps += fps
	avg_fps /= fps_samples.size()

	print("[test_ui_rendering_performance_headless_baseline] Collected %d FPS samples" % fps_samples.size())
	print("[test_ui_rendering_performance_headless_baseline] Average FPS: %.2f" % avg_fps)

	# Looser bound: headless dummy renderer reports ~30 FPS
	assert_gt(avg_fps, 25.0, "Headless baseline should clear 25 FPS")

# Test performance with multiple enemies
func test_multiple_enemies_performance() -> void:
	# Headless dummy renderer caps reported FPS at ~30, making the 50 FPS
	# gate unachievable in CI — gate on real display servers only (#976).
	if DisplayServer.get_name() == "headless":
		pending("ENV_DEPENDENT: FPS test is meaningless under headless dummy renderer; see issue #976")
		return

	# Setup - Create GameManager with simulated enemies
	var game_manager = GameManagerClass.new()
	add_child_autofree(game_manager)

	game_manager.start_game()

	# Create 10 enemy instances (simple Node2D with basic behavior)
	var enemies: Array[Node2D] = []

	for i in range(10):
		var enemy = Node2D.new()
		enemy.position = Vector2(randf() * 1000 - 500, randf() * 1000 - 500)
		game_manager.add_child(enemy)
		enemies.append(enemy)

	print("[test_multiple_enemies_performance] Created %d enemy instances" % enemies.size())

	# Simulate - Run 600 frames (10 seconds at 60 FPS)
	var fps_samples: Array[float] = []
	var frame_time_samples: Array[float] = []
	var test_frames = 600

	print("[test_multiple_enemies_performance] Starting 600-frame enemy simulation...")

	for i in range(test_frames):
		var delta = 1.0 / 60.0

		# Process game manager (guarded: no per-frame callbacks on GameManager)
		if game_manager.has_method("_process"):
			game_manager._process(delta)
		if game_manager.has_method("_physics_process"):
			game_manager._physics_process(delta)

		# Update all enemy positions/behaviors
		for enemy in enemies:
			# Simulate enemy movement
			var movement = Vector2(randf() * 10 - 5, randf() * 10 - 5)
			enemy.position += movement * delta

			# Simulate enemy behavior processing
			if enemy.has_method("_process"):
				enemy._process(delta)
			if enemy.has_method("_physics_process"):
				enemy._physics_process(delta)

		# Simulate player movement and combat actions
		if i % 30 == 0:  # Every 0.5 seconds
			# Simulate combat action
			game_manager.take_player_damage(randi() % 10)

		# Collect FPS samples every 60 frames (1 second). Skip the frame-0
		# warmup sample: Engine.get_frames_per_second() has no stable window
		# before the first rendered frame (see headless baseline test).
		if i % 60 == 0 and i > 0:
			var current_fps = Engine.get_frames_per_second()
			fps_samples.append(current_fps)

			# Calculate frame time
			var frame_time = 1000.0 / max(current_fps, 1.0)
			frame_time_samples.append(frame_time)

		await get_tree().process_frame

	print("[test_multiple_enemies_performance] Collected %d FPS samples" % fps_samples.size())

	# Validation - Calculate statistics
	var avg_fps: float = 0.0
	var min_fps: float = 999999.0
	for fps in fps_samples:
		avg_fps += fps
		if fps < min_fps:
			min_fps = fps
	avg_fps /= fps_samples.size()

	# Calculate P95 frame time
	frame_time_samples.sort()
	var p95_index = int(frame_time_samples.size() * 0.95)
	var p95_frame_time = frame_time_samples[p95_index]

	# Print results
	print("[test_multiple_enemies_performance] Average FPS: %.2f" % avg_fps)
	print("[test_multiple_enemies_performance] Minimum FPS: %.2f" % min_fps)
	print("[test_multiple_enemies_performance] P95 Frame Time: %.2f ms" % p95_frame_time)

	# Assertions (slightly lower threshold for stress test)
	assert_gt(avg_fps, 50.0, "Average FPS should be >= 50 with 10 enemies")
	assert_gt(min_fps, 25.0, "Minimum FPS should be > 25 during intense moments")
	assert_lt(p95_frame_time, 25.0, "Frame time P95 should be < 25ms")
