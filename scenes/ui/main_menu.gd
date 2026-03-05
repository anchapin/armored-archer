extends Control

# --- UI References ---
@onready var gem_label: Label = $CenterContainer/VBoxContainer/GemContainer/GemLabel
@onready var play_button: Button = $CenterContainer/VBoxContainer/PlayButton
@onready var pvp_button: Button = $CenterContainer/VBoxContainer/PvpButton
@onready var shop_button: Button = $CenterContainer/VBoxContainer/ShopButton
@onready var buy_gems_button: Button = $CenterContainer/VBoxContainer/BuyGemsButton
@onready var settings_button: Button = $CenterContainer/VBoxContainer/SettingsButton
@onready var quit_button: Button = $CenterContainer/VBoxContainer/QuitButton

# --- Manager References ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)
	
	_update_gem_display()
	
	play_button.pressed.connect(_on_play_pressed)
	pvp_button.pressed.connect(_on_pvp_pressed)
	shop_button.pressed.connect(_on_shop_pressed)
	buy_gems_button.pressed.connect(_on_buy_gems_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	quit_button.pressed.connect(_on_quit_pressed)

# --- Button Handlers ---
func _on_play_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main.tscn")

func _on_pvp_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")

func _on_shop_pressed() -> void:
	var shop_scene = preload("res://scenes/ui/cosmetic_shop.tscn")
	var shop_instance = shop_scene.instantiate()
	get_tree().root.add_child(shop_instance)

func _on_buy_gems_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/store_menu.tscn")

func _on_settings_pressed() -> void:
	print("Settings not implemented yet")

func _on_quit_pressed() -> void:
	get_tree().quit()

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = "Gems: %d" % gem_manager.get_gem_balance()

func _on_currency_updated(gems: int, gold: int) -> void:
	_update_gem_display()
