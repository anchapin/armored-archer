extends GutTest

## Issue #1850: `scenes/ui/cosmetic_shop.tscn` was missing nodes that
## `scenes/ui/cosmetic_shop.gd` requires, and the bundle confirmation used a
## broken handler swap.
##
##   1. `MainContainer/SlotTabs/AmuletButton` did not exist, yet
##      `_setup_button_connections()` connects `amulet_button.pressed`
##      *unguarded*. The missing node made the `@onready` reference resolve to
##      `null` and aborted the whole connection setup.
##   2. The `MainContainer/BundleContainer` subtree (BundleNameLabel,
##      BundleDescriptionLabel, BundlePriceLabel, BundleSaveLabel,
##      BundlePurchaseButton) did not exist either, so the bundle section of
##      the shop could never be shown.
##   3. `_on_bundle_purchase_pressed()` connected an anonymous lambda to
##      `yes_button.pressed` while `_on_bundle_purchase_confirmed()` tried to
##      disconnect a *different* lambda instance. Two separately created
##      lambdas are never equal in Godot, so the disconnect could never match
##      and the signal accumulated a stale handler on every purchase. The fix
##      stores the `Callable` in a member so connect/disconnect pair up.
##
## The suite drives the real scene: it instantiates the packed scene, lets
## `_ready()` run, and asserts that every `@onready` reference resolves, that
## every tab/action button ends up with exactly one `pressed` connection, that
## a stubbed bundle catalog makes the bundle container visible, and that two
## consecutive bundle-purchase confirm cycles leave `yes_button.pressed` with
## exactly one connection.

const SCENE_PATH := "res://scenes/ui/cosmetic_shop.tscn"
const SCRIPT_PATH := "res://scenes/ui/cosmetic_shop.gd"

## Fixture bundle used by the stubbed catalog.
const BUNDLE_ID := "bundle_test"
const BUNDLE_NAME := "Starter Bundle"
const BUNDLE_DESCRIPTION := "A handful of cosmetic extras."
const BUNDLE_PRICE := 250
const BUNDLE_ORIGINAL_TOTAL := 500


## Minimal skin descriptor returned by the stubbed `get_skin_info()`.
class StubSkinInfo extends RefCounted:
	var skin_id := "skin_helm_1"
	var skin_name := "Test Helm"
	var price := 10
	var is_launch_exclusive := false


## Stub of the GemManager surface the shop screen uses. It is a plain node
## (never the real autoload), so no global state is mutated. `purchase_bundle()`
## and `purchase_skin()` are coroutines because `cosmetic_shop.gd` awaits them.
class StubGemManager extends Node:
	signal skin_purchased(skin_id: String)
	signal skin_equipped(skin_id: String, slot: String)
	signal bundle_purchased(bundle_id: String, items: Array)

	var bundle_owned := false
	var gem_balance := 1000
	var purchase_bundle_calls := 0
	var purchase_skin_calls := 0

	func get_gem_balance() -> int:
		return gem_balance

	func get_skins_by_slot(_slot_name: String) -> Array:
		return []

	func get_skin_info(_skin_id: String):
		return StubSkinInfo.new()

	func is_skin_owned(_skin_id: String) -> bool:
		return false

	func get_equipped_skin(_slot_name: String) -> String:
		return ""

	func is_bundle_owned(_bundle_id: String) -> bool:
		return bundle_owned

	func get_bundle_catalog() -> Array:
		return []

	func purchase_bundle(_bundle_id: String) -> bool:
		await get_tree().process_frame
		purchase_bundle_calls += 1
		return true

	func purchase_skin(_skin_id: String) -> bool:
		await get_tree().process_frame
		purchase_skin_calls += 1
		return true


var _shop: Node
var _stub_gem_manager: StubGemManager


func before_each() -> void:
	# The stub lives in the tree so its `await get_tree().process_frame`
	# inside `purchase_bundle()` can resolve.
	_stub_gem_manager = StubGemManager.new()
	add_child_autofree(_stub_gem_manager)


func after_each() -> void:
	_shop = null
	_stub_gem_manager = null


func _fixture_bundle() -> Dictionary:
	return {
		"bundle_id": BUNDLE_ID,
		"name": BUNDLE_NAME,
		"description": BUNDLE_DESCRIPTION,
		"price": BUNDLE_PRICE,
		"original_total": BUNDLE_ORIGINAL_TOTAL,
		"item_ids": ["skin_helm_1", "skin_armor_1"],
	}


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % path)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func _instantiate_shop() -> Node:
	var packed := load(SCENE_PATH) as PackedScene
	assert_not_null(packed, "Could not load %s" % SCENE_PATH)
	if packed == null:
		return null
	var shop = packed.instantiate()
	assert_not_null(shop, "%s must instantiate as a Control." % SCENE_PATH)
	if shop == null:
		return null
	add_child_autofree(shop)
	_shop = shop
	return shop


func _pressed_connection_count(button: Button) -> int:
	if button == null:
		return -1
	return button.pressed.get_connections().size()


func _wait_frames(count: int) -> void:
	## Lets the awaited coroutines inside the screen settle.
	for _frame in range(count):
		await get_tree().process_frame


# ---------------------------------------------------------------------------
# 1. Static guards.
# ---------------------------------------------------------------------------


func test_scene_declares_the_required_nodes() -> void:
	var tscn := _read_text(SCENE_PATH)
	for needle in [
		"[node name=\"AmuletButton\" type=\"Button\" parent=\"MainContainer/SlotTabs\"]",
		"[node name=\"BundleContainer\" type=\"PanelContainer\" parent=\"MainContainer\"]",
		"[node name=\"BundleNameLabel\" type=\"Label\" parent=\"MainContainer/BundleContainer\"]",
		"[node name=\"BundleDescriptionLabel\" type=\"Label\" parent=\"MainContainer/BundleContainer\"]",
		"[node name=\"BundlePriceLabel\" type=\"Label\" parent=\"MainContainer/BundleContainer\"]",
		"[node name=\"BundleSaveLabel\" type=\"Label\" parent=\"MainContainer/BundleContainer\"]",
		"[node name=\"BundlePurchaseButton\" type=\"Button\" parent=\"MainContainer/BundleContainer\"]",
	]:
		assert_true(tscn.contains(needle), "cosmetic_shop.tscn must declare %s (issue #1850)." % needle)


func test_script_never_disconnects_a_freshly_created_lambda() -> void:
	## Two separately created lambdas are never equal, so disconnecting one can
	## never match the connected one.
	var source := _read_text(SCRIPT_PATH)
	assert_false(
		source.contains("disconnect(func("),
		"cosmetic_shop.gd must not disconnect an inline lambda (issue #1850)."
	)
	assert_true(
		source.contains("_bundle_confirm_handler"),
		"cosmetic_shop.gd must keep the bundle confirmation Callable in a member (issue #1850)."
	)


# ---------------------------------------------------------------------------
# 2. Runtime: the real scene instantiates and wires itself up.
# ---------------------------------------------------------------------------


func test_scene_ready_resolves_every_onready_reference() -> void:
	var shop = _instantiate_shop()
	if shop == null:
		return
	await get_tree().process_frame

	assert_not_null(shop.get_node_or_null("MainContainer/SlotTabs/AmuletButton"),
		"The amulet tab button must exist in the scene tree (issue #1850).")
	assert_not_null(shop.get_node_or_null("MainContainer/BundleContainer"),
		"The bundle container must exist in the scene tree (issue #1850).")

	assert_not_null(shop.amulet_button, "amulet_button must resolve (issue #1850).")
	assert_not_null(shop.bundle_container, "bundle_container must resolve (issue #1850).")
	assert_not_null(shop.bundle_name_label, "bundle_name_label must resolve (issue #1850).")
	assert_not_null(shop.bundle_description_label, "bundle_description_label must resolve (issue #1850).")
	assert_not_null(shop.bundle_price_label, "bundle_price_label must resolve (issue #1850).")
	assert_not_null(shop.bundle_save_label, "bundle_save_label must resolve (issue #1850).")
	assert_not_null(shop.bundle_purchase_button, "bundle_purchase_button must resolve (issue #1850).")

	# The rest of the screen must keep resolving too.
	assert_not_null(shop.helm_button, "helm_button must resolve (issue #1850).")
	assert_not_null(shop.armor_button, "armor_button must resolve (issue #1850).")
	assert_not_null(shop.bow_button, "bow_button must resolve (issue #1850).")
	assert_not_null(shop.arrow_button, "arrow_button must resolve (issue #1850).")
	assert_not_null(shop.skin_grid, "skin_grid must resolve (issue #1850).")
	assert_not_null(shop.purchase_button, "purchase_button must resolve (issue #1850).")
	assert_not_null(shop.equip_button, "equip_button must resolve (issue #1850).")
	assert_not_null(shop.yes_button, "yes_button must resolve (issue #1850).")
	assert_not_null(shop.no_button, "no_button must resolve (issue #1850).")


func test_tab_and_action_buttons_have_exactly_one_pressed_connection() -> void:
	var shop = _instantiate_shop()
	if shop == null:
		return
	await get_tree().process_frame

	for button in [
		shop.helm_button,
		shop.armor_button,
		shop.bow_button,
		shop.arrow_button,
		shop.amulet_button,
		shop.purchase_button,
		shop.equip_button,
		shop.bundle_purchase_button,
		shop.yes_button,
		shop.no_button,
		shop.back_button,
	]:
		assert_not_null(button, "Every wired button must resolve (issue #1850).")
		if button == null:
			continue
		assert_eq(
			_pressed_connection_count(button),
			1,
			"%s must have exactly one pressed connection after _ready() (issue #1850)." % button.name
		)


# ---------------------------------------------------------------------------
# 3. Runtime: the bundle section reacts to a stubbed catalog.
# ---------------------------------------------------------------------------


func test_stubbed_catalog_makes_the_bundle_container_visible() -> void:
	var shop = _instantiate_shop()
	if shop == null:
		return
	await get_tree().process_frame

	shop.set("gem_manager", _stub_gem_manager)
	shop.set("available_bundles", [_fixture_bundle()])
	shop._update_bundle_display()

	assert_true(shop.bundle_container.visible,
		"A stubbed, unowned bundle must show the bundle container (issue #1850).")
	assert_eq(shop.bundle_name_label.text, BUNDLE_NAME,
		"The bundle name label must show the catalog name (issue #1850).")
	assert_eq(shop.bundle_description_label.text, BUNDLE_DESCRIPTION,
		"The bundle description label must show the catalog description (issue #1850).")
	assert_eq(shop.bundle_price_label.text, "%d gems" % BUNDLE_PRICE,
		"The bundle price label must show the catalog price (issue #1850).")
	assert_eq(shop.bundle_save_label.text, "SAVE 50%",
		"The bundle save label must show the discount (issue #1850).")
	assert_false(shop.bundle_purchase_button.disabled,
		"The bundle purchase button must be enabled when the balance covers the price (issue #1850).")


# ---------------------------------------------------------------------------
# 4. Runtime: the confirmation handler swap leaves no stale connections.
# ---------------------------------------------------------------------------


func test_two_bundle_confirm_cycles_leave_a_single_yes_connection() -> void:
	var shop = _instantiate_shop()
	if shop == null:
		return
	await get_tree().process_frame

	shop.set("gem_manager", _stub_gem_manager)
	shop.set("available_bundles", [_fixture_bundle()])
	shop.set("selected_skin_id", "skin_helm_1")

	assert_eq(_pressed_connection_count(shop.yes_button), 1,
		"The yes button starts with the normal purchase handler (issue #1850).")

	for cycle in range(2):
		shop._on_bundle_purchase_pressed()
		assert_eq(_pressed_connection_count(shop.yes_button), 1,
			"The bundle handler must replace, not add to, the normal handler (cycle %d, issue #1850)." % cycle)

		# Pressing "Yes" must run the *bundle* handler and nothing else.
		shop.yes_button.pressed.emit()
		await _wait_frames(3)

		assert_eq(_stub_gem_manager.purchase_bundle_calls, cycle + 1,
			"Confirming must purchase the bundle exactly once (cycle %d, issue #1850)." % cycle)
		assert_eq(_stub_gem_manager.purchase_skin_calls, 0,
			"The normal skin handler must not run while the bundle handler is active (cycle %d, issue #1850)." % cycle)
		assert_eq(_pressed_connection_count(shop.yes_button), 1,
			"After confirming, the yes button must have exactly one connection (cycle %d, issue #1850)." % cycle)

	# The normal purchase handler must be back in place afterwards.
	shop.yes_button.pressed.emit()
	await _wait_frames(3)

	assert_eq(_pressed_connection_count(shop.yes_button), 1,
		"The yes button must still have exactly one connection after the swap (issue #1850).")
	assert_eq(_stub_gem_manager.purchase_bundle_calls, 2,
		"No further bundle may be purchased (issue #1850).")
	assert_eq(_stub_gem_manager.purchase_skin_calls, 1,
		"The normal purchase handler must be restored after the bundle swap (issue #1850).")


func test_confirming_a_bundle_never_reconnects_a_second_handler() -> void:
	## Guards the exact regression: the old code disconnected a *new* lambda,
	## so every purchase left the stale bundle handler attached.
	var shop = _instantiate_shop()
	if shop == null:
		return
	await get_tree().process_frame

	shop.set("gem_manager", _stub_gem_manager)
	shop.set("available_bundles", [_fixture_bundle()])

	shop._on_bundle_purchase_pressed()
	shop.yes_button.pressed.emit()
	await _wait_frames(3)

	assert_eq(_pressed_connection_count(shop.yes_button), 1,
		"Exactly one handler may stay connected to the yes button (issue #1850).")
	assert_eq(_stub_gem_manager.purchase_bundle_calls, 1,
		"The bundle purchase must run exactly once (issue #1850).")
