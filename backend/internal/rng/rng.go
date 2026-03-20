// Package rng provides random number generation utilities.
// Implemented in: 06-04-PLAN.md Task 1
package rng

import "math/rand"

var (
	source = rand.NewSource(0)
	rng    = rand.New(source)
)

// RNG returns the random generator.
func RNG() *rand.Rand {
	return rng
}

// Seed resets the RNG seed.
func Seed(seed int64) {
	source = rand.NewSource(seed)
	rng = rand.New(source)
}

// RollInt generates a random int in range [min, max).
func RollInt(min, max int) int {
	if min >= max {
		return min
	}
	return rng.Intn(max-min) + min
}

// RollFloat generates a random float64 in range [min, max).
func RollFloat(min, max float64) float64 {
	if min >= max {
		return min
	}
	return rng.Float64()*(max-min) + min
}
