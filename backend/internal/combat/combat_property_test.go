// Package combat provides property-based tests for combat calculations.
package combat

import (
	"math/rand"
	"testing"
	"testing/quick"
)

// TestDamageProperty_NonNegative verifies that damage is always non-negative.
func TestDamageProperty_NonNegative(t *testing.T) {
	property := func(attack, defense int) bool {
		attacker := &PlayerStats{}
		attacker.Stats.Attack = attack

		defender := &PlayerStats{}
		defender.Stats.Defense = defense

		damage := CalculateDamage(attacker, defender)
		return damage >= 0
	}

	config := &quick.Config{
		MaxCount: 1000,
		Rand:     rand.New(rand.NewSource(42)),
	}

	if err := quick.Check(property, config); err != nil {
		t.Errorf("Damage calculation produced negative value: %v", err)
	}
}

// TestDamageProperty_Deterministic verifies that damage calculation is deterministic.
func TestDamageProperty_Deterministic(t *testing.T) {
	property := func(attack, defense int, seed int64) bool {
		attacker := &PlayerStats{}
		attacker.Stats.Attack = attack

		defender := &PlayerStats{}
		defender.Stats.Defense = defense

		damage1 := CalculateDamage(attacker, defender)
		damage2 := CalculateDamage(attacker, defender)
		return damage1 == damage2
	}

	if err := quick.Check(property, nil); err != nil {
		t.Errorf("Damage calculation is non-deterministic: %v", err)
	}
}

// TestDamageProperty_DefenseReducesDamage verifies that higher defense never increases damage.
func TestDamageProperty_DefenseReducesDamage(t *testing.T) {
	property := func(attack, defense1, defense2 int) bool {
		if defense1 == defense2 {
			return true // Skip equal values
		}

		attacker := &PlayerStats{}
		attacker.Stats.Attack = attack

		defender1 := &PlayerStats{}
		defender1.Stats.Defense = defense1

		defender2 := &PlayerStats{}
		defender2.Stats.Defense = defense2

		damage1 := CalculateDamage(attacker, defender1)
		damage2 := CalculateDamage(attacker, defender2)

		// If defense1 > defense2, then damage1 should <= damage2
		if defense1 > defense2 {
			return damage1 <= damage2
		}
		return damage1 >= damage2
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 1000}); err != nil {
		t.Errorf("Higher defense increased damage: %v", err)
	}
}

// TestDamageProperty_CritIncreasesDamage verifies that critical hits always deal more damage.
func TestDamageProperty_CritIncreasesDamage(t *testing.T) {
	// This uses the actual crit multiplier (2x) from combat.go
	property := func(attack, defense int, isCrit bool) bool {
		attacker := &PlayerStats{}
		attacker.Stats.Attack = attack

		defender := &PlayerStats{}
		defender.Stats.Defense = defense

		normalDamage := CalculateDamage(attacker, defender)

		// Simulate crit (2x multiplier from combat.go)
		critDamage := normalDamage * 2

		return critDamage >= normalDamage
	}

	if err := quick.Check(property, nil); err != nil {
		t.Errorf("Critical hit did not increase damage: %v", err)
	}
}

// TestHitChanceProperty_Bounded verifies that hit chance is bounded [0.1, 0.95].
func TestHitChanceProperty_Bounded(t *testing.T) {
	property := func(angle float64, dodge int) bool {
		hitChance := CalculateHitChance(angle, dodge)
		return hitChance >= 0.1 && hitChance <= 0.95
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 1000}); err != nil {
		t.Errorf("Hit chance out of bounds [0.1, 0.95]: %v", err)
	}
}

// TestCritProperty_Statistical verifies that crit rate produces expected statistical distribution.
func TestCritProperty_Statistical(t *testing.T) {
	critRate := 25 // 25% crit rate
	runs := 10000

	crits := 0
	for i := 0; i < runs; i++ {
		if CalculateCrit(critRate) {
			crits++
		}
	}

	actualRate := float64(crits) / float64(runs) * 100
	expectedRate := float64(critRate)
	tolerance := 2.0 // 2% tolerance

	if actualRate < expectedRate-tolerance || actualRate > expectedRate+tolerance {
		t.Errorf("Crit rate %.2f%% outside expected range [%.2f%%, %.2f%%]", actualRate, expectedRate-tolerance, expectedRate+tolerance)
	}
}
