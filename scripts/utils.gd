## Utility functions for Armored Archer
## Contains common helper functions used throughout the game

## Clamps a value to the specified range [min, max]
## Returns the value if it is within range, otherwise returns min or max
static func clamp(value: float, min_val: float, max_val: float) -> float:
	if value < min_val:
		return min_val
	elif value > max_val:
		return max_val
	else:
		return value
