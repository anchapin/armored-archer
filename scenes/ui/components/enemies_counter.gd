extends Label

## Display confirmed defeats against the configured regular-enemy wave budget.
## Pending spawns are not defeated enemies; bosses are a separate objective.
var enemies_defeated: int = 0
var total_enemies: int = 0

func _ready() -> void:
	var spawner = get_node_or_null("/root/EnemySpawner")
	if spawner and spawner.has_signal("enemy_progress_changed"):
		spawner.enemy_progress_changed.connect(_on_enemy_progress_changed)
		_on_enemy_progress_changed(spawner.enemies_defeated, spawner.total_enemies_for_stage)

func _on_enemy_progress_changed(defeated: int, total: int) -> void:
	enemies_defeated = defeated
	total_enemies = total
	if total_enemies > 0:
		var percent = int(float(enemies_defeated) / float(total_enemies) * 100.0)
		text = "Enemies: %d / %d (%d%%)" % [enemies_defeated, total_enemies, percent]
	else:
		text = "Enemies: 0"
