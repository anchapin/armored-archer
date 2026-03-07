extends Control

# --- Store Integration Test Scene ---
# This scene demonstrates and tests the RevenueCat IAP integration

# --- UI References ---
@onready var connection_status_label: Label = $VBoxContainer/ConnectionSection/StatusLabel
@onready var platform_label: Label = $VBoxContainer/PlatformSection/PlatformLabel
@onready var currency_label: Label = $VBoxContainer/CurrencySection/CurrencyLabel

@onready var test_small_button: Button = $VBoxContainer/TestsSection/TestSmallButton
@onready var test_medium_button: Button = $VBoxContainer/TestsSection/TestMediumButton
@onready var test_large_button: Button = $VBoxContainer/TestsSection/TestLargeButton
@onready var test_spend_button: Button = $VBoxContainer/TestsSection/TestSpendButton
@onready var refresh_button: Button = $VBoxContainer/TestsSection/RefreshButton
@onready var back_button: Button = $VBoxContainer/BackSection/BackButton

@onready var log_text: TextEdit = $VBoxContainer/LogSection/LogText

# --- State ---
var logs: Array[String] = []
var max_logs: int = 50

func _ready() -> void:
	_connect_signals()
	_update_display()
	_log("Store Test Scene Ready")

func _connect_signals() -> void:
	if StoreManager:
		StoreManager.currency_updated.connect(_on_currency_updated)
		StoreManager.purchase_succeeded.connect(_on_purchase_succeeded)
		StoreManager.purchase_failed.connect(_on_purchase_failed)

	test_small_button.pressed.connect(_on_test_small)
	test_medium_button.pressed.connect(_on_test_medium)
	test_large_button.pressed.connect(_on_test_large)
	test_spend_button.pressed.connect(_on_test_spend)
	refresh_button.pressed.connect(_on_refresh)
	back_button.pressed.connect(_on_back)

func _update_display() -> void:
	if StoreManager:
		currency_label.text = "Gems: %d | Gold: %d" % [StoreManager.get_gems(), StoreManager.get_gold()]
		_log("Currency updated: %d gems, %d gold" % [StoreManager.get_gems(), StoreManager.get_gold()])

	var platform_info = "Platform: %s" % OS.get_name()
	if StoreManager:
		platform_info += " (Detected: %s)" % StoreManager.platform
	platform_label.text = platform_info

	if NetworkManager and NetworkManager.is_connected:
		connection_status_label.text = "Status: Connected"
		connection_status_label.modulate = Color.GREEN
	else:
		connection_status_label.text = "Status: Disconnected"
		connection_status_label.modulate = Color.RED

# --- Test Functions ---
func _on_test_small() -> void:
	_log("Testing Small Gem Pack purchase...")
	StoreManager.purchase_product(StoreManager.PRODUCT_SMALL_GEMS)

func _on_test_medium() -> void:
	_log("Testing Medium Gem Pack purchase...")
	StoreManager.purchase_product(StoreManager.PRODUCT_MEDIUM_GEMS)

func _on_test_large() -> void:
	_log("Testing Large Gem Pack purchase...")
	StoreManager.purchase_product(StoreManager.PRODUCT_LARGE_GEMS)

func _on_test_spend() -> void:
	_log("Testing spend 10 gems...")
	StoreManager.spend_gems(10, "Test spend")

func _on_refresh() -> void:
	_log("Refreshing currency...")
	_update_display()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

# --- Callbacks ---
func _on_currency_updated(gems: int, gold: int) -> void:
	_update_display()
	_log("Currency updated signal: %d gems, %d gold" % [gems, gold])

func _on_purchase_succeeded(product_id: String, gems_awarded: int) -> void:
	_log("✓ Purchase SUCCESS: %s awarded %d gems" % [product_id, gems_awarded])

func _on_purchase_failed(product_id: String, error: String) -> void:
	_log("✗ Purchase FAILED: %s - %s" % [product_id, error])

# --- Logging ---
func _log(message: String) -> void:
	var timestamp = Time.get_datetime_string_from_system()
	var log_entry = "[%s] %s" % [timestamp, message]
	logs.append(log_entry)

	if logs.size() > max_logs:
		logs.pop_front()

	log_text.text = "\n".join(logs)
	print(log_entry)

# --- Cleanup ---
func _exit_tree() -> void:
	if StoreManager:
		StoreManager.currency_updated.disconnect(_on_currency_updated)
		StoreManager.purchase_succeeded.disconnect(_on_purchase_succeeded)
		StoreManager.purchase_failed.disconnect(_on_purchase_failed)
