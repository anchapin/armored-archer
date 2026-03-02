extends Node

func _ready():
    var test_files = [
        "res://test/test_combat_manager.gd",
        "res://test/test_game_manager.gd",
        "res://test/test_gear_manager.gd",
        "res://test/test_matchmaker_manager.gd",
        "res://test/test_network_manager.gd",
        "res://test/test_player_stats_manager.gd",
        "res://test/test_store_manager.gd"
    ]

    for test_file in test_files:
        var test_script = load(test_file)
        var test_instance = test_script.new()
        add_child(test_instance)

    # Quit the test runner after a short delay to allow tests to run
    await get_tree().create_timer(2.0).timeout
    get_tree().quit()
