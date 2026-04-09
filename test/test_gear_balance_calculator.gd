extends GutTest

## Tests for GearBalanceCalculator autoload.
## Tests diminishing returns, power ratings, and synergy bonuses.

var gear_balance_calculator: Node

func before_all():
	# Get reference to the GearBalanceCalculator autoload
	gear_balance_calculator = get_node("/root/GearBalanceCalculator")

func test_calculate_effective_stat_no_diminishing_returns():
	# When stat is far below soft cap, no diminishing returns
	var base_stat: float = 10.0
	var synergy_bonus: float = 0.0
	var gear_type: String = "helm"
	var stat_name: String = "defense"

	var effective: float = gear_balance_calculator.calculate_effective_stat(
		base_stat, synergy_bonus, gear_type, stat_name
	)

	assert_almost_eq(effective, 10.0, 0.1, "Effective stat should equal base when below soft cap")

func test_calculate_effective_stat_with_diminishing_returns():
	# When stat approaches soft cap, diminishing returns kick in
	var base_stat: float = 60.0
	var synergy_bonus: float = 0.0
	var gear_type: String = "helm"
	var stat_name: String = "defense"
	var soft_cap: float = 70.0  # 70% of 100

	var effective: float = gear_balance_calculator.calculate_effective_stat(
		base_stat, synergy_bonus, gear_type, stat_name
	)

	# At 60/70 (85% of cap), efficiency should be reduced
	var ratio: float = 60.0 / soft_cap
	var expected_factor: float = 1.0 - (ratio * 0.5)  # ~57.5% efficiency
	var expected: float = 60.0 * expected_factor

	assert_almost_eq(effective, expected, 1.0, "Effective stat should show diminishing returns near cap")

func test_calculate_effective_stat_with_synergy_bonus():
	# Synergy bonus should increase effective stat
	var base_stat: float = 50.0
	var synergy_bonus: float = 0.1  # 10% bonus
	var gear_type: String = "helm"
	var stat_name: String = "defense"

	var effective: float = gear_balance_calculator.calculate_effective_stat(
		base_stat, synergy_bonus, gear_type, stat_name
	)

	var effective_no_bonus: float = gear_balance_calculator.calculate_effective_stat(
		base_stat, 0.0, gear_type, stat_name
	)

	assert_gt(effective, effective_no_bonus, "Synergy bonus should increase effective stat")

func test_get_gear_power_rating_common():
	# Common gear should have lower power rating
	var gear_data: Dictionary = {
		"rarity": "common",
		"stats": {
			"attack": 10,
			"defense": 10
		},
		"modifiers": []
	}

	var power: float = gear_balance_calculator.get_gear_power_rating(gear_data)

	assert_lt(power, 20.0, "Common gear should have power rating below 20")

func test_get_gear_power_rating_legendary():
	# Legendary gear with good stats should have high power rating
	var gear_data: Dictionary = {
		"rarity": "legendary",
		"stats": {
			"attack": 50,
			"defense": 50,
			"crit_rate": 20
		},
		"modifiers": [
			{
				"value_range": [10, 20]
			}
		]
	}

	var power: float = gear_balance_calculator.get_gear_power_rating(gear_data)

	assert_gt(power, 60.0, "Legendary gear should have power rating above 60")
	assert_lt(power, 100.0, "Power rating should be capped at 100")

func test_validate_gear_power_valid():
	# Valid gear should pass validation
	var gear_data: Dictionary = {
		"rarity": "rare",
		"type": "helm",
		"stats": {
			"defense": 40,
			"health": 200
		}
	}

	var validation: Dictionary = gear_balance_calculator.validate_gear_power(gear_data)

	assert_true(validation.get("valid", false), "Valid gear should pass validation")
	assert_eq(validation.get("reason", ""), "", "Valid gear should have no validation reason")

func test_validate_gear_power_overpowered():
	# Overpowered gear should fail validation
	var gear_data: Dictionary = {
		"rarity": "common",
		"type": "helm",
		"stats": {
			"defense": 150,  # Exceeds max of 100
			"health": 200
		}
	}

	var validation: Dictionary = gear_balance_calculator.validate_gear_power(gear_data)

	assert_false(validation.get("valid", true), "Overpowered gear should fail validation")
	assert_ne(validation.get("reason", ""), "", "Invalid gear should have validation reason")

func test_get_synergy_bonus_no_pieces():
	# No pieces from a set should give no bonus
	var gear_set: Dictionary = {
		"helm": "helm_basic",
		"armor": "armor_leather",
		"bow": "bow_wooden",
		"arrow": "arrow_wooden",
		"amulet": "amulet_protection"
	}

	var bonuses: Dictionary = gear_balance_calculator.get_synergy_bonus(gear_set)

	assert_eq(bonuses.size(), 0, "No synergy pieces should give no bonuses")

func test_get_synergy_bonus_two_pieces():
	# Two pieces from a set should give first tier bonus
	var gear_set: Dictionary = {
		"helm": "helm_dragon",
		"armor": "armor_plate",
		"bow": "bow_wooden",
		"arrow": "arrow_wooden",
		"amulet": "amulet_protection"
	}

	var bonuses: Dictionary = gear_balance_calculator.get_synergy_bonus(gear_set)

	assert_gt(bonuses.size(), 0, "Two synergy pieces should give bonuses")
	assert_eq(bonuses.get("attack", 0), 5, "Two dragon pieces should give +5 attack")

func test_get_synergy_bonus_full_set():
	# All five pieces should give all tier bonuses
	var gear_set: Dictionary = {
		"helm": "helm_dragon",
		"armor": "armor_plate",
		"bow": "bow_crossbow",
		"arrow": "arrow_dragon",
		"amulet": "amulet_dragon"
	}

	var bonuses: Dictionary = gear_balance_calculator.get_synergy_bonus(gear_set)

	assert_gt(bonuses.size(), 2, "Full synergy set should give multiple bonuses")
	assert_eq(bonuses.get("attack", 0), 5, "Full dragon set should give +5 attack")
	assert_eq(bonuses.get("crit_rate", 0), 3, "Full dragon set should give +3 crit rate")
	assert_eq(bonuses.get("health", 0), 50, "Full dragon set should give +50 health")
	assert_gt(bonuses.get("all_multiplier", 0), 0, "Full dragon set should give all stat multiplier")

func test_calculate_total_effective_stats():
	# Calculate total stats with diminishing returns from multiple gear
	var equipped_gear: Dictionary = {
		"helm": {
			"type": "helm",
			"stats": {"defense": 50, "health": 200}
		},
		"armor": {
			"type": "armor",
			"stats": {"defense": 80, "health": 300}
		}
	}

	var total_stats: Dictionary = gear_balance_calculator.calculate_total_effective_stats(equipped_gear)

	assert_gt(total_stats.get("defense", 0), 0, "Total defense should be calculated")
	assert_gt(total_stats.get("health", 0), 0, "Total health should be calculated")

	# Total should be less than sum due to diminishing returns
	var raw_sum: float = 50.0 + 80.0
	assert_lt(total_stats.get("defense", 0), raw_sum, "Diminishing returns should reduce total")

func test_format_power_rating_colors():
	# Verify power rating colors are formatted correctly
	var low_power: String = gear_balance_calculator.format_power_rating(10.0)
	assert_true(low_power.contains("#FFFFFF"), "Low power should use white color")

	var medium_power: String = gear_balance_calculator.format_power_rating(30.0)
	assert_true(medium_power.contains("#00FF00"), "Medium power should use green color")

	var high_power: String = gear_balance_calculator.format_power_rating(70.0)
	assert_true(high_power.contains("#9B30FF"), "High power should use purple color")

	var legendary_power: String = gear_balance_calculator.format_power_rating(90.0)
	assert_true(legendary_power.contains("#FFA500"), "Legendary power should use orange color")

func test_soft_cap_ratio_constant():
	# Verify soft cap ratio is 70%
	var expected: float = 0.7
	var actual: float = gear_balance_calculator.SOFT_CAP_RATIO

	assert_eq(actual, expected, "Soft cap ratio should be 70%")

func test_diminishing_factor_constant():
	# Verify diminishing factor is 0.5
	var expected: float = 0.5
	var actual: float = gear_balance_calculator.DIMINISHING_FACTOR

	assert_eq(actual, expected, "Diminishing factor should be 0.5")
