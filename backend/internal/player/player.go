// Package player provides player stats and progression management for the Armored Archer backend.
package player

import (
	"encoding/json"
	"errors"
	"fmt"
)

// PlayerStats represents player statistics and progression.
type PlayerStats struct {
	UserID         string `json:"user_id"`
	Level          int    `json:"level"`
	XP             int    `json:"xp"`
	AbilityPoints  int    `json:"ability_points"`
	BossesDefeated int    `json:"bosses_defeated"`
	Stats          struct {
		Attack   int `json:"attack"`
		Defense  int `json:"defense"`
		Dodge    int `json:"dodge"`
		CritRate int `json:"crit_rate"`
	} `json:"stats"`
}

// DefaultPlayerStats creates a new player stats with default values.
func DefaultPlayerStats(userID string) *PlayerStats {
	return &PlayerStats{
		UserID:         userID,
		Level:          1,
		XP:             0,
		AbilityPoints:  0,
		BossesDefeated: 0,
		Stats: struct {
			Attack   int `json:"attack"`
			Defense  int `json:"defense"`
			Dodge    int `json:"dodge"`
			CritRate int `json:"crit_rate"`
		}{
			Attack:   10,
			Defense:  10,
			Dodge:    10,
			CritRate: 5,
		},
	}
}

// XPRequiredForLevel calculates XP required to reach a level.
func XPRequiredForLevel(level int) int {
	// Simple linear progression: 100 XP per level
	return level * 100
}

// AddXP adds XP to player stats and handles level ups.
func AddXP(stats *PlayerStats, xpAmount int, source string) (levelUp bool, newXp int) {
	if stats == nil {
		return false, 0
	}

	oldLevel := stats.Level
	stats.XP += xpAmount

	// Check for level ups
	for stats.XP >= XPRequiredForLevel(stats.Level) {
		stats.XP -= XPRequiredForLevel(stats.Level)
		stats.Level++
		stats.AbilityPoints += 3 // Grant 3 ability points per level
		levelUp = true
	}

	return levelUp || stats.Level > oldLevel, stats.XP
}

// AllocateStat allocates ability points to a stat.
func AllocateStat(stats *PlayerStats, statName string, points int) error {
	if stats == nil {
		return errors.New("player stats is nil")
	}

	if points <= 0 {
		return errors.New("points must be positive")
	}

	if points > stats.AbilityPoints {
		return errors.New("insufficient ability points")
	}

	// Allocate to the specified stat
	switch statName {
	case "attack":
		stats.Stats.Attack += points
	case "defense":
		stats.Stats.Defense += points
	case "dodge":
		stats.Stats.Dodge += points
	case "crit_rate":
		stats.Stats.CritRate += points
	default:
		return errors.New("invalid stat name: must be attack, defense, dodge, or crit_rate")
	}

	stats.AbilityPoints -= points
	return nil
}

// GetStatValue returns the value of a specific stat.
func (p *PlayerStats) GetStatValue(statName string) (int, error) {
	switch statName {
	case "attack":
		return p.Stats.Attack, nil
	case "defense":
		return p.Stats.Defense, nil
	case "dodge":
		return p.Stats.Dodge, nil
	case "crit_rate":
		return p.Stats.CritRate, nil
	default:
		return 0, errors.New("invalid stat name")
	}
}

// ToMap converts player stats to a map for JSON serialization.
func (p *PlayerStats) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"user_id":          p.UserID,
		"level":            p.Level,
		"xp":               p.XP,
		"ability_points":   p.AbilityPoints,
		"bosses_defeated":  p.BossesDefeated,
		"stats": map[string]interface{}{
			"attack":    p.Stats.Attack,
			"defense":   p.Stats.Defense,
			"dodge":     p.Stats.Dodge,
			"crit_rate": p.Stats.CritRate,
		},
	}
}

// FromMap creates player stats from a map.
func FromMap(data map[string]interface{}) (*PlayerStats, error) {
	stats := &PlayerStats{}

	if userID, ok := data["user_id"].(string); ok {
		stats.UserID = userID
	}

	// Handle both int and float64 for numeric fields
	if level, ok := data["level"].(int); ok {
		stats.Level = level
	} else if level, ok := data["level"].(float64); ok {
		stats.Level = int(level)
	}

	if xp, ok := data["xp"].(int); ok {
		stats.XP = xp
	} else if xp, ok := data["xp"].(float64); ok {
		stats.XP = int(xp)
	}

	if abilityPoints, ok := data["ability_points"].(int); ok {
		stats.AbilityPoints = abilityPoints
	} else if abilityPoints, ok := data["ability_points"].(float64); ok {
		stats.AbilityPoints = int(abilityPoints)
	}

	if bossesDefeated, ok := data["bosses_defeated"].(int); ok {
		stats.BossesDefeated = bossesDefeated
	} else if bossesDefeated, ok := data["bosses_defeated"].(float64); ok {
		stats.BossesDefeated = int(bossesDefeated)
	}

	if statsData, ok := data["stats"].(map[string]interface{}); ok {
		if attack, ok := statsData["attack"].(int); ok {
			stats.Stats.Attack = attack
		} else if attack, ok := statsData["attack"].(float64); ok {
			stats.Stats.Attack = int(attack)
		}

		if defense, ok := statsData["defense"].(int); ok {
			stats.Stats.Defense = defense
		} else if defense, ok := statsData["defense"].(float64); ok {
			stats.Stats.Defense = int(defense)
		}

		if dodge, ok := statsData["dodge"].(int); ok {
			stats.Stats.Dodge = dodge
		} else if dodge, ok := statsData["dodge"].(float64); ok {
			stats.Stats.Dodge = int(dodge)
		}

		if critRate, ok := statsData["crit_rate"].(int); ok {
			stats.Stats.CritRate = critRate
		} else if critRate, ok := statsData["crit_rate"].(float64); ok {
			stats.Stats.CritRate = int(critRate)
		}
	}

	return stats, nil
}

// FromJSON creates player stats from JSON.
func FromJSON(jsonStr string) (*PlayerStats, error) {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, fmt.Errorf("failed to parse player stats JSON: %w", err)
	}
	return FromMap(data)
}

// ToJSON converts player stats to JSON string.
func (p *PlayerStats) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(p.ToMap())
	if err != nil {
		return "", fmt.Errorf("failed to marshal player stats: %w", err)
	}
	return string(jsonBytes), nil
}

// RecordBossDefeated increments the bosses defeated counter.
func (p *PlayerStats) RecordBossDefeated() {
	p.BossesDefeated++
}

// ValidatePlayerLevel validates that a player meets a minimum level requirement.
func ValidatePlayerLevel(stats *PlayerStats, minLevel int) error {
	if stats.Level < minLevel {
		return fmt.Errorf("level %d required, current level %d", minLevel, stats.Level)
	}
	return nil
}

// GetTotalStats returns the sum of all stat values.
func (p *PlayerStats) GetTotalStats() int {
	return p.Stats.Attack + p.Stats.Defense + p.Stats.Dodge + p.Stats.CritRate
}

// Validate validates player stats.
func (p *PlayerStats) Validate() error {
	if p.UserID == "" {
		return errors.New("user_id is required")
	}
	if p.Level < 1 {
		return errors.New("level must be at least 1")
	}
	if p.XP < 0 {
		return errors.New("xp cannot be negative")
	}
	if p.AbilityPoints < 0 {
		return errors.New("ability_points cannot be negative")
	}
	if p.Stats.Attack < 0 || p.Stats.Defense < 0 || p.Stats.Dodge < 0 || p.Stats.CritRate < 0 {
		return errors.New("stats cannot be negative")
	}
	return nil
}
