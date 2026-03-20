// Package rng provides property-based tests for RNG systems.
package rng

import (
	"math/rand"
	"testing"
)

// TestRollIntProperty_WithinBounds verifies that RollInt returns value within bounds.
func TestRollIntProperty_WithinBounds(t *testing.T) {
	Seed(42) // Fixed seed for reproducibility
	for i := 0; i < 1000; i++ {
		min := rand.Intn(1000)
		max := min + rand.Intn(1000) + 1

		result := RollInt(min, max)

		if result < min || result >= max {
			t.Errorf("RollInt(%d, %d) returned %d, outside bounds", min, max, result)
		}
	}
}

// TestRollIntProperty_UniformDistribution verifies that RollInt produces uniform distribution.
func TestRollIntProperty_UniformDistribution(t *testing.T) {
	min := 0
	max := 100
	samples := 10000

	counts := make([]int, max-min)
	Seed(42) // Fixed seed for reproducibility

	for i := 0; i < samples; i++ {
		val := RollInt(min, max)
		counts[val]++
	}

	// Check each value appears approximately same number of times
	expected := float64(samples) / float64(max-min)
	tolerance := expected * 0.15 // 15% tolerance

	for i, count := range counts {
		if count < int(expected-tolerance) || count > int(expected+tolerance) {
			t.Errorf("Value %d appeared %d times, expected ~%d +/- %d", i, count, int(expected), int(tolerance))
		}
	}
}

// TestRollFloatProperty_WithinBounds verifies that RollFloat returns value within bounds.
func TestRollFloatProperty_WithinBounds(t *testing.T) {
	Seed(42)
	for i := 0; i < 1000; i++ {
		min := rand.Float64() * 100
		max := min + rand.Float64()*100

		result := RollFloat(min, max)

		if result < min || result >= max {
			t.Errorf("RollFloat(%.2f, %.2f) returned %.2f, outside bounds", min, max, result)
		}
	}
}

// TestRollChoiceProperty_FromSlice verifies that RollChoice always returns element from slice.
func TestRollChoiceProperty_FromSlice(t *testing.T) {
	Seed(42)
	choices := []string{"a", "b", "c", "d", "e"}

	for i := 0; i < 100; i++ {
		result := RollChoice(choices)

		found := false
		for _, choice := range choices {
			if result == choice {
				found = true
				break
			}
		}

		if !found {
			t.Errorf("RollChoice returned %v, not in original slice", result)
		}
	}
}

// TestShuffleProperty_Permutation verifies that Shuffle doesn't lose or duplicate elements.
func TestShuffleProperty_Permutation(t *testing.T) {
	Seed(42)
	original := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	for i := 0; i < 100; i++ {
		shuffled := make([]int, len(original))
		copy(shuffled, original)

		Shuffle(shuffled)

		// Check all elements present
		originalMap := make(map[int]int)
		for _, v := range original {
			originalMap[v]++
		}

		shuffledMap := make(map[int]int)
		for _, v := range shuffled {
			shuffledMap[v]++
		}

		if len(originalMap) != len(shuffledMap) {
			t.Errorf("Shuffle changed number of unique elements")
		}

		for k, v := range originalMap {
			if shuffledMap[k] != v {
				t.Errorf("Element count changed: %d had %d, now %d", k, v, shuffledMap[k])
			}
		}
	}
}

// TestSeedProperty_DifferentSequences verifies that different seeds produce different sequences.
func TestSeedProperty_DifferentSequences(t *testing.T) {
	Seed(123)
	seq1 := []int{RollInt(0, 100), RollInt(0, 100), RollInt(0, 100)}

	Seed(456)
	seq2 := []int{RollInt(0, 100), RollInt(0, 100), RollInt(0, 100)}

	// Sequences should be different (extremely unlikely to be same)
	same := true
	for i := range seq1 {
		if seq1[i] != seq2[i] {
			same = false
			break
		}
	}

	if same {
		t.Errorf("Different seeds produced same sequence: %v", seq1)
	}
}

// TestSeedProperty_SameSequence verifies that same seed produces same sequence.
func TestSeedProperty_SameSequence(t *testing.T) {
	Seed(789)
	seq1 := []int{RollInt(0, 100), RollInt(0, 100), RollInt(0, 100)}

	Seed(789)
	seq2 := []int{RollInt(0, 100), RollInt(0, 100), RollInt(0, 100)}

	for i := range seq1 {
		if seq1[i] != seq2[i] {
			t.Errorf("Same seed produced different sequences at index %d: %d != %d", i, seq1[i], seq2[i])
		}
	}
}
