extends Node

# --- Game State ---
var player_current_health: int = 100
var player_max_health: int = 100
var current_stage: int = 1
var is_game_active: bool = true

# --- Signals ---
signal health_changed(new_health: int, max_health: int)
signal player_died()
signal game_won()

# --- Health Management ---
func take_player_damage(damage: int) -> void:
	if not is_game_active:
		return
	
	player_current_health = max(0, player_current_health - damage)
	health_changed.emit(player_current_health, player_max_health)
	
	if player_current_health <= 0:
		player_died.emit()

func heal_player(amount: int) -> void:
	if not is_game_active:
		return
	
	player_current_health = min(player_max_health, player_current_health + amount)
	health_changed.emit(player_current_health, player_max_health)

# --- Game Flow ---
func start_game() -> void:
	player_current_health = player_max_health
	is_game_active = true
	health_changed.emit(player_current_health, player_max_health)

func end_game(won: bool) -> void:
	is_game_active = false
	
	if won:
		game_won.emit()
	else:
		player_died.emit()

# --- Stage Management ---
func complete_stage() -> void:
	if not is_game_active:
		return
	
	current_stage += 1
	end_game(true)

func reset_stage() -> void:
	current_stage = 1
	player_current_health = player_max_health
	is_game_active = true
	health_changed.emit(player_current_health, player_max_health)
