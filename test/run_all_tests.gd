extends SceneTree

func _init():
    # Run tests immediately when the script is loaded
    _run_tests()
    quit()

func _run_tests():
    var test_files = [
        # Core game managers
        "res://test/test_combat_manager.gd",
        "res://test/test_game_manager.gd",
        "res://test/test_gear_manager.gd",
        "res://test/test_matchmaker_manager.gd",
        "res://test/test_matchmaking_manager.gd",
        "res://test/test_network_manager.gd",
        "res://test/test_player_stats_manager.gd",
        "res://test/test_store_manager.gd",
        "res://test/test_campaign_manager.gd",
        "res://test/test_season_manager.gd",
        "res://test/test_inventory_manager.gd",
        "res://test/test_shooting_manager.gd",

        # Gear and items
        "res://test/test_gear_registry.gd",
        "res://test/test_gem_manager.gd",
        "res://test/test_transmog_manager.gd",
        "res://test/test_gear_enums.gd",
        "res://test/test_encounter_data.gd",

        # UI and visual
        "res://test/test_ui_transition_optimizer.gd",
        "res://test/test_ui_automation.gd",
        "res://test/test_vfx_manager.gd",
        "res://test/test_theme_manager.gd",
        "res://test/test_safe_area_manager.gd",

        # Design tokens
        "res://test/test_archer_design_tokens.gd",
        "res://test/test_design_tokens.gd",
        "res://test/test_const.gd",

        # Audio
        "res://test/test_audio_manager.gd",

        # Accessibility
        "res://test/test_accessibility_manager.gd",

        # Combat and sync
        "res://test/test_combat_sync_manager.gd",
        "res://test/test_auto_aim_manager.gd",

        # Animation
        "res://test/test_animation_utils.gd",

        # Object pooling and performance
        "res://test/test_object_pool.gd",
        "res://test/test_performance_profiler.gd",
        "res://test/test_profiling_instrumentation.gd",
        "res://test/test_low_end_device_performance.gd",
        "res://test/test_performance_benchmarks.gd",
        "res://test/test_network_resilience.gd",

        # Scripts
        "res://test/test_arrow.gd",
        "res://test/test_screen_shake.gd",
        "res://test/test_camera_shake_integration.gd",
        "res://test/test_damage_popup.gd",
        "res://test/test_character_body_2d.gd",
        "res://test/test_background_palette.gd",
        "res://test/test_sprite_palette.gd",
        "res://test/test_screenshot_capture.gd",

        # Analytics and visual tests
        "res://test/test_analytics_manager.gd",
        "res://test/test_gilded_backgrounds.gd",
        "res://test/test_gilded_character_sprites.gd",

        # Scene scripts (enemies)
        "res://test/test_base_enemy.gd",
        "res://test/test_enemy_spawner.gd",
        "res://test/test_melee_enemy.gd",
        "res://test/test_ranged_enemy.gd",
        "res://test/test_tank_enemy.gd",
        "res://test/test_speed_enemy.gd",
        "res://test/test_scout_enemy.gd",
        "res://test/test_brute_enemy.gd",
        "res://test/test_guardian_enemy.gd",
        "res://test/test_swarmer_enemy.gd",
        "res://test/test_necromancer_enemy.gd",
        "res://test/test_boss_basic.gd",
        "res://test/test_boss_fire.gd",

        # Scene scripts (player/gear)
        "res://test/test_gear_data.gd",
        "res://test/test_gear_slot.gd",
        "res://test/test_cosmetic_skin_data.gd",
        "res://test/test_modular_character_sprite.gd",

        # UI components
        "res://test/test_ui_components.gd",

        # UI scenes
        "res://test/test_loadout.gd",
        "res://test/test_stat_allocation.gd",

        # Extended coverage
        "res://test/test_gear_enums_coverage.gd"
    ]

    var test_root = Node.new()
    test_root.name = "TestRoot"

    for test_file in test_files:
        var test_script = load(test_file)
        if test_script:
            var test_instance = test_script.new()
            test_root.add_child(test_instance)
        else:
            print("Warning: Could not load test file: " + test_file)

    # Quit the test runner after a short delay to allow tests to run
    await create_timer(5.0).timeout

    # Clean up
    for child in test_root.get_children():
        child.free()

    quit()
