package combat_test

import (
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/combat"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestCalculateHitChance(t *testing.T) {
	// Test base hit chance with no dodge
	hitChance := combat.CalculateHitChance(3.14159, 0)
	testhelpers.AssertTrue(t, hitChance >= 0.6 && hitChance <= 0.8,
		"Base hit chance should be around 70%")

	// Test hit chance with high dodge
	hitChance = combat.CalculateHitChance(3.14159, 100)
	testhelpers.AssertTrue(t, hitChance >= 0.1 && hitChance <= 0.3,
		"Hit chance with high dodge should be reduced")

	// Test minimum hit chance
	hitChance = combat.CalculateHitChance(0, 1000)
	testhelpers.AssertTrue(t, hitChance >= 0.1, "Hit chance should have minimum 10%")

	// Test maximum hit chance
	hitChance = combat.CalculateHitChance(3.14159, 0)
	testhelpers.AssertTrue(t, hitChance <= 0.95, "Hit chance should have maximum 95%")
}

func TestIsHit(t *testing.T) {
	// Run multiple times to account for randomness
	hits := 0
	runs := 1000

	for i := 0; i < runs; i++ {
		if combat.IsHit(3.14159, 0) {
			hits++
		}
	}

	hitRate := float64(hits) / float64(runs)
	testhelpers.AssertTrue(t, hitRate >= 0.6 && hitRate <= 0.8,
		"Hit rate should be around 70%")
}

func TestCalculateDamage(t *testing.T) {
	attacker := &combat.PlayerStats{}
	attacker.Stats.Attack = 20

	defender := &combat.PlayerStats{}
	defender.Stats.Defense = 10

	damage := combat.CalculateDamage(attacker, defender)
	testhelpers.AssertTrue(t, damage >= 1, "Damage should be at least 1")

	// Test with equal attack and defense
	attacker.Stats.Attack = 10
	defender.Stats.Defense = 10
	damage = combat.CalculateDamage(attacker, defender)
	testhelpers.AssertTrue(t, damage >= 1, "Damage should be at least 1 even with equal stats")

	// Test with nil stats
	damage = combat.CalculateDamage(nil, defender)
	testhelpers.AssertEqual(t, 0, damage, "Damage should be 0 with nil attacker")
}

func TestCalculateCrit(t *testing.T) {
	// Run multiple times to account for randomness
	crits := 0
	runs := 1000
	critRate := 25 // 25% crit rate

	for i := 0; i < runs; i++ {
		if combat.CalculateCrit(critRate) {
			crits++
		}
	}

	critRateActual := float64(crits) / float64(runs) * 100
	testhelpers.AssertTrue(t, critRateActual >= 20 && critRateActual <= 30,
		"Crit rate should be around 25%")
}

func TestCombatActionValidate(t *testing.T) {
	// Valid action
	action := &combat.CombatAction{
		MatchID:    "match123",
		ActionType: combat.ActionShoot,
		Angle:      3.14159,
		Power:      0.5,
	}
	err := action.Validate()
	testhelpers.AssertNoError(t, err, "Valid action should pass validation")

	// Invalid: empty match ID
	action.MatchID = ""
	err = action.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty match ID")

	// Invalid: wrong action type
	action.MatchID = "match123"
	action.ActionType = "invalid"
	err = action.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid action type")

	// Invalid: angle out of range
	action.ActionType = combat.ActionShoot
	action.Angle = 10.0
	err = action.Validate()
	testhelpers.AssertError(t, err, "Should fail with angle out of range")

	// Invalid: power out of range
	action.Angle = 3.14159
	action.Power = 1.5
	err = action.Validate()
	testhelpers.AssertError(t, err, "Should fail with power out of range")
}

func TestNewMatchState(t *testing.T) {
	creatorStats := &combat.PlayerStats{}
	opponentStats := &combat.PlayerStats{}

	matchState := combat.NewMatchState("match123", "creator1", "opponent1", creatorStats, opponentStats)

	testhelpers.AssertEqual(t, "match123", matchState.MatchID, "MatchID should match")
	testhelpers.AssertEqual(t, "creator1", matchState.CreatorID, "CreatorID should match")
	testhelpers.AssertEqual(t, "opponent1", matchState.OpponentID, "OpponentID should match")
	testhelpers.AssertEqual(t, combat.MatchStatusActive, matchState.Status, "Status should be active")
	testhelpers.AssertEqual(t, 100, matchState.CreatorHealth, "Creator health should be 100")
	testhelpers.AssertEqual(t, 100, matchState.OpponentHealth, "Opponent health should be 100")
	testhelpers.AssertEqual(t, 1, matchState.Turn, "Turn should be 1")
}

func TestMatchStateIsTurnTimeout(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	// Should not timeout immediately
	testhelpers.AssertFalse(t, matchState.IsTurnTimeout(), "Should not timeout immediately")

	// Simulate timeout by setting old timestamp
	matchState.LastTurnTimestamp = time.Now().UnixMilli() - 120000 // 2 minutes ago
	testhelpers.AssertTrue(t, matchState.IsTurnTimeout(), "Should timeout after 2 minutes")
}

func TestMatchStateHandleTurnTimeout(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	// First timeout should not forfeit
	forfeited := matchState.HandleTurnTimeout()
	testhelpers.AssertFalse(t, forfeited, "Should not forfeit on first timeout")
	testhelpers.AssertEqual(t, 1, matchState.ConsecutiveTimeouts, "Should have 1 consecutive timeout")

	// Second timeout should forfeit
	forfeited = matchState.HandleTurnTimeout()
	testhelpers.AssertTrue(t, forfeited, "Should forfeit on second timeout")
	testhelpers.AssertEqual(t, combat.MatchStatusCompleted, matchState.Status, "Status should be completed")
}

func TestMatchStateGetActivePlayer(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	testhelpers.AssertEqual(t, "creator1", matchState.GetActivePlayer(), "Creator should be active first")

	// Simulate turn switch
	matchState.CurrentTurnUserID = "opponent1"
	testhelpers.AssertEqual(t, "opponent1", matchState.GetActivePlayer(), "Opponent should be active after switch")
}

func TestMatchStateGetHealth(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	matchState.CreatorHealth = 80
	matchState.OpponentHealth = 60

	testhelpers.AssertEqual(t, 80, matchState.GetHealth("creator1"), "Creator health should be 80")
	testhelpers.AssertEqual(t, 60, matchState.GetHealth("opponent1"), "Opponent health should be 60")
}

func TestCombatResult(t *testing.T) {
	result := &combat.CombatResult{
		Success:     true,
		Hit:         true,
		Damage:      25,
		IsCrit:      true,
		MatchStatus: combat.MatchStatusActive,
	}

	jsonStr, err := result.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestProcessCombatAction(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})
	matchState.CreatorStats.Stats.Attack = 20
	matchState.OpponentStats.Stats.Defense = 10

	action := &combat.CombatAction{
		MatchID:    "match123",
		ActionType: combat.ActionShoot,
		Angle:      3.14159,
		Power:      0.5,
	}

	result, err := combat.ProcessCombatAction(matchState, action,
		matchState.CreatorStats, matchState.OpponentStats)

	testhelpers.AssertNoError(t, err, "Should process combat action")
	testhelpers.AssertTrue(t, result.Success, "Result should be successful")
	testhelpers.AssertTrue(t, result.MatchStatus == combat.MatchStatusActive ||
		result.MatchStatus == combat.MatchStatusCompleted, "Match should be active or completed")
}
