extends Control

# --- UI References ---
@onready var gem_label: Label = $CenterContainer/VBoxContainer/GemContainer/GemLabel
@onready var play_button: Button = $CenterContainer/VBoxContainer/PlayButton
@onready var pvp_button: Button = $CenterContainer/VBoxContainer/PvpButton
@onready var shop_button: Button = $CenterContainer/VBoxContainer/ShopButton
@onready var buy_gems_button: Button = $CenterContainer/VBoxContainer/BuyGemsButton
@onready var settings_button: Button = $CenterContainer/VBoxContainer/SettingsButton
@onready var quit_button: Button = $CenterContainer/VBoxContainer/QuitButton
@onready var loadout_button: Button = $CenterContainer/VBoxContainer/LoadoutButton

# --- Manager References ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Scene Instances for cleanup ---
var _shop_instance: Node = null
var _loadout_instance: Node = null

# --- Signal connections for cleanup ---
var _currency_updated_connection: Callable = Callable()

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		_currency_updated_connection = store_manager.currency_updated.connect(_on_currency_updated)

	_update_gem_display()

	play_button.pressed.connect(_on_play_pressed)
	pvp_button.pressed.connect(_on_pvp_pressed)
	shop_button.pressed.connect(_on_shop_pressed)
	buy_gems_button.pressed.connect(_on_buy_gems_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	quit_button.pressed.connect(_on_quit_pressed)
	loadout_button.pressed.connect(_on_loadout_pressed)

func _exit_tree() -> void:
	# Clean up connected signals to prevent memory leaks
	_cleanup_signal_connection(StoreManager, "currency_updated", _currency_updated_connection)

	# Clean up instantiated scenes to prevent memory leaks
	if _shop_instance and is_instance_valid(_shop_instance):
		_shop_instance.queue_free()
	if _loadout_instance and is_instance_valid(_loadout_instance):
		_loadout_instance.queue_free()

func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
	if node and connection.is_valid() and node.is_connected(signal_name, connection):
		node.disconnect(signal_name, connection)

# --- Button Handlers ---
func _on_play_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")

func _on_pvp_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")

func _on_shop_pressed() -> void:
	# Clean up existing shop instance if it exists
	if _shop_instance and is_instance_valid(_shop_instance):
		_shop_instance.queue_free()

	var shop_scene = preload("res://scenes/ui/cosmetic_shop.tscn")
	_shop_instance = shop_scene.instantiate()
	get_tree().root.add_child(_shop_instance)

func _on_buy_gems_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/store_menu.tscn")

func _on_settings_pressed() -> void:
	print("Settings not implemented yet")

func _on_loadout_pressed() -> void:
	# Clean up existing loadout instance if it exists
	if _loadout_instance and is_instance_valid(_loadout_instance):
		_loadout_instance.queue_free()

	var loadout_scene = preload("res://scenes/ui/loadout.tscn")
	_loadout_instance = loadout_scene.instantiate()
	get_tree().root.add_child(_loadout_instance)

func _on_quit_pressed() -> void:
	get_tree().quit()

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = "Gems: %d" % gem_manager.get_gem_balance()

func _on_currency_updated( _gems: int, _gold: int) -> void:
	_update_gem_display()
