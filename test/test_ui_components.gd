extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running UI Components Tests ===\n")
	await run_tests()

func run_tests() -> void:
	# BaseButton tests
	await test_base_button_default_type()
	await test_base_button_state_enum()
	await test_base_button_set_type()
	await test_base_button_toggle()
	await test_base_button_state_signal()
	await test_base_button_disabled_state()

	# BaseLabel tests
	await test_base_label_default_type()
	await test_base_label_type_enum()
	await test_base_label_set_type()

	# BasePanel tests
	await test_base_panel_default_type()
	await test_base_panel_set_type()
	await test_base_panel_dark_theme()
	await test_base_panel_corner_radius()
	await test_base_panel_shadow()

	# BaseContainer tests
	await test_base_container_default_type()
	await test_base_container_set_type()
	await test_base_container_padding()
	await test_base_container_spacing()

	# BaseIcon tests
	await test_base_icon_default_color()
	await test_base_icon_set_color()
	await test_base_icon_disabled_state()
	await test_base_icon_accessibility_label()

	# LoadingIndicator tests
	await test_loading_indicator_initial_state()
	await test_loading_indicator_is_animating()

	# ThemeToggle tests
	await test_theme_toggle_default_dark()
	await test_theme_toggle_signal()

	print("\n=== UI Components Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

# --- BaseButton Tests ---

func _create_base_button() -> Button:
	var btn = Button.new()
	btn.set_script(load("res://scenes/ui/components/base_button.gd"))
	add_child(btn)
	return btn

func test_base_button_default_type() -> void:
	var btn = _create_base_button()
	if btn.button_type == "primary":
		_pass("test_base_button_default_type")
	else:
		_fail("test_base_button_default_type", "Default button_type should be 'primary' (got '%s')" % btn.button_type)
	btn.queue_free()

func test_base_button_state_enum() -> void:
	var btn = _create_base_button()
	# Verify ButtonState enum values exist
	if btn.ButtonState.NORMAL == 0 and btn.ButtonState.HOVER == 1 and btn.ButtonState.PRESSED == 2 and btn.ButtonState.DISABLED == 3 and btn.ButtonState.FOCUSED == 4:
		_pass("test_base_button_state_enum")
	else:
		_fail("test_base_button_state_enum", "ButtonState enum values should be 0-4")
	btn.queue_free()

func test_base_button_set_type() -> void:
	var btn = _create_base_button()
	btn.set_button_type("secondary")
	if btn.button_type == "secondary":
		_pass("test_base_button_set_type")
	else:
		_fail("test_base_button_set_type", "button_type should update via set_button_type")
	btn.queue_free()

func test_base_button_toggle() -> void:
	var btn = _create_base_button()
	if btn.is_toggle == false and btn.is_toggled_on() == false:
		_pass("test_base_button_toggle_default")
	else:
		_fail("test_base_button_toggle_default", "Default toggle state should be false")
	btn.queue_free()

func test_base_button_state_signal() -> void:
	var btn = _create_base_button()
	var received_state = ""
	btn.state_changed.connect(func(state): received_state = state)
	# Manually emit signal to test connectivity
	btn.state_changed.emit("hover")
	await get_tree().create_timer(0.05).timeout
	if received_state == "hover":
		_pass("test_base_button_state_signal")
	else:
		_fail("test_base_button_state_signal", "state_changed signal should emit state string")
	btn.queue_free()

func test_base_button_disabled_state() -> void:
	var btn = _create_base_button()
	btn.set_disabled(true)
	if btn.disabled and btn.get_current_state() == btn.ButtonState.DISABLED:
		_pass("test_base_button_disabled_state")
	else:
		_fail("test_base_button_disabled_state", "set_disabled(true) should set disabled state")
	btn.queue_free()

# --- BaseLabel Tests ---

func _create_base_label() -> Label:
	var lbl = Label.new()
	lbl.set_script(load("res://scenes/ui/components/base_label.gd"))
	add_child(lbl)
	return lbl

func test_base_label_default_type() -> void:
	var lbl = _create_base_label()
	if lbl.label_type == lbl.LabelType.BODY:
		_pass("test_base_label_default_type")
	else:
		_fail("test_base_label_default_type", "Default label_type should be BODY")
	lbl.queue_free()

func test_base_label_type_enum() -> void:
	var lbl = _create_base_label()
	var passed = (
		lbl.LabelType.TITLE == 0 and
		lbl.LabelType.HEADER == 1 and
		lbl.LabelType.SUBHEADER == 2 and
		lbl.LabelType.BODY == 3 and
		lbl.LabelType.CAPTION == 4 and
		lbl.LabelType.OVERLINE == 5 and
		lbl.LabelType.BUTTON == 6 and
		lbl.LabelType.NUMERIC == 7
	)
	if passed:
		_pass("test_base_label_type_enum")
	else:
		_fail("test_base_label_type_enum", "LabelType enum should have 8 values (0-7)")
	lbl.queue_free()

func test_base_label_set_type() -> void:
	var lbl = _create_base_label()
	lbl.set_label_type(lbl.LabelType.TITLE)
	if lbl.label_type == lbl.LabelType.TITLE:
		_pass("test_base_label_set_type")
	else:
		_fail("test_base_label_set_type", "set_label_type should update label_type")
	lbl.queue_free()

# --- BasePanel Tests ---

func _create_base_panel() -> PanelContainer:
	var panel = PanelContainer.new()
	panel.set_script(load("res://scenes/ui/components/base_panel.gd"))
	add_child(panel)
	return panel

func test_base_panel_default_type() -> void:
	var panel = _create_base_panel()
	if panel.panel_type == "default":
		_pass("test_base_panel_default_type")
	else:
		_fail("test_base_panel_default_type", "Default panel_type should be 'default'")
	panel.queue_free()

func test_base_panel_set_type() -> void:
	var panel = _create_base_panel()
	panel.set_panel_type("card")
	if panel.panel_type == "card":
		_pass("test_base_panel_set_type")
	else:
		_fail("test_base_panel_set_type", "set_panel_type should update panel_type")
	panel.queue_free()

func test_base_panel_dark_theme() -> void:
	var panel = _create_base_panel()
	if panel.get_is_dark_theme() == true:
		_pass("test_base_panel_dark_theme_default")
	else:
		_fail("test_base_panel_dark_theme_default", "Default should be dark theme")

	panel.set_dark_theme(false)
	if panel.get_is_dark_theme() == false:
		_pass("test_base_panel_dark_theme_toggle")
	else:
		_fail("test_base_panel_dark_theme_toggle", "set_dark_theme should update theme state")
	panel.queue_free()

func test_base_panel_corner_radius() -> void:
	var panel = _create_base_panel()
	panel.set_corner_radius(16)
	if panel.corner_radius == 16:
		_pass("test_base_panel_corner_radius")
	else:
		_fail("test_base_panel_corner_radius", "set_corner_radius should update value")
	panel.queue_free()

func test_base_panel_shadow() -> void:
	var panel = _create_base_panel()
	panel.set_show_shadow(true)
	if panel.show_shadow == true:
		_pass("test_base_panel_shadow")
	else:
		_fail("test_base_panel_shadow", "set_show_shadow should update value")
	panel.queue_free()

# --- BaseContainer Tests ---

func _create_base_container() -> Container:
	var container = Container.new()
	container.set_script(load("res://scenes/ui/components/base_container.gd"))
	add_child(container)
	return container

func test_base_container_default_type() -> void:
	var container = _create_base_container()
	if container.container_type == "default":
		_pass("test_base_container_default_type")
	else:
		_fail("test_base_container_default_type", "Default container_type should be 'default'")
	container.queue_free()

func test_base_container_set_type() -> void:
	var container = _create_base_container()
	container.set_container_type("vertical")
	if container.container_type == "vertical":
		_pass("test_base_container_set_type")
	else:
		_fail("test_base_container_set_type", "set_container_type should update value")
	container.queue_free()

func test_base_container_padding() -> void:
	var container = _create_base_container()
	container.set_padding(20)
	if container.padding_top == 20 and container.padding_bottom == 20 and container.padding_left == 20 and container.padding_right == 20:
		_pass("test_base_container_padding")
	else:
		_fail("test_base_container_padding", "set_padding should set all padding values")
	container.queue_free()

func test_base_container_spacing() -> void:
	var container = _create_base_container()
	container.set_spacing(15)
	if container.spacing == 15:
		_pass("test_base_container_spacing")
	else:
		_fail("test_base_container_spacing", "set_spacing should update spacing value")
	container.queue_free()

# --- BaseIcon Tests ---

func _create_base_icon() -> TextureRect:
	var icon = TextureRect.new()
	icon.set_script(load("res://scenes/ui/components/base_icon.gd"))
	add_child(icon)
	return icon

func test_base_icon_default_color() -> void:
	var icon = _create_base_icon()
	if icon.icon_color == Color.WHITE:
		_pass("test_base_icon_default_color")
	else:
		_fail("test_base_icon_default_color", "Default icon_color should be WHITE")
	icon.queue_free()

func test_base_icon_set_color() -> void:
	var icon = _create_base_icon()
	var test_color = Color.RED
	icon.set_icon_color(test_color)
	if icon.icon_color == test_color:
		_pass("test_base_icon_set_color")
	else:
		_fail("test_base_icon_set_color", "set_icon_color should update icon_color")
	icon.queue_free()

func test_base_icon_disabled_state() -> void:
	var icon = _create_base_icon()
	icon.set_disabled(true)
	if icon.get_disabled() == true:
		_pass("test_base_icon_disabled_state")
	else:
		_fail("test_base_icon_disabled_state", "set_disabled should update disabled state")
	icon.queue_free()

func test_base_icon_accessibility_label() -> void:
	var icon = _create_base_icon()
	icon.set_accessibility_label("Close button")
	if icon.get_accessibility_label() == "Close button":
		_pass("test_base_icon_accessibility_label")
	else:
		_fail("test_base_icon_accessibility_label", "set_accessibility_label should store label")
	icon.queue_free()

# --- LoadingIndicator Tests ---

func _create_loading_indicator() -> Control:
	var indicator = Control.new()
	indicator.set_script(load("res://scenes/ui/components/loading_indicator.gd"))
	add_child(indicator)
	return indicator

func test_loading_indicator_initial_state() -> void:
	var indicator = _create_loading_indicator()
	if indicator.is_animating() == false:
		_pass("test_loading_indicator_initial_state")
	else:
		_fail("test_loading_indicator_initial_state", "Should not be animating initially")
	indicator.queue_free()

func test_loading_indicator_is_animating() -> void:
	var indicator = _create_loading_indicator()
	indicator._is_animating = true
	if indicator.is_animating() == true:
		_pass("test_loading_indicator_is_animating")
	else:
		_fail("test_loading_indicator_is_animating", "is_animating should return internal state")
	indicator.queue_free()

# --- ThemeToggle Tests ---

func _create_theme_toggle() -> Control:
	var toggle = Control.new()
	toggle.set_script(load("res://scenes/ui/components/theme_toggle.gd"))
	add_child(toggle)
	return toggle

func test_theme_toggle_default_dark() -> void:
	var toggle = _create_theme_toggle()
	if toggle.is_dark_theme() == true:
		_pass("test_theme_toggle_default_dark")
	else:
		_fail("test_theme_toggle_default_dark", "Default should be dark theme")
	toggle.queue_free()

func test_theme_toggle_signal() -> void:
	var toggle = _create_theme_toggle()
	var received = false
	toggle.theme_toggled.connect(func(_is_dark): received = true)
	toggle.theme_toggled.emit(true)
	await get_tree().create_timer(0.05).timeout
	if received:
		_pass("test_theme_toggle_signal")
	else:
		_fail("test_theme_toggle_signal", "theme_toggled signal should emit")
	toggle.queue_free()
