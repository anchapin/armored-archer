// Package rng provides random number generation utilities for the Armored Archer backend.
package rng

import (
	"math/rand"
	"sync"
	"time"
)

var (
	source rand.Source
	rng    *rand.Rand
	once   sync.Once
)

// init initializes the RNG with a time-based seed.
func init() {
	once.Do(func() {
		source = rand.NewSource(time.Now().UnixNano())
		rng = rand.New(source)
	})
}

// RNG returns the thread-safe random generator.
func RNG() *rand.Rand {
	return rng
}

// Seed resets the RNG seed (for testing).
func Seed(seed int64) {
	source = rand.NewSource(seed)
	rng = rand.New(source)
}

// RollInt generates a random int in range [min, max).
// If min >= max, returns min.
func RollInt(min, max int) int {
	if min >= max {
		return min
	}
	return rng.Intn(max-min) + min
}

// RollFloat generates a random float64 in range [min, max).
// If min >= max, returns min.
func RollFloat(min, max float64) float64 {
	if min >= max {
		return min
	}
	return rng.Float64()*(max-min) + min
}

// RollChoice selects a random element from slice.
// Returns zero value if slice is empty.
func RollChoice[T any](choices []T) T {
	if len(choices) == 0 {
		var zero T
		return zero
	}
	return choices[RollInt(0, len(choices))]
}

// Shuffle randomizes slice order in place.
func Shuffle[T any](slice []T) {
	rng.Shuffle(len(slice), func(i, j int) {
		slice[i], slice[j] = slice[j], slice[i]
	})
}
