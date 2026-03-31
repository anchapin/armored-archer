extends Control

# --- UI References ---
@onready var gem_label: Label = $SafeAreaContainer/CenterContainer/VBoxContainer/GemContainer/GemLabel
@onready var _play_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/PlayButton
@onready var _pvp_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/PvpButton
@onready var _shop_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/ShopButton
@onready var _buy_gems_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/BuyGemsButton
@onready var _settings_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/SettingsButton
@onready var _quit_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/QuitButton
@onready var _loadout_button: Button = $SafeAreaContainer/CenterContainer/VBoxContainer/LoadoutButton
@onready var menu_container: Control = $SafeAreaContainer/CenterContainer/VBoxContainer

# --- Manager References ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Theme Manager Reference ---
@onready var theme_manager: Node = get_node_or_null("/root/ThemeManager")

# --- Automation Reference ---
@onready var ui_automation: Node = get_node_or_null("/root/UIAutomation")

# --- Scene Instances for cleanup ---
var _shop_instance: Node = null
var _loadout_instance: Node = null

# --- Signal connections for cleanup ---
var _currency_updated_connection: Callable = Callable()

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		_currency_updated_connection = _on_currency_updated
		store_manager.currency_updated.connect(_currency_updated_connection)

	_update_gem_display()

	_play_button.pressed.connect(_on_play_pressed)
	_pvp_button.pressed.connect(_on_pvp_pressed)
	_shop_button.pressed.connect(_on_shop_pressed)
	_buy_gems_button.pressed.connect(_on_buy_gems_pressed)
	_settings_button.pressed.connect(_on_settings_pressed)
	_quit_button.pressed.connect(_on_quit_pressed)
	_loadout_button.pressed.connect(_on_loadout_pressed)
	
	# Apply basic colors first
	_apply_basic_colors()
	
	# Apply theme if ThemeManager is available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)
	
	# Add hover animations to buttons
	_add_button_animations()
	
	# Animate menu entry
	_animate_menu_entry()

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
	# Show loading state while transitioning
	_play_button.set_loading(true)
	
	# Small delay for visual feedback, then transition
	await get_tree().create_timer(0.15).timeout
	
	if has_node("/root/UITransitionOptimizer"):
		$"/root/UITransitionOptimizer".transition_to_scene("res://scenes/ui/campaign_map.tscn")
	else:
		get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
	
	# Clear loading state after transition starts
	_play_button.set_loading(false)

func _on_pvp_pressed() -> void:
	# Show loading state while transitioning
	_pvp_button.set_loading(true)
	
	await get_tree().create_timer(0.15).timeout
	
	if has_node("/root/UITransitionOptimizer"):
		$"/root/UITransitionOptimizer".transition_to_scene("res://scenes/ui/matchmaking_menu.tscn")
	else:
		get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")
	
	_pvp_button.set_loading(false)

func _on_shop_pressed() -> void:
	# Clean up existing shop instance if it exists
	if _shop_instance and is_instance_valid(_shop_instance):
		_shop_instance.queue_free()

	var shop_scene = preload("res://scenes/ui/cosmetic_shop.tscn")
	_shop_instance = shop_scene.instantiate()
	get_tree().root.add_child(_shop_instance)
	visible = false

func _on_buy_gems_pressed() -> void:
	# Show loading state while transitioning
	_buy_gems_button.set_loading(true)
	
	await get_tree().create_timer(0.15).timeout
	
	if has_node("/root/UITransitionOptimizer"):
		$"/root/UITransitionOptimizer".transition_to_scene("res://scenes/ui/store_menu.tscn")
	else:
		get_tree().change_scene_to_file("res://scenes/ui/store_menu.tscn")
	
	_buy_gems_button.set_loading(false)

func _on_settings_pressed() -> void:
	print("Settings not implemented yet")

func _on_loadout_pressed() -> void:
	# Clean up existing loadout instance if it exists
	if _loadout_instance and is_instance_valid(_loadout_instance):
		_loadout_instance.queue_free()

	var loadout_scene = preload("res://scenes/ui/loadout.tscn")
	_loadout_instance = loadout_scene.instantiate()
	get_tree().root.add_child(_loadout_instance)
	visible = false

func _on_quit_pressed() -> void:
	get_tree().quit()

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = "Gems: %d" % gem_manager.get_gem_balance()

func _on_currency_updated( _gems: int, _gold: int) -> void:
	_update_gem_display()

# --- Basic Colors ---
func _apply_basic_colors() -> void:
	# Set button colors to a nice blue
	var button_color = Color(0.0, 0.376, 0.808, 1.0)  # Royal Blue
	if _play_button:
		_play_button.modulate = button_color
	if _pvp_button:
		_pvp_button.modulate = button_color
	if _shop_button:
		_shop_button.modulate = button_color
	if _buy_gems_button:
		_buy_gems_button.modulate = button_color
	if _settings_button:
		_settings_button.modulate = button_color
	if _quit_button:
		_quit_button.modulate = button_color
	if _loadout_button:
		_loadout_button.modulate = button_color

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	
	# BUG FIX: Don't set modulate on root node - this washes out all colors
	# modulate = colors["background"]  # Removed - was causing grayscale
	
	# Apply to menu container if available
	# FIX: Don't override modulate - let children keep their own colors
	# menu_container.modulate = colors["surface"]  # Removed

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

# --- UI Animations ---
func _add_button_animations() -> void:
	if not ui_automation:
		return
	
	# Add hover animations to each button
	var _err: Error
	_err = _play_button.mouse_entered.connect(func(): _on_button_hover(_play_button))
	_err = _play_button.mouse_exited.connect(func(): _on_button_hover_exit(_play_button))
	_err = _play_button.button_down.connect(func(): _on_button_press(_play_button))
	
	_err = _pvp_button.mouse_entered.connect(func(): _on_button_hover(_pvp_button))
	_err = _pvp_button.mouse_exited.connect(func(): _on_button_hover_exit(_pvp_button))
	_err = _pvp_button.button_down.connect(func(): _on_button_press(_pvp_button))
	
	_err = _shop_button.mouse_entered.connect(func(): _on_button_hover(_shop_button))
	_err = _shop_button.mouse_exited.connect(func(): _on_button_hover_exit(_shop_button))
	_err = _shop_button.button_down.connect(func(): _on_button_press(_shop_button))
	
	_err = _buy_gems_button.mouse_entered.connect(func(): _on_button_hover(_buy_gems_button))
	_err = _buy_gems_button.mouse_exited.connect(func(): _on_button_hover_exit(_buy_gems_button))
	_err = _buy_gems_button.button_down.connect(func(): _on_button_press(_buy_gems_button))
	
	_err = _settings_button.mouse_entered.connect(func(): _on_button_hover(_settings_button))
	_err = _settings_button.mouse_exited.connect(func(): _on_button_hover_exit(_settings_button))
	_err = _settings_button.button_down.connect(func(): _on_button_press(_settings_button))
	
	_err = _quit_button.mouse_entered.connect(func(): _on_button_hover(_quit_button))
	_err = _quit_button.mouse_exited.connect(func(): _on_button_hover_exit(_quit_button))
	_err = _quit_button.button_down.connect(func(): _on_button_press(_quit_button))
	
	_err = _loadout_button.mouse_entered.connect(func(): _on_button_hover(_loadout_button))
	_err = _loadout_button.mouse_exited.connect(func(): _on_button_hover_exit(_loadout_button))
	_err = _loadout_button.button_down.connect(func(): _on_button_press(_loadout_button))

func _on_button_hover(button: Button) -> void:
	if ui_automation and ui_automation.has_method("button_hover_in") and is_instance_valid(button):
		ui_automation.button_hover_in(button)

func _on_button_hover_exit(button: Button) -> void:
	if ui_automation and ui_automation.has_method("button_hover_out") and is_instance_valid(button):
		ui_automation.button_hover_out(button)

func _on_button_press(button: Button) -> void:
	if ui_automation and ui_automation.has_method("button_press") and is_instance_valid(button):
		ui_automation.button_press(button)

func _animate_menu_entry() -> void:
	if not menu_container:
		return
	
	# Check if animations are enabled
	if ui_automation and ui_automation.has_method("are_animations_enabled") and not ui_automation.are_animations_enabled():
		return
	
	# Set initial state
	menu_container.modulate.a = 0.0
	menu_container.scale = Vector2(0.8, 0.8)
	
	# Animate entry
	var tween = create_tween()
	var _tp1 = tween.tween_property(menu_container, "modulate:a", 1.0, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	var _tp2 = tween.parallel().tween_property(menu_container, "scale", Vector2.ONE, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)
