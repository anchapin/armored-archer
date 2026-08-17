extends GutTest

## Issue #901: main_menu.gd must populate the coins (GoldLabel) from
## StoreManager.get_coins() and react to StoreManager.currency_updated.
##
## Before the fix, _update_gold_display() called gem_manager.get_gold_balance()
## — a method that does not exist on GemManager — so the gold label was never
## populated. Post-#866 the canonical accessors live on StoreManager
## (currency_updated(gems, coins) signal + get_coins()).
##
## These tests bypass main_menu.gd's _ready() (which is unrelated to #901
## and triggers pre-existing, broken @onready button paths and a privacy
## consent dialog with the same issue) and exercise the binding logic
## directly:
##   * _update_gold_display() reads gold_label and store_manager.
##   * The currency_updated signal must update the label after the binding
##     is wired up the same way _ready() wires it.

const MAIN_MENU_SCRIPT_PATH := "res://scenes/ui/main_menu.gd"
const STORE_MANAGER_PATH := "/root/StoreManager"


func _make_menu_with_label() -> Array:
	## Returns [menu Control, gold_label Label] with the gold_label wired to
	## the @onready slot. The menu is NOT added to the tree (so @onready
	## assignment errors from unrelated paths don't fire); we manually set
	## the @onready properties the binding logic depends on.
	var menu: Control = load(MAIN_MENU_SCRIPT_PATH).new()
	var gold_label := Label.new()
	menu.set("gold_label", gold_label)
	menu.set("gem_label", Label.new())
	# store_manager and gem_manager resolve via get_node_or_null("/root/...")
	# when the node enters the tree — manually wire them so the binding
	# functions can read them without tree entry.
	menu.set("store_manager", get_node_or_null(STORE_MANAGER_PATH))
	menu.set("gem_manager", get_node_or_null("/root/GemManager"))
	return [menu, gold_label]


func before_all():
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		pending("Main menu script not found at %s — skipping issue #901 suite." % MAIN_MENU_SCRIPT_PATH)
		return
	if get_node_or_null(STORE_MANAGER_PATH) == null:
		pending("StoreManager autoload not available — skipping issue #901 suite.")


func test_main_menu_source_does_not_call_get_gold_balance() -> void:
	## Source-level guard against the dangling accessor (issue #901).
	var file := FileAccess.open(MAIN_MENU_SCRIPT_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % MAIN_MENU_SCRIPT_PATH)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()

	assert_false(
		text.contains("get_gold_balance"),
		"main_menu.gd must not reference the nonexistent gem_manager.get_gold_balance() (issue #901)."
	)


func test_main_menu_connects_currency_updated_and_calls_get_coins() -> void:
	## Asserts the canonical accessors are wired up in the source.
	var file := FileAccess.open(MAIN_MENU_SCRIPT_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % MAIN_MENU_SCRIPT_PATH)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()

	assert_true(
		text.contains("currency_updated.connect"),
		"main_menu.gd must connect to StoreManager.currency_updated (issue #901)."
	)
	assert_true(
		text.contains("get_coins"),
		"main_menu.gd must call StoreManager.get_coins() for the initial gold_label value (issue #901)."
	)


func test_gold_label_populates_from_store_manager_get_coins() -> void:
	## The fix calls store_manager.get_coins() in _update_gold_display(). Pin
	## current_coins, call the function, and assert the label is populated.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	var sm := get_node_or_null(STORE_MANAGER_PATH)
	if sm == null:
		return

	sm.current_coins = 42

	var pair: Array = _make_menu_with_label()
	var menu: Control = pair[0]
	var gold_label: Label = pair[1]

	menu._update_gold_display()

	assert_true(
		gold_label.text.is_valid_int(),
		"GoldLabel.text must be a numeric integer after _update_gold_display() (issue #901). Got: '%s'" % gold_label.text
	)
	assert_eq(
		gold_label.text,
		"%d" % sm.get_coins(),
		"GoldLabel.text must equal StoreManager.get_coins() after _update_gold_display() (issue #901)."
	)


func test_gold_label_does_not_use_gem_manager_for_coins() -> void:
	## Verifies the fix routes through store_manager (the post-#866 source of
	## truth) and NOT gem_manager. Set gem_manager to a sentinel that would
	## crash the old code and verify the label still updates correctly.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	var sm := get_node_or_null(STORE_MANAGER_PATH)
	if sm == null:
		return

	sm.current_coins = 88

	var pair: Array = _make_menu_with_label()
	var menu: Control = pair[0]
	var gold_label: Label = pair[1]

	# Replace gem_manager with a sentinel that lacks the old accessor. With
	# the bug, _update_gold_display() would call .get_gold_balance() on it
	# and crash. With the fix, the gem_manager is not consulted for coins.
	var sentinel := Node.new()
	sentinel.set_script(GDScript.new())  # empty script — has no methods
	menu.set("gem_manager", sentinel)

	menu._update_gold_display()

	assert_eq(
		gold_label.text,
		"%d" % sm.get_coins(),
		"GoldLabel must read coins from StoreManager.get_coins(), not gem_manager (issue #901)."
	)

	sentinel.free()


func test_gold_label_updates_when_currency_updated_signal_fires() -> void:
	## Wire the binding manually (mirroring what _ready() does) and verify
	## the signal updates the label.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	var sm := get_node_or_null(STORE_MANAGER_PATH)
	if sm == null:
		return

	var pair: Array = _make_menu_with_label()
	var menu: Control = pair[0]
	var gold_label: Label = pair[1]

	# Mirror main_menu._ready() lines 52-58: connect the signal handler and
	# seed the label from get_coins().
	var handler: Callable = Callable(menu, "_on_currency_updated")
	sm.currency_updated.connect(handler)
	menu._update_gold_display()

	# In production, the methods that emit currency_updated also update
	# current_coins before emitting — so the binding (which reads
	# get_coins()) tracks the new balance correctly. Mirror that here.
	var expected_coins := 12345
	sm.current_coins = expected_coins
	sm.currency_updated.emit(0, expected_coins)

	assert_eq(
		gold_label.text,
		"%d" % expected_coins,
		"GoldLabel must reflect the coins from StoreManager.currency_updated (issue #901). Expected '%d', got '%s'." % [expected_coins, gold_label.text]
	)

	sm.currency_updated.disconnect(handler)


func test_gold_label_remains_in_sync_after_multiple_emits() -> void:
	## Two sequential emits — label must end at the second value, proving the
	## binding is not a one-shot cache.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	var sm := get_node_or_null(STORE_MANAGER_PATH)
	if sm == null:
		return

	var pair: Array = _make_menu_with_label()
	var menu: Control = pair[0]
	var gold_label: Label = pair[1]

	var handler: Callable = Callable(menu, "_on_currency_updated")
	sm.currency_updated.connect(handler)
	menu._update_gold_display()

	sm.current_coins = 100
	sm.currency_updated.emit(0, 100)
	assert_eq(gold_label.text, "100", "GoldLabel must update after first emit (issue #901).")

	sm.current_coins = 777
	sm.currency_updated.emit(0, 777)
	assert_eq(gold_label.text, "777", "GoldLabel must update after second emit (issue #901).")

	sm.currency_updated.disconnect(handler)
