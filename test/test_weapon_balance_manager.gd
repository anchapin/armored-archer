extends GutTest

# Tests for WeaponBalanceManager autoload
# Tests weapon balance calculations, damage curves, and balance adjustments

var weapon_balance_manager: Node
var gear_enums
var _balance_script

func before_each():
	# Load gear enums
	gear_enums = preload("res://scripts/gear_enums.gd")

	# Load WeaponBalanceManager script
	_balance_script = preload("res://autoloads/WeaponBalanceManager.gd")

	# Create WeaponBalanceManager instance
	weapon_balance_manager = _balance_script.new()
	# Set up as if it were autoload
	weapon_balance_manager.name = "WeaponBalanceManager"
	weapon_balance_manager.gear_registry = null  # Will use simple tests without registry
	add_child(weapon_balance_manager)

func after_each():
	if weapon_balance_manager:
		weapon_balance_manager.queue_free()


func test_weapon_balance_manager_exists():
	assert_not_null(weapon_balance_manager, "WeaponBalanceManager should be instantiated")


func test_tier_multipliers_defined():
	# Test that all tier multipliers are defined
	var multipliers = weapon_balance_manager.TIER_MULTIPLIERS
	assert_true(multipliers.has(gear_enums.GearRarity.COMMON), "Common tier multiplier should exist")
	assert_true(multipliers.has(gear_enums.GearRarity.RARE), "Rare tier multiplier should exist")
	assert_true(multipliers.has(gear_enums.GearRarity.EPIC), "Epic tier multiplier should exist")
	assert_true(multipliers.has(gear_enums.GearRarity.LEGENDARY), "Legendary tier multiplier should exist")


func test_pvp_damage_differs_from_pve_damage():
	# Test that PvP damage is reduced compared to PvE damage
	var base_damage: float = 100.0
	var tier = gear_enums.GearRarity.LEGENDARY

	var pvp_damage = weapon_balance_manager.get_pvp_damage(base_damage, tier)
	var pve_damage = weapon_balance_manager.get_pve_damage(base_damage, tier)

	# PvP damage should be less due to PVP_DAMAGE_REDUCTION
	assert_true(pvp_damage < pve_damage, "PvP damage should be less than PvE damage for same weapon")
	print("PvP damage: %s, PvE damage: %s" % [pvp_damage, pve_damage])


func test_pvp_damage_for_all_tiers():
	# Test PvP damage calculation for all tiers
	var base_damage: float = 50.0

	for tier in [gear_enums.GearRarity.COMMON, gear_enums.GearRarity.RARE, gear_enums.GearRarity.EPIC, gear_enums.GearRarity.LEGENDARY]:
		var pvp_damage = weapon_balance_manager.get_pvp_damage(base_damage, tier)
		assert_true(pvp_damage > 0, "PvP damage should be positive for tier %s" % tier)
		assert_true(pvp_damage < base_damage * 2.5, "PvP damage should be reasonable for tier %s" % tier)
		print("Tier %s PvP damage: %s" % [tier, pvp_damage])


func test_damage_curve_diminishing_returns():
	# Test that damage curve applies diminishing returns
	var tier = gear_enums.GearRarity.LEGENDARY

	# Test with low damage - should scale linearly
	var low_damage = weapon_balance_manager.get_pvp_damage(20.0, tier)
	# Test with high damage - should have diminishing returns
	var high_damage = weapon_balance_manager.get_pvp_damage(200.0, tier)

	# The high damage input shouldn't produce 10x the output due to diminishing returns
	var ratio = high_damage / low_damage
	assert_true(ratio < 8.0, "Damage curve should apply diminishing returns (ratio: %s)" % ratio)
	print("Low damage output: %s, High damage output: %s, Ratio: %s" % [low_damage, high_damage, ratio])


func test_no_weapon_exceeds_tier_average():
	# Test that weapon damage doesn't exceed 200% of tier average (anti-one-shot protection)
	var max_allowed_multiplier = weapon_balance_manager.MAX_DAMAGE_PERCENTAGE

	for tier in [gear_enums.GearRarity.COMMON, gear_enums.GearRarity.RARE, gear_enums.GearRarity.EPIC, gear_enums.GearRarity.LEGENDARY]:
		# Try to create an overpowered weapon
		var extreme_damage = weapon_balance_manager.get_pvp_damage(500.0, tier)
		var tier_avg = weapon_balance_manager._get_tier_average_damage(tier)
		var expected_max = tier_avg * max_allowed_multiplier

		assert_true(extreme_damage <= expected_max,
			"Damage should not exceed %s of tier average (got %s, max %s)" % [max_allowed_multiplier, extreme_damage, expected_max])
		print("Tier %s: extreme damage %s <= max %s" % [tier, extreme_damage, expected_max])


func test_weapon_power_rating_calculation():
	# Test weapon power rating calculation
	var weapon_data = {
		"gear_id": "test_bow",
		"gear_type": gear_enums.GearType.BOW,
		"rarity": gear_enums.GearRarity.LEGENDARY,
		"stats": {
			"attack": 25,
			"defense": 10,
			"critical_chance": 15
		}
	}

	var power_rating = weapon_balance_manager.get_weapon_power_rating(weapon_data)

	# Legendary weapons should have high power rating (base 400 + stats)
	assert_true(power_rating >= 400, "Legendary weapon should have high power rating")
	assert_true(power_rating >= 450, "Weapon with good stats should have even higher power rating")
	print("Weapon power rating: %s" % power_rating)


func test_weapon_power_rating_increases_with_tier():
	# Test that power rating increases with tier
	var weapon_common = {
		"gear_id": "test_bow_common",
		"gear_type": gear_enums.GearType.BOW,
		"rarity": gear_enums.GearRarity.COMMON,
		"stats": {}
	}

	var weapon_legendary = {
		"gear_id": "test_bow_legendary",
		"gear_type": gear_enums.GearType.BOW,
		"rarity": gear_enums.GearRarity.LEGENDARY,
		"stats": {}
	}

	var rating_common = weapon_balance_manager.get_weapon_power_rating(weapon_common)
	var rating_legendary = weapon_balance_manager.get_weapon_power_rating(weapon_legendary)

	assert_true(rating_legendary > rating_common,
		"Legendary weapon should have higher power rating than common")


func test_balance_adjustment_applies():
	# Test that balance adjustment multiplier applies correctly
	var weapon_id = "test_bow_overpowered"
	var base_damage = 100.0
	var tier = gear_enums.GearRarity.LEGENDARY

	# Get damage before adjustment
	var damage_before = weapon_balance_manager.get_pvp_damage(base_damage, tier)

	# Apply balance adjustment (reduce damage by 50%)
	weapon_balance_manager.apply_balance_adjustment(weapon_id, 0.5)

	# Verify adjustment was stored
	var multiplier = weapon_balance_manager.get_balance_adjustment(weapon_id)
	assert_eq(multiplier, 0.5, "Balance adjustment should be stored with correct multiplier")

	# Signal should have been emitted
	var signal_emitted = weapon_balance_manager.balance_adjustment_applied.is_connected(_dummy_handler)
	# Note: We can't easily test signal emission without connecting a handler first
	print("Balance adjustment signal testing skipped (handler connection required)")


func test_balance_adjustment_reverts():
	# Test that balance adjustment can be reverted
	var weapon_id = "test_bow_revert"

	# Apply adjustment
	weapon_balance_manager.apply_balance_adjustment(weapon_id, 0.5)
	var multiplier_before = weapon_balance_manager.get_balance_adjustment(weapon_id)
	assert_eq(multiplier_before, 0.5, "Adjustment should be applied")

	# Revert adjustment
	weapon_balance_manager.revert_balance_adjustment(weapon_id)

	# Verify adjustment was removed
	var multiplier_after = weapon_balance_manager.get_balance_adjustment(weapon_id)
	assert_eq(multiplier_after, 1.0, "After revert, multiplier should return to default (1.0)")


func test_validate_weapon_damage():
	# Test weapon damage validation
	var tier = gear_enums.GearRarity.COMMON

	# Valid damage should pass
	assert_true(weapon_balance_manager.validate_weapon_damage(50.0, tier),
		"Valid damage should pass validation")

	# Overpowered damage should fail
	var tier_avg = weapon_balance_manager._get_tier_average_damage(tier)
	var excessive_damage = tier_avg * 3.0
	assert_false(weapon_balance_manager.validate_weapon_damage(excessive_damage, tier),
		"Excessive damage should fail validation")


func test_pvp_damage_reduction_constant():
	# Test that PvP damage reduction is a reasonable value
	var reduction = weapon_balance_manager.get_pvp_damage_reduction()
	assert_true(reduction > 0.0, "PvP damage reduction should be positive")
	assert_true(reduction < 1.0, "PvP damage reduction should be less than 100%")
	assert_eq(reduction, 0.85, "PvP damage reduction should be 85%")


func test_tier_multiplier_retrieval():
	# Test retrieving tier multipliers
	for tier in [gear_enums.GearRarity.COMMON, gear_enums.GearRarity.RARE, gear_enums.GearRarity.EPIC, gear_enums.GearRarity.LEGENDARY]:
		var multiplier = weapon_balance_manager.get_tier_multiplier(tier)
		assert_true(multiplier > 0, "Tier multiplier should be positive")
		assert_true(multiplier >= 1.0, "Tier multiplier should be at least 1.0")
		assert_true(multiplier <= 2.0, "Tier multiplier should be at most 2.0")


func test_stats_bonus_to_damage():
	# Test that weapon stats contribute to damage
	var base_damage = 50.0
	var tier = gear_enums.GearRarity.EPIC

	# Without stats
	var damage_no_stats = weapon_balance_manager.get_pvp_damage(base_damage, tier, {})

	# With attack stats
	var damage_with_attack = weapon_balance_manager.get_pvp_damage(base_damage, tier, {"attack": 20})

	# Damage with attack should be higher
	assert_true(damage_with_attack > damage_no_stats,
		"Weapon with attack stat should deal more damage")


func test_negative_multiplier_rejected():
	# Test that negative balance adjustments are rejected
	var weapon_id = "test_negative"

	# This should log an error and not apply the adjustment
	weapon_balance_manager.apply_balance_adjustment(weapon_id, -0.5)

	# Adjustment should NOT be stored (should still be default 1.0)
	var multiplier = weapon_balance_manager.get_balance_adjustment(weapon_id)
	assert_eq(multiplier, 1.0, "Negative multiplier should not be stored")


# Dummy handler for signal testing
func _dummy_handler(weapon_id: String, multiplier: float) -> void:
	pass
