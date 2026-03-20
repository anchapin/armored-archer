package combat_test

import (
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/combat"
	"github.com/stretchr/testify/assert"
)

// TestCalculateHitChance verifies hit chance calculation with different dodge values.
// Uses testify assertions for range-based assertions.
func TestCalculateHitChance(t *testing.T) {
	tests := []struct {
		name           string
		pi             float64
		dodge          int
		minHitChance   float64
		maxHitChance   float64
	}{
		{"base_hit_chance", 3.14159, 0, 0.6, 0.8},
		{"high_dodge", 3.14159, 100, 0.1, 0.3},
		{"minimum_hit_chance", 0, 1000, 0.1, 0.95},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hitChance := combat.CalculateHitChance(tt.pi, tt.dodge)
			assert.True(t, hitChance >= tt.minHitChance && hitChance <= tt.maxHitChance,
				"Hit chance should be within range [%f, %f], got %f", tt.minHitChance, tt.maxHitChance, hitChance)
		})
	}
}

// TestIsHit verifies hit calculation over multiple runs.
// Uses testify assertions for statistical validation.
func TestIsHit(t *testing.T) {
	hits := 0
	runs := 1000

	for i := 0; i < runs; i++ {
		if combat.IsHit(3.14159, 0) {
			hits++
		}
	}

	hitRate := float64(hits) / float64(runs)
	assert.True(t, hitRate >= 0.6 && hitRate <= 0.8,
		"Hit rate should be around 70%%, got %f", hitRate)
}

// TestCalculateDamage verifies damage calculation with different attack/defense values.
// Uses testify assertions for clearer error messages.
func TestCalculateDamage(t *testing.T) {
	tests := []struct {
		name            string
		attack          int
		defense         int
		minDamage       int
		expectZeroDamage bool
	}{
		{"high_attack_low_defense", 20, 10, 1, false},
		{"equal_stats", 10, 10, 1, false},
		{"nil_attacker", 0, 10, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var attacker *combat.PlayerStats
			if !tt.expectZeroDamage {
				attacker = &combat.PlayerStats{}
				attacker.Stats.Attack = tt.attack
			}

			defender := &combat.PlayerStats{}
			defender.Stats.Defense = tt.defense

			damage := combat.CalculateDamage(attacker, defender)

			if tt.expectZeroDamage {
				assert.Equal(t, 0, damage, "Damage should be 0 with nil attacker")
			} else {
				assert.True(t, damage >= tt.minDamage, "Damage should be at least %d", tt.minDamage)
			}
		})
	}
}

// TestCalculateCrit verifies critical hit calculation over multiple runs.
// Uses testify assertions for statistical validation.
func TestCalculateCrit(t *testing.T) {
	crits := 0
	runs := 1000
	critRate := 25 // 25% crit rate

	for i := 0; i < runs; i++ {
		if combat.CalculateCrit(critRate) {
			crits++
		}
	}

	critRateActual := float64(crits) / float64(runs) * 100
	assert.True(t, critRateActual >= 20 && critRateActual <= 30,
		"Crit rate should be around 25%%, got %f", critRateActual)
}

// TestCombatActionValidate uses table-driven test pattern for action validation.
// Each test case validates a different combat action scenario.
func TestCombatActionValidate(t *testing.T) {
	tests := []struct {
		name        string
		setupAction func() *combat.CombatAction
		isValid     bool
	}{
		{
			name: "valid_action",
			setupAction: func() *combat.CombatAction {
				return &combat.CombatAction{
					MatchID:    "match123",
					ActionType: combat.ActionShoot,
					Angle:      3.14159,
					Power:      0.5,
				}
			},
			isValid: true,
		},
		{
			name: "empty_match_id",
			setupAction: func() *combat.CombatAction {
				action := &combat.CombatAction{
					MatchID:    "",
					ActionType: combat.ActionShoot,
					Angle:      3.14159,
					Power:      0.5,
				}
				return action
			},
			isValid: false,
		},
		{
			name: "invalid_action_type",
			setupAction: func() *combat.CombatAction {
				action := &combat.CombatAction{
					MatchID:    "match123",
					ActionType: "invalid",
					Angle:      3.14159,
					Power:      0.5,
				}
				return action
			},
			isValid: false,
		},
		{
			name: "angle_out_of_range",
			setupAction: func() *combat.CombatAction {
				action := &combat.CombatAction{
					MatchID:    "match123",
					ActionType: combat.ActionShoot,
					Angle:      10.0,
					Power:      0.5,
				}
				return action
			},
			isValid: false,
		},
		{
			name: "power_out_of_range",
			setupAction: func() *combat.CombatAction {
				action := &combat.CombatAction{
					MatchID:    "match123",
					ActionType: combat.ActionShoot,
					Angle:      3.14159,
					Power:      1.5,
				}
				return action
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			action := tt.setupAction()
			err := action.Validate()

			if tt.isValid {
				assert.NoError(t, err, "Valid action should pass validation")
			} else {
				assert.Error(t, err, "Should fail validation")
			}
		})
	}
}

// TestNewMatchState verifies match state initialization.
// Uses testify assertions for multiple field validation.
func TestNewMatchState(t *testing.T) {
	creatorStats := &combat.PlayerStats{}
	opponentStats := &combat.PlayerStats{}

	matchState := combat.NewMatchState("match123", "creator1", "opponent1", creatorStats, opponentStats)

	assert.Equal(t, "match123", matchState.MatchID, "MatchID should match")
	assert.Equal(t, "creator1", matchState.CreatorID, "CreatorID should match")
	assert.Equal(t, "opponent1", matchState.OpponentID, "OpponentID should match")
	assert.Equal(t, combat.MatchStatusActive, matchState.Status, "Status should be active")
	assert.Equal(t, 100, matchState.CreatorHealth, "Creator health should be 100")
	assert.Equal(t, 100, matchState.OpponentHealth, "Opponent health should be 100")
	assert.Equal(t, 1, matchState.Turn, "Turn should be 1")
}

// TestMatchStateIsTurnTimeout verifies turn timeout detection.
// Uses testify assertions for time-based validation.
func TestMatchStateIsTurnTimeout(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	// Should not timeout immediately
	assert.False(t, matchState.IsTurnTimeout(), "Should not timeout immediately")

	// Simulate timeout by setting old timestamp
	matchState.LastTurnTimestamp = time.Now().UnixMilli() - 120000 // 2 minutes ago
	assert.True(t, matchState.IsTurnTimeout(), "Should timeout after 2 minutes")
}

// TestMatchStateHandleTurnTimeout verifies turn timeout handling.
// Uses testify assertions for state transition validation.
func TestMatchStateHandleTurnTimeout(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	// First timeout should not forfeit
	forfeited := matchState.HandleTurnTimeout()
	assert.False(t, forfeited, "Should not forfeit on first timeout")
	assert.Equal(t, 1, matchState.ConsecutiveTimeouts, "Should have 1 consecutive timeout")

	// Second timeout should forfeit
	forfeited = matchState.HandleTurnTimeout()
	assert.True(t, forfeited, "Should forfeit on second timeout")
	assert.Equal(t, combat.MatchStatusCompleted, matchState.Status, "Status should be completed")
}

// TestMatchStateGetActivePlayer verifies active player detection.
// Uses testify assertions for turn-based validation.
func TestMatchStateGetActivePlayer(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	assert.Equal(t, "creator1", matchState.GetActivePlayer(), "Creator should be active first")

	// Simulate turn switch
	matchState.CurrentTurnUserID = "opponent1"
	assert.Equal(t, "opponent1", matchState.GetActivePlayer(), "Opponent should be active after switch")
}

// TestMatchStateGetHealth verifies health retrieval for players.
// Uses testify assertions for player-specific health validation.
func TestMatchStateGetHealth(t *testing.T) {
	matchState := combat.NewMatchState("match123", "creator1", "opponent1",
		&combat.PlayerStats{}, &combat.PlayerStats{})

	matchState.CreatorHealth = 80
	matchState.OpponentHealth = 60

	assert.Equal(t, 80, matchState.GetHealth("creator1"), "Creator health should be 80")
	assert.Equal(t, 60, matchState.GetHealth("opponent1"), "Opponent health should be 60")
}

// TestCombatResult verifies combat result JSON serialization.
// Uses testify assertions for JSON validation.
func TestCombatResult(t *testing.T) {
	result := &combat.CombatResult{
		Success:     true,
		Hit:         true,
		Damage:      25,
		IsCrit:      true,
		MatchStatus: combat.MatchStatusActive,
	}

	jsonStr, err := result.ToJSON()
	assert.NoError(t, err, "Should marshal to JSON")
	assert.True(t, len(jsonStr) > 0, "JSON should not be empty")
}

// TestProcessCombatAction verifies combat action processing.
// Uses testify assertions for combat result validation.
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

	assert.NoError(t, err, "Should process combat action")
	assert.True(t, result.Success, "Result should be successful")
	assert.True(t, result.MatchStatus == combat.MatchStatusActive ||
		result.MatchStatus == combat.MatchStatusCompleted, "Match should be active or completed")
}
