## Utility functions for Armored Archer
## Contains common helper functions used throughout the game

## Clamps a value to the specified range [min, max]
## Returns the value if it is within range, otherwise returns min or max
static func clamp(value: float, min_val: float, max_val: float) -> float:
	return clampf(value, min_val, max_val)
