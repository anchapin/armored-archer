extends Label

## UI counter showing enemy progress in the current stage
## Listens to EnemySpawner for enemy count updates

var enemies_remaining: int = 0
var total_enemies: int = 0

func _ready() -> void:
	var spawner = get_node_or_null("/root/Main/EnemySpawner")
	if spawner and spawner.has_signal("enemy_count_changed"):
		spawner.enemy_count_changed.connect(_on_enemy_count_changed)
func _on_enemy_count_changed(remaining: int, total: int) -> void:
	enemies_remaining = remaining
	total_enemies = total
	_update_display()

func _update_display() -> void:
	if total_enemies > 0:
		var enemies_killed = total_enemies - enemies_remaining
		var percent = int((float(enemies_killed) / float(total_enemies)) * 100)
		text = "Enemies: %d / %d (%d%%)" % [enemies_killed, total_enemies, percent]
	else:
		text = "Enemies: %d" % enemies_remaining
# gdlint-ignore-file
