extends Node

func _ready():
    var test_files = [
        "res://test/test_combat_manager.gd",
        "res://test/test_game_manager.gd",
        "res://test/test_gear_manager.gd",
        "res://test/test_matchmaker_manager.gd",
        "res://test/test_network_manager.gd",
        "res://test/test_player_stats_manager.gd",
        "res://test/test_store_manager.gd",
        "res://test/test_campaign_manager.gd",
        "res://test/test_season_manager.gd",
        "res://test/test_gear_registry.gd",
        "res://test/test_gem_manager.gd",
        "res://test/test_transmog_manager.gd",
        "res://test/test_safe_area_manager.gd",
        "res://test/test_auto_aim_manager.gd",
        "res://test/test_ui_transition_optimizer.gd"
    ]

    for test_file in test_files:
        var test_script = load(test_file)
        if test_script:
            var test_instance = test_script.new()
            add_child(test_instance)
        else:
            print("Warning: Could not load test file: " + test_file)

    # Quit the test runner after a short delay to allow tests to run
    await get_tree().create_timer(5.0).timeout
    get_tree().quit()
