## Regression for stage teardown during the delayed death-animation pool return.
extends GutTest

const JUICE_SCRIPT: Script = preload("res://autoloads/CombatJuiceManager.gd")

func test_freed_enemy_is_rejected_before_animation() -> void:
	var manager: Node = add_child_autofree(JUICE_SCRIPT.new())
	var enemy: Node = Node.new()
	enemy.free()
	var result: Dictionary = await manager._trigger_death_animation({"enemy_node": enemy})
	assert_false(result.success)

func test_enemy_freed_during_animation_completes_without_pool_call() -> void:
	var manager: Node = add_child_autofree(JUICE_SCRIPT.new())
	var enemy: Node = Node.new()
	add_child(enemy)
	var enemy_id: String = str(enemy.get_instance_id())
	get_tree().create_timer(0.05).timeout.connect(enemy.queue_free)
	watch_signals(manager)
	var result: Dictionary = await manager._trigger_death_animation({"enemy_node": enemy})
	assert_true(result.success)
	assert_eq(result.enemy_id, enemy_id)
	assert_signal_emitted(manager, "juice_effect_completed")
