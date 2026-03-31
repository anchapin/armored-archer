// Package combat provides combat system functionality for the Armored Archer backend.
package combat

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"
)

// Match status constants
const (
	MatchStatusWaiting   = "waiting"
	MatchStatusActive    = "active"
	MatchStatusCompleted = "completed"
	MatchStatusAbandoned = "abandoned"
)

// Combat action types
const (
	ActionShoot = "shoot"
)

// MatchInactivityTimeoutMs is the timeout for match inactivity (2 minutes)
const MatchInactivityTimeoutMs = 2 * 60 * 1000

// MaxConsecutiveTimeouts is the maximum consecutive turn timeouts before forfeit
const MaxConsecutiveTimeouts = 2

// CombatAction represents a combat action request.
type CombatAction struct {
	MatchID     string  `json:"match_id"`
	ActionType  string  `json:"action_type"`
	Angle       float64 `json:"angle"`
	Power       float64 `json:"power,omitempty"`
	RequestID   string  `json:"requestId,omitempty"`
	Timestamp   int64   `json:"timestamp,omitempty"`
	Signature   string  `json:"signature,omitempty"`
	Nonce       string  `json:"nonce,omitempty"`
}

// CombatResult represents the result of a combat action.
type CombatResult struct {
	Success        bool         `json:"success"`
	Hit            bool         `json:"hit"`
	Damage         int          `json:"damage"`
	IsCrit         bool         `json:"is_crit"`
	AttackerStats  *PlayerStats `json:"attacker_stats"`
	DefenderStats  *PlayerStats `json:"defender_stats"`
	MatchStatus    string       `json:"match_status"`
	Winner         string       `json:"winner,omitempty"`
}

// PlayerStats represents player combat statistics.
type PlayerStats struct {
	Level int `json:"level"`
	XP    int `json:"xp"`
	Stats struct {
		Attack   int `json:"attack"`
		Defense  int `json:"defense"`
		Dodge    int `json:"dodge"`
		CritRate int `json:"crit_rate"`
	} `json:"stats"`
}

// MatchState represents the current state of a PvP match.
type MatchState struct {
	MatchID            string         `json:"match_id"`
	Turn               int            `json:"turn"`
	CurrentTurnUserID  string         `json:"current_turn_user_id"`
	CreatorID          string         `json:"creator_id"`
	OpponentID         string         `json:"opponent_id"`
	CreatorHealth      int            `json:"creator_health"`
	OpponentHealth     int            `json:"opponent_health"`
	CreatorStats       *PlayerStats   `json:"creator_stats"`
	OpponentStats      *PlayerStats   `json:"opponent_stats"`
	Status             string         `json:"status"`
	Winner             string         `json:"winner,omitempty"`
	Log                []CombatLogEntry `json:"log"`
	LastTurnTimestamp  int64          `json:"last_turn_timestamp"`
	TurnTimeoutMs      int64          `json:"turn_timeout_ms"`
	ConsecutiveTimeouts int           `json:"consecutive_timeouts"`
	ForfeitReason      string         `json:"forfeit_reason,omitempty"`
}

// CombatLogEntry represents a combat log entry.
type CombatLogEntry struct {
	Turn        int    `json:"turn"`
	AttackerID  string `json:"attacker_id"`
	Action      string `json:"action"`
	Hit         bool   `json:"hit"`
	Damage      int    `json:"damage"`
	IsCrit      bool   `json:"is_crit"`
	Timestamp   int64  `json:"timestamp"`
}

// NewMatchState creates a new match state.
func NewMatchState(matchID, creatorID, opponentID string, creatorStats, opponentStats *PlayerStats) *MatchState {
	return &MatchState{
		MatchID:           matchID,
		Turn:              1,
		CurrentTurnUserID: creatorID,
		CreatorID:         creatorID,
		OpponentID:        opponentID,
		CreatorHealth:     100,
		OpponentHealth:    100,
		CreatorStats:      creatorStats,
		OpponentStats:     opponentStats,
		Status:            MatchStatusActive,
		Log:               make([]CombatLogEntry, 0),
		LastTurnTimestamp: time.Now().UnixMilli(),
		TurnTimeoutMs:     60000, // 60 seconds per turn
		ConsecutiveTimeouts: 0,
	}
}

// CalculateHitChance calculates the hit chance based on angle and dodge.
func CalculateHitChance(angle float64, dodge int) float64 {
	// Normalize angle to 0-1 range
	normalizedAngle := angle / (2 * 3.14159)
	if normalizedAngle > 1 {
		normalizedAngle = normalizedAngle - float64(int(normalizedAngle))
	}

	// Base hit chance is 70%
	baseHitChance := 0.70

	// Dodge reduces hit chance (each point of dodge reduces by 0.5%)
	dodgeReduction := float64(dodge) * 0.005

	hitChance := baseHitChance - dodgeReduction
	if hitChance < 0.1 {
		hitChance = 0.1 // Minimum 10% hit chance
	}
	if hitChance > 0.95 {
		hitChance = 0.95 // Maximum 95% hit chance
	}

	return hitChance
}

// IsHit determines if an attack hits based on hit chance.
func IsHit(angle float64, dodge int) bool {
	hitChance := CalculateHitChance(angle, dodge)
	roll := rand.Float64()
	return roll <= hitChance
}

// CalculateDamage calculates damage dealt based on attacker and defender stats.
func CalculateDamage(attackerStats, defenderStats *PlayerStats) int {
	if attackerStats == nil || defenderStats == nil {
		return 0
	}

	baseDamage := 10 + float64(attackerStats.Stats.Attack)*0.5
	defenseReduction := float64(defenderStats.Stats.Defense)*0.3
	finalDamage := baseDamage - defenseReduction

	if finalDamage < 1 {
		finalDamage = 1
	}

	return int(finalDamage)
}

// CalculateCrit determines if an attack is a critical hit.
func CalculateCrit(critRate int) bool {
	critChance := float64(critRate) / 100.0
	roll := rand.Float64()
	return roll <= critChance
}

// ProcessCombatAction processes a combat action and returns the result.
func ProcessCombatAction(matchState *MatchState, action *CombatAction, attackerStats, defenderStats *PlayerStats) (*CombatResult, error) {
	if matchState.Status != MatchStatusActive {
		return nil, fmt.Errorf("match is not active (status: %s)", matchState.Status)
	}

	// Validate action
	if err := action.Validate(); err != nil {
		return nil, err
	}

	// Determine if hit
	hit := IsHit(action.Angle, defenderStats.Stats.Dodge)

	// Calculate damage
	damage := 0
	if hit {
		damage = CalculateDamage(attackerStats, defenderStats)
	}

	// Check for critical hit
	isCrit := false
	if hit {
		isCrit = CalculateCrit(attackerStats.Stats.CritRate)
		if isCrit {
			damage = damage * 2 // Critical hits deal double damage
		}
	}

	// Apply damage to defender
	if matchState.CurrentTurnUserID == matchState.CreatorID {
		matchState.OpponentHealth -= damage
		if matchState.OpponentHealth < 0 {
			matchState.OpponentHealth = 0
		}
	} else {
		matchState.CreatorHealth -= damage
		if matchState.CreatorHealth < 0 {
			matchState.CreatorHealth = 0
		}
	}

	// Create combat log entry
	logEntry := CombatLogEntry{
		Turn:       matchState.Turn,
		AttackerID: matchState.CurrentTurnUserID,
		Action:     action.ActionType,
		Hit:        hit,
		Damage:     damage,
		IsCrit:     isCrit,
		Timestamp:  time.Now().UnixMilli(),
	}
	matchState.Log = append(matchState.Log, logEntry)

	// Check for match completion
	var winner string
	if matchState.OpponentHealth <= 0 || matchState.CreatorHealth <= 0 {
		matchState.Status = MatchStatusCompleted
		if matchState.OpponentHealth <= 0 {
			winner = matchState.CreatorID
		} else {
			winner = matchState.OpponentID
		}
		matchState.Winner = winner
	} else {
		// Switch turns
		if matchState.CurrentTurnUserID == matchState.CreatorID {
			matchState.CurrentTurnUserID = matchState.OpponentID
		} else {
			matchState.CurrentTurnUserID = matchState.CreatorID
		}
		matchState.Turn++
	}

	matchState.LastTurnTimestamp = time.Now().UnixMilli()
	matchState.ConsecutiveTimeouts = 0

	// Create result
	result := &CombatResult{
		Success:       true,
		Hit:           hit,
		Damage:        damage,
		IsCrit:        isCrit,
		AttackerStats: attackerStats,
		DefenderStats: defenderStats,
		MatchStatus:   matchState.Status,
		Winner:        winner,
	}

	return result, nil
}

// Validate validates a combat action.
func (a *CombatAction) Validate() error {
	if a.MatchID == "" {
		return fmt.Errorf("match_id is required")
	}
	if a.ActionType != ActionShoot {
		return fmt.Errorf("invalid action_type: must be 'shoot'")
	}
	if a.Angle < 0 || a.Angle > 2*3.14159 {
		return fmt.Errorf("angle must be between 0 and 2π")
	}
	if a.Power < 0 || a.Power > 1 {
		return fmt.Errorf("power must be between 0.0 and 1.0")
	}
	return nil
}

// ToJSON converts a combat action to JSON string.
func (a *CombatAction) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(a)
	if err != nil {
		return "", fmt.Errorf("failed to marshal combat action: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a combat action from JSON.
func FromJSON(jsonStr string) (*CombatAction, error) {
	var action CombatAction
	if err := json.Unmarshal([]byte(jsonStr), &action); err != nil {
		return nil, fmt.Errorf("failed to parse combat action JSON: %w", err)
	}
	return &action, nil
}

// ToJSON converts a combat result to JSON string.
func (r *CombatResult) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("failed to marshal combat result: %w", err)
	}
	return string(jsonBytes), nil
}

// ToJSON converts a match state to JSON string.
func (m *MatchState) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match state: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a match state from JSON.
func MatchStateFromJSON(jsonStr string) (*MatchState, error) {
	var state MatchState
	if err := json.Unmarshal([]byte(jsonStr), &state); err != nil {
		return nil, fmt.Errorf("failed to parse match state JSON: %w", err)
	}
	return &state, nil
}

// IsTurnTimeout checks if the current turn has timed out.
func (m *MatchState) IsTurnTimeout() bool {
	elapsed := time.Now().UnixMilli() - m.LastTurnTimestamp
	return elapsed > m.TurnTimeoutMs
}

// HandleTurnTimeout handles a turn timeout.
func (m *MatchState) HandleTurnTimeout() (forfeited bool) {
	m.ConsecutiveTimeouts++

	if m.ConsecutiveTimeouts >= MaxConsecutiveTimeouts {
		// Player forfeits after max consecutive timeouts
		m.Status = MatchStatusCompleted
		m.ForfeitReason = "turn_timeout"
		if m.CurrentTurnUserID == m.CreatorID {
			m.Winner = m.OpponentID
		} else {
			m.Winner = m.CreatorID
		}
		return true
	}

	// Switch turns
	if m.CurrentTurnUserID == m.CreatorID {
		m.CurrentTurnUserID = m.OpponentID
	} else {
		m.CurrentTurnUserID = m.CreatorID
	}
	m.Turn++
	m.LastTurnTimestamp = time.Now().UnixMilli()

	return false
}

// GetActivePlayer returns the ID of the player whose turn it is.
func (m *MatchState) GetActivePlayer() string {
	return m.CurrentTurnUserID
}

// GetInactivePlayer returns the ID of the player whose turn it is not.
func (m *MatchState) GetInactivePlayer() string {
	if m.CurrentTurnUserID == m.CreatorID {
		return m.OpponentID
	}
	return m.CreatorID
}

// GetHealth returns the health of a player.
func (m *MatchState) GetHealth(playerID string) int {
	if playerID == m.CreatorID {
		return m.CreatorHealth
	}
	return m.OpponentHealth
}

// CombatResultsToJSON converts a slice of combat results to JSON.
func CombatResultsToJSON(results []*CombatResult) (string, error) {
	jsonBytes, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to marshal combat results: %w", err)
	}
	return string(jsonBytes), nil
}

// MatchStatesToJSON converts a slice of match states to JSON.
func MatchStatesToJSON(states []*MatchState) (string, error) {
	jsonBytes, err := json.Marshal(states)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match states: %w", err)
	}
	return string(jsonBytes), nil
}
