extends Control

# =============================================================================
# MAIN MENU - Armored Archer (Relic Archive Redesign)
# =============================================================================
# Main menu with Relic Archive design system styling:
# - Dark obsidian background (RA_SURFACE #0e0e0e)
# - Asymmetrical layout for dynamic "ready-to-fire" feel
# - Golden primary buttons with gradient
# - Surface tier hierarchy for depth
# - No-Line Rule: Background shifts instead of borders
# - Character preview in center (placeholder for art)
# =============================================================================

# --- UI References ---
@onready var title_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/TitleLabel
@onready var subtitle_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/SubtitleLabel
@onready var gem_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/GemContainer/GemLabel
@onready var gold_label: Label = $SafeAreaContainer/MainContainer/TopBar/TopBarContent/GoldContainer/GoldLabel

@onready var play_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/PlayButton
@onready var loadout_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/LoadoutButton
@onready var pvp_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/PvpButton
@onready var shop_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/RightPanel/ShopButton
@onready var buy_gems_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/RightPanel/BuyGemsButton
@onready var settings_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/RightPanel/SettingsButton
@onready var quit_button: ArcheryBaseButton = $SafeAreaContainer/MainContainer/RightPanel/QuitButton

@onready var character_preview: Control = $SafeAreaContainer/MainContainer/CenterContent/CharacterPreview
@onready var menu_container: Control = $SafeAreaContainer/MainContainer
@onready var bottom_bar: PanelContainer = $SafeAreaContainer/MainContainer/BottomBar

# --- Manager References ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var theme_manager: Node = get_node_or_null("/root/ThemeManager")
@onready var ui_automation: Node = get_node_or_null("/root/UIAutomation")

# --- Scene Instances for cleanup ---
var _shop_instance: Node = null
var _loadout_instance: Node = null

# --- Signal connections for cleanup ---
var _currency_updated_connection: Callable = Callable()

# --- Initialization ---
func _ready() -> void:
	# Privacy consent check must happen before any data collection
	_check_privacy_consent()

	# Connect to currency updates
	if store_manager:
		_currency_updated_connection = _on_currency_updated
		store_manager.currency_updated.connect(_currency_updated_connection)

	# Update displays
	_update_gem_display()
	_update_gold_display()

	# Connect button signals
	var _err = play_button.pressed.connect(_on_play_pressed)
	_err = pvp_button.pressed.connect(_on_pvp_pressed)
	_err = shop_button.pressed.connect(_on_shop_pressed)
	_err = buy_gems_button.pressed.connect(_on_buy_gems_pressed)
	_err = settings_button.pressed.connect(_on_settings_pressed)
	_err = quit_button.pressed.connect(_on_quit_pressed)
	_err = loadout_button.pressed.connect(_on_loadout_pressed)

	# Apply Relic Archive dark theme
	_apply_relic_archive_theme()

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
	_transition_to_scene("res://scenes/ui/campaign_map.tscn")

func _on_pvp_pressed() -> void:
	_transition_to_scene("res://scenes/ui/matchmaking_menu.tscn")

func _on_shop_pressed() -> void:
	# Clean up existing shop instance if it exists
	if _shop_instance and is_instance_valid(_shop_instance):
		_shop_instance.queue_free()

	var shop_scene = preload("res://scenes/ui/cosmetic_shop.tscn")
	_shop_instance = shop_scene.instantiate()
	get_tree().root.add_child(_shop_instance)
	visible = false

func _on_buy_gems_pressed() -> void:
	_transition_to_scene("res://scenes/ui/store_menu.tscn")

func _on_settings_pressed() -> void:
	var settings_scene = load("res://scenes/ui/settings_menu.tscn")
	if settings_scene:
		_transition_to_scene_packed(settings_scene)
	else:
		var dialog := AcceptDialog.new()
		dialog.title = "Settings"
		dialog.dialog_text = "Settings are coming soon in a future update."
		dialog.ok_button_text = "OK"
		get_tree().root.add_child(dialog)
		dialog.popup_centered()
		dialog.confirmed.connect(func(): dialog.queue_free())

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

# --- Scene Transitions ---
func _transition_to_scene(scene_path: String) -> void:
	"""Animate menu transition with fade effect."""
	if ui_automation and ui_automation.has_method("are_animations_enabled") and not ui_automation.are_animations_enabled():
		get_tree().change_scene_to_file(scene_path)
		return
	
	# Fade out animation
	var tween = create_tween()
	tween.tween_property(menu_container, "modulate:a", 0.0, 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_callback(func(): get_tree().change_scene_to_file(scene_path))

func _transition_to_scene_packed(scene: PackedScene) -> void:
	"""Animate menu transition with fade effect for packed scenes."""
	if ui_automation and ui_automation.has_method("are_animations_enabled") and not ui_automation.are_animations_enabled():
		get_tree().change_scene_to_packed(scene)
		return
	
	# Fade out animation
	var tween = create_tween()
	tween.tween_property(menu_container, "modulate:a", 0.0, 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_callback(func(): get_tree().change_scene_to_packed(scene))

# --- Currency Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = "%d" % gem_manager.get_gem_balance()

func _update_gold_display() -> void:
	if gem_manager:
		gold_label.text = "%d" % gem_manager.get_gold_balance()

func _on_currency_updated(gems: int, coins: int) -> void:
	_update_gem_display()
	_update_gold_display()

# --- Theme Support (Relic Archive) ---
func _apply_relic_archive_theme() -> void:
	# Background: RA_SURFACE (Deep Obsidian #0e0e0e)
	var bg: ColorRect = get_node_or_null("ParchmentBackground") as ColorRect
	if bg:
		bg.color = ArcherDesignTokens.RA_SURFACE

	# Title: White, Epilogue Bold font for heroic display
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_ON_SURFACE
		title_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_TITLE)
		# Apply Epilogue Bold if available
		var font = load(ArcherDesignTokens.FONT_EPILOGUE_BOLD_PATH)
		if font != null:
			title_label.add_theme_font_override("font", font)

	# Subtitle: RA_ON_SURFACE_VARIANT (#adaaaa) for secondary info
	if subtitle_label:
		subtitle_label.modulate = ArcherDesignTokens.RA_ON_SURFACE_VARIANT
		subtitle_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_BASE)

	# Currency labels: RA_PRIMARY (Golden #ffac54) with glow effect
	if gem_label:
		gem_label.modulate = ArcherDesignTokens.RA_PRIMARY
		var font = load(ArcherDesignTokens.FONT_SPACE_GROTESK_BOLD_PATH)
		if font != null:
			gem_label.add_theme_font_override("font", font)

	if gold_label:
		gold_label.modulate = ArcherDesignTokens.RA_PRIMARY
		var font = load(ArcherDesignTokens.FONT_SPACE_GROTESK_BOLD_PATH)
		if font != null:
			gold_label.add_theme_font_override("font", font)

	# Top Bar: Surface tier container (RA_SURFACE_CONTAINER #191a1a)
	var top_bar: PanelContainer = get_node_or_null("SafeAreaContainer/MainContainer/TopBar") as PanelContainer
	if top_bar:
		_apply_surface_tier_style(top_bar, "container")

	# Left Panel: Surface tier high (RA_SURFACE_CONTAINER_HIGH #1f2020)
	var left_panel: PanelContainer = get_node_or_null("SafeAreaContainer/MainContainer/CenterContent/LeftPanel") as PanelContainer
	if left_panel:
		_apply_surface_tier_style(left_panel, "high")

	# Right Panel: Surface tier container (RA_SURFACE_CONTAINER #191a1a)
	var right_panel: PanelContainer = get_node_or_null("SafeAreaContainer/MainContainer/RightPanel") as PanelContainer
	if right_panel:
		_apply_surface_tier_style(right_panel, "container")

	# Bottom Bar: Surface tier low (RA_SURFACE_CONTAINER_LOW #131313)
	if bottom_bar:
		_apply_surface_tier_style(bottom_bar, "low")

func _apply_surface_tier_style(panel: PanelContainer, tier: String) -> void:
	var bg_color = ArcherDesignTokens.get_ra_surface_tier_color(tier)
	var radius = ArcherDesignTokens.RA_ROUNDNESS_FOUR

	var style := StyleBoxFlat.new()
	style.bg_color = bg_color
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius

	# No-Line Rule: Remove all borders
	style.border_width_left = 0
	style.border_width_top = 0
	style.border_width_right = 0
	style.border_width_bottom = 0

	panel.add_theme_stylebox_override("panel", style)

# --- UI Animations ---
func _add_button_animations() -> void:
	if not ui_automation:
		return

	# Add hover animations to each button
	_add_button_animation(play_button)
	_add_button_animation(loadout_button)
	_add_button_animation(pvp_button)
	_add_button_animation(shop_button)
	_add_button_animation(buy_gems_button)
	_add_button_animation(settings_button)
	_add_button_animation(quit_button)

func _add_button_animation(button: ArcheryBaseButton) -> void:
	button.mouse_entered.connect(func(): _on_button_hover(button))
	button.mouse_exited.connect(func(): _on_button_hover_exit(button))
	button.button_down.connect(func(): _on_button_press(button))

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
	
	# Add character preview idle animation
	_animate_character_preview()

func _animate_character_preview() -> void:
	# Subtle idle bob animation for character preview
	if not character_preview:
		return
	
	# Only animate if animations are enabled
	if ui_automation and ui_automation.has_method("are_animations_enabled") and not ui_automation.are_animations_enabled():
		return
	
	# Create a looping bob animation
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(character_preview, "position:y", character_preview.position.y - 5, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_property(character_preview, "position:y", character_preview.position.y, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)


# --- Privacy Consent & Beta Onboarding ---
func _check_privacy_consent() -> void:
	if not _is_scene_loaded("res://scenes/ui/components/privacy_consent_dialog.tscn"):
		return
	var script = load("res://scenes/ui/components/privacy_consent_dialog.gd")
	if script and script.has_method("has_consented") and not script.has_consented():
		var dialog_scene = load("res://scenes/ui/components/privacy_consent_dialog.tscn")
		var dialog = dialog_scene.instantiate()
		get_tree().root.add_child(dialog)
		dialog.consent_given.connect(_on_consent_given)
	else:
		_check_beta_onboarding()


func _on_consent_given() -> void:
	_check_beta_onboarding()


func _check_beta_onboarding() -> void:
	var beta_welcome_script = load("res://scenes/ui/beta_welcome.gd")
	if beta_welcome_script == null:
		return
	if beta_welcome_script.has_method("has_seen_welcome") and not beta_welcome_script.has_seen_welcome():
		var welcome_scene = load("res://scenes/ui/beta_welcome.tscn")
		if welcome_scene:
			var welcome = welcome_scene.instantiate()
			get_tree().root.add_child(welcome)
			welcome.dismissed.connect(_on_beta_welcome_dismissed)

	var tutorial_manager = get_node_or_null("/root/TutorialManager")
	if tutorial_manager and tutorial_manager.has_method("is_tutorial_complete"):
		if not tutorial_manager.is_tutorial_complete("beta_features"):
			tutorial_manager.start_tutorial("beta_features")


func _on_beta_welcome_dismissed() -> void:
	pass


func _is_scene_loaded(path: String) -> bool:
	return ResourceLoader.exists(path)
