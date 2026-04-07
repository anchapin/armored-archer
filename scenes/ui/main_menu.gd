extends Control

# --- UI References ---
@onready var title_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/TitleLabel
@onready var gem_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/GemContainer/GemLabel
@onready var play_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/LeftButtons/PlayButton
@onready var pvp_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/LeftButtons/PvpButton
@onready var shop_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/RightButtons/ShopButton
@onready var buy_gems_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/RightButtons/BuyGemsButton
@onready var settings_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/RightButtons/SettingsButton
@onready var quit_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/RightButtons/QuitButton
@onready var loadout_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/ButtonContainer/LeftButtons/LoadoutButton
@onready var menu_container: Control = $SafeAreaContainer/MainContainer

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

	var _err = play_button.pressed.connect(_on_play_pressed)
	_err = pvp_button.pressed.connect(_on_pvp_pressed)
	_err = shop_button.pressed.connect(_on_shop_pressed)
	_err = buy_gems_button.pressed.connect(_on_buy_gems_pressed)
	_err = settings_button.pressed.connect(_on_settings_pressed)
	_err = quit_button.pressed.connect(_on_quit_pressed)
	_err = loadout_button.pressed.connect(_on_loadout_pressed)

	# Apply Relic Archive dark theme directly
	_apply_theme()

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
	visible = false

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
	visible = false

func _on_quit_pressed() -> void:
	get_tree().quit()

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = "Gems: %d" % gem_manager.get_gem_balance()

func _on_currency_updated(_gems: int, _gold: int) -> void:
	_update_gem_display()

# --- Theme Support ---
func _apply_theme() -> void:
	# Apply Relic Archive dark theme directly
	var bg: ColorRect = get_node_or_null("ParchmentBackground") as ColorRect
	if bg:
		bg.color = ArcherDesignTokens.RA_SURFACE  # Dark obsidian background (base tier)

	# Apply surface tier hierarchy to TopBar (container tier - floating panel)
	var top_bar: PanelContainer = get_node_or_null("SafeAreaContainer/MainContainer/TopBar") as PanelContainer
	if top_bar:
		var top_bar_style := StyleBoxFlat.new()
		top_bar_style.bg_color = ArcherDesignTokens.RA_SURFACE_CONTAINER  # Slightly lighter for depth
		top_bar_style.corner_radius_top_left = 0
		top_bar_style.corner_radius_top_right = 0
		top_bar_style.corner_radius_bottom_left = 0
		top_bar_style.corner_radius_bottom_right = 0
		top_bar_style.border_width_left = 0
		top_bar_style.border_width_top = 0
		top_bar_style.border_width_right = 0
		top_bar_style.border_width_bottom = 0
		top_bar.add_theme_stylebox_override("panel", top_bar_style)

	# Update title label color (left-aligned, white)
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_ON_SURFACE

	# Update gem label color (right-aligned, golden)
	if gem_label:
		gem_label.modulate = ArcherDesignTokens.RA_PRIMARY  # Golden for currency


# --- UI Animations ---
func _add_button_animations() -> void:
	if not ui_automation:
		return

	# Add hover animations to each button
	play_button.mouse_entered.connect(func(): _on_button_hover(play_button))
	play_button.mouse_exited.connect(func(): _on_button_hover_exit(play_button))
	play_button.button_down.connect(func(): _on_button_press(play_button))

	pvp_button.mouse_entered.connect(func(): _on_button_hover(pvp_button))
	pvp_button.mouse_exited.connect(func(): _on_button_hover_exit(pvp_button))
	pvp_button.button_down.connect(func(): _on_button_press(pvp_button))

	shop_button.mouse_entered.connect(func(): _on_button_hover(shop_button))
	shop_button.mouse_exited.connect(func(): _on_button_hover_exit(shop_button))
	shop_button.button_down.connect(func(): _on_button_press(shop_button))

	buy_gems_button.mouse_entered.connect(func(): _on_button_hover(buy_gems_button))
	buy_gems_button.mouse_exited.connect(func(): _on_button_hover_exit(buy_gems_button))
	buy_gems_button.button_down.connect(func(): _on_button_press(buy_gems_button))

	settings_button.mouse_entered.connect(func(): _on_button_hover(settings_button))
	settings_button.mouse_exited.connect(func(): _on_button_hover_exit(settings_button))
	settings_button.button_down.connect(func(): _on_button_press(settings_button))

	quit_button.mouse_entered.connect(func(): _on_button_hover(quit_button))
	quit_button.mouse_exited.connect(func(): _on_button_hover_exit(quit_button))
	quit_button.button_down.connect(func(): _on_button_press(quit_button))

	loadout_button.mouse_entered.connect(func(): _on_button_hover(loadout_button))
	loadout_button.mouse_exited.connect(func(): _on_button_hover_exit(loadout_button))
	loadout_button.button_down.connect(func(): _on_button_press(loadout_button))

func _on_button_hover(button: ArcheryBaseButton) -> void:
	if ui_automation and ui_automation.has_method("button_hover_in") and is_instance_valid(button):
		ui_automation.button_hover_in(button)

func _on_button_hover_exit(button: ArcheryBaseButton) -> void:
	if ui_automation and ui_automation.has_method("button_hover_out") and is_instance_valid(button):
		ui_automation.button_hover_out(button)

func _on_button_press(button: ArcheryBaseButton) -> void:
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
	tween.tween_property(menu_container, "modulate:a", 1.0, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tween.parallel().tween_property(menu_container, "scale", Vector2.ONE, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)
