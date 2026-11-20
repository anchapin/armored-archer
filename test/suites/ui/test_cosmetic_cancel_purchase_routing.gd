extends GutTest

# Keep production confirmation routing, but skip catalog/autoload setup and
# post-purchase display updates. All purchase calls below go to a local stub.
class IsolatedShop extends "res://scenes/ui/cosmetic_shop.gd":
	func _ready() -> void:
		pass

	func _exit_tree() -> void:
		pass

	func _show_skin_preview(_skin_id: String) -> void:
		pass

	func _load_slot(_slot: String) -> void:
		pass

	func _update_bundle_display() -> void:
		pass

class PurchaseStub extends Node:
	var skin_calls: Array = []
	var bundle_calls: Array = []

	func get_skin_info(_skin_id: String) -> Dictionary:
		return {"skin_name": "Test Skin", "price": 10}

	func purchase_skin(skin_id: String) -> bool:
		skin_calls.append(skin_id)
		return true

	func purchase_bundle(bundle_id: String) -> bool:
		bundle_calls.append(bundle_id)
		return true

var shop: Node
var purchases: PurchaseStub
var fixture_viewport: SubViewport

func before_each() -> void:
	# Give embedded dialogs stable bounds, including with the headless driver.
	fixture_viewport = SubViewport.new()
	fixture_viewport.size = Vector2i(1280, 720)
	fixture_viewport.gui_embed_subwindows = true
	add_child_autofree(fixture_viewport)
	purchases = PurchaseStub.new()
	add_child_autofree(purchases)
	shop = load("res://scenes/ui/cosmetic_shop.tscn").instantiate()
	shop.set_script(IsolatedShop)
	fixture_viewport.add_child(shop)
	# Text wrapping is outside this routing test; avoid dummy-font popup growth.
	shop.confirmation_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	shop.gem_manager = purchases
	shop.store_manager = null
	shop.available_bundles = [{"bundle_id": "bundle_test", "price": 250,
		"name": "Test Bundle", "item_ids": ["skin_other"]}]
	# Use production signal wiring after replacing the managers; no real
	# autoload method is called and no network/currency state is changed.
	shop._setup_button_connections()

func test_cancel_bundle_then_confirm_skin_only_buys_selected_skin() -> void:
	shop._on_bundle_purchase_pressed()
	shop.no_button.pressed.emit()
	assert_false(shop.purchase_confirmation_dialog.visible)
	assert_false(shop._bundle_confirm_handler.is_valid())
	assert_true(shop.yes_button.pressed.is_connected(shop._on_purchase_confirmed))
	assert_eq(shop.yes_button.pressed.get_connections().size(), 1)
	assert_eq(purchases.skin_calls.size(), 0)
	assert_eq(purchases.bundle_calls.size(), 0)

	shop.selected_skin_id = "skin_selected"
	shop._on_purchase_button_pressed()
	assert_true(shop.confirmation_label.text.contains("Test Skin"))
	shop.yes_button.pressed.emit()
	assert_eq(purchases.skin_calls, ["skin_selected"])
	assert_eq(purchases.bundle_calls.size(), 0,
		"A canceled bundle must never be bought by a later skin confirmation.")

func test_repeated_cancel_keeps_one_normal_handler_and_no_purchase() -> void:
	for _cycle in range(2):
		shop._on_bundle_purchase_pressed()
		shop.no_button.pressed.emit()
		shop._on_purchase_canceled()
		assert_eq(shop.yes_button.pressed.get_connections().size(), 1)
		assert_true(shop.yes_button.pressed.is_connected(shop._on_purchase_confirmed))
	assert_eq(purchases.skin_calls.size(), 0)
	assert_eq(purchases.bundle_calls.size(), 0)

func test_cancel_normal_skin_dialog_does_not_buy_or_duplicate_handler() -> void:
	shop.selected_skin_id = "skin_selected"
	shop._on_purchase_button_pressed()
	shop.no_button.pressed.emit()
	assert_eq(shop.yes_button.pressed.get_connections().size(), 1)
	assert_true(shop.yes_button.pressed.is_connected(shop._on_purchase_confirmed))
	assert_eq(purchases.skin_calls.size(), 0)
	assert_eq(purchases.bundle_calls.size(), 0)
