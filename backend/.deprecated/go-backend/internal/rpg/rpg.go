// Package rpg provides RPG progression system functionality for the Armored Archer backend.
package rpg

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"
)

// MaxLevel is the maximum player level.
const MaxLevel = 100

// BaseXP is the base XP required for level 1.
const BaseXP = 100

// XPScalingFactor is the factor by which XP requirements scale per level.
const XPScalingFactor = 1.5

// PointsPerLevel is the number of ability points granted per level.
const PointsPerLevel = 3

// MaxStatPointsPerLevel is the maximum stat points that can be allocated per level.
const MaxStatPointsPerLevel = 5

// Stat names
const (
	StatAttack   = "attack"
	StatDefense  = "defense"
	StatDodge    = "dodge"
	StatCritRate = "crit_rate"
)

// ValidStats is a list of valid stat names.
var ValidStats = []string{StatAttack, StatDefense, StatDodge, StatCritRate}

// PlayerStats represents player statistics and progression.
type PlayerStats struct {
	UserID        string `json:"user_id"`
	Level         int    `json:"level"`
	XP            int    `json:"xp"`
	AbilityPoints int    `json:"ability_points"`
	Stats         struct {
		Attack   int `json:"attack"`
		Defense  int `json:"defense"`
		Dodge    int `json:"dodge"`
		CritRate int `json:"crit_rate"`
	} `json:"stats"`
}

// XPGainRequest represents a request to gain XP.
type XPGainRequest struct {
	XPAmount int    `json:"xp_amount"`
	Source   string `json:"source"` // "pve" or "pvp"
}

// StatAllocationRequest represents a request to allocate stat points.
type StatAllocationRequest struct {
	StatName string `json:"stat_name"`
	Points   int    `json:"points"`
}

// GainXPResult represents the result of gaining XP.
type GainXPResult struct {
	Success      bool         `json:"success"`
	PlayerStats  *PlayerStats `json:"player_stats"`
	XPGained     int          `json:"xp_gained"`
	LevelsGained int          `json:"levels_gained"`
	NewLevel     int          `json:"new_level"`
}

// StatAllocationResult represents the result of allocating stats.
type StatAllocationResult struct {
	Success        bool         `json:"success"`
	PlayerStats    *PlayerStats `json:"player_stats"`
	StatAllocated  string       `json:"stat_allocated"`
	PointsAllocated int         `json:"points_allocated"`
	RemainingPoints int         `json:"remaining_points"`
}

// NewPlayerStats creates a new player stats with default values.
func NewPlayerStats(userID string) *PlayerStats {
	return &PlayerStats{
		UserID:        userID,
		Level:         1,
		XP:            0,
		AbilityPoints: 0,
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

// CalculateLevel calculates the player level from total XP.
func CalculateLevel(totalXP int) int {
	// Formula: level = floor(sqrt(totalXP / baseXP))
	// This creates a curve where each level requires more XP
	level := int(math.Floor(math.Sqrt(float64(totalXP) / BaseXP)))
	if level < 1 {
		level = 1
	}
	if level > MaxLevel {
		level = MaxLevel
	}
	return level
}

// XPRequiredForLevel calculates the total XP required to reach a specific level.
func XPRequiredForLevel(level int) int {
	// Formula: XP = baseXP * level^2
	return int(BaseXP * math.Pow(float64(level), 2))
}

// XPRequiredForNextLevel calculates XP required to go from current level to next level.
func XPRequiredForNextLevel(currentLevel int) int {
	return XPRequiredForLevel(currentLevel + 1) - XPRequiredForLevel(currentLevel)
}

// AddXP adds XP to player stats and handles level ups.
func (p *PlayerStats) AddXP(xpAmount int, source string) (levelsGained int, newLevel int) {
	if p == nil {
		return 0, 0
	}

	oldLevel := p.Level
	p.XP += xpAmount

	// Calculate new level
	newLevel = CalculateLevel(p.XP)

	// Grant ability points for each level gained
	levelsGained = newLevel - oldLevel
	if levelsGained > 0 {
		p.AbilityPoints += levelsGained * PointsPerLevel
		p.Level = newLevel
	}

	return levelsGained, newLevel
}

// AllocateStat allocates ability points to a stat.
func (p *PlayerStats) AllocateStat(statName string, points int) error {
	if p == nil {
		return errors.New("player stats is nil")
	}

	if points <= 0 {
		return errors.New("points must be positive")
	}

	if points > p.AbilityPoints {
		return fmt.Errorf("insufficient ability points: have %d, need %d", p.AbilityPoints, points)
	}

	if points > MaxStatPointsPerLevel {
		return fmt.Errorf("cannot allocate more than %d points at once", MaxStatPointsPerLevel)
	}

	// Validate stat name
	valid := false
	for _, s := range ValidStats {
		if s == statName {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid stat name: %s (must be one of: %v)", statName, ValidStats)
	}

	// Allocate to the specified stat
	switch statName {
	case StatAttack:
		p.Stats.Attack += points
	case StatDefense:
		p.Stats.Defense += points
	case StatDodge:
		p.Stats.Dodge += points
	case StatCritRate:
		p.Stats.CritRate += points
	}

	p.AbilityPoints -= points
	return nil
}

// GetStatValue returns the value of a specific stat.
func (p *PlayerStats) GetStatValue(statName string) (int, error) {
	switch statName {
	case StatAttack:
		return p.Stats.Attack, nil
	case StatDefense:
		return p.Stats.Defense, nil
	case StatDodge:
		return p.Stats.Dodge, nil
	case StatCritRate:
		return p.Stats.CritRate, nil
	default:
		return 0, fmt.Errorf("invalid stat name: %s", statName)
	}
}

// GetTotalStats returns the sum of all stat values.
func (p *PlayerStats) GetTotalStats() int {
	return p.Stats.Attack + p.Stats.Defense + p.Stats.Dodge + p.Stats.CritRate
}

// ToMap converts player stats to a map for JSON serialization.
func (p *PlayerStats) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"user_id":          p.UserID,
		"level":            p.Level,
		"xp":               p.XP,
		"ability_points":   p.AbilityPoints,
		"stats": map[string]int{
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

	if level, ok := data["level"].(float64); ok {
		stats.Level = int(level)
	}

	if xp, ok := data["xp"].(float64); ok {
		stats.XP = int(xp)
	}

	if abilityPoints, ok := data["ability_points"].(float64); ok {
		stats.AbilityPoints = int(abilityPoints)
	}

	if statsData, ok := data["stats"].(map[string]interface{}); ok {
		if attack, ok := statsData["attack"].(float64); ok {
			stats.Stats.Attack = int(attack)
		}
		if defense, ok := statsData["defense"].(float64); ok {
			stats.Stats.Defense = int(defense)
		}
		if dodge, ok := statsData["dodge"].(float64); ok {
			stats.Stats.Dodge = int(dodge)
		}
		if critRate, ok := statsData["crit_rate"].(float64); ok {
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

// Validate validates player stats.
func (p *PlayerStats) Validate() error {
	if p.UserID == "" {
		return errors.New("user_id is required")
	}
	if p.Level < 1 || p.Level > MaxLevel {
		return fmt.Errorf("level must be between 1 and %d", MaxLevel)
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

// Validate validates an XP gain request.
func (r *XPGainRequest) Validate() error {
	if r.XPAmount <= 0 {
		return errors.New("xp_amount must be positive")
	}
	if r.Source != "pve" && r.Source != "pvp" {
		return errors.New("source must be 'pve' or 'pvp'")
	}
	// Sanity check for XP amount (prevent exploitation)
	if r.XPAmount > 10000 {
		return errors.New("xp_amount exceeds maximum allowed")
	}
	return nil
}

// Validate validates a stat allocation request.
func (r *StatAllocationRequest) Validate() error {
	if r.StatName == "" {
		return errors.New("stat_name is required")
	}
	if r.Points <= 0 {
		return errors.New("points must be positive")
	}
	if r.Points > MaxStatPointsPerLevel {
		return fmt.Errorf("cannot allocate more than %d points at once", MaxStatPointsPerLevel)
	}
	
	valid := false
	for _, s := range ValidStats {
		if s == r.StatName {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid stat_name: must be one of %v", ValidStats)
	}
	return nil
}

// GetProgressToNextLevel calculates the progress percentage to the next level.
func (p *PlayerStats) GetProgressToNextLevel() float64 {
	if p.Level >= MaxLevel {
		return 100.0
	}

	currentLevelXP := XPRequiredForLevel(p.Level)
	nextLevelXP := XPRequiredForLevel(p.Level + 1)
	
	progress := float64(p.XP - currentLevelXP) / float64(nextLevelXP - currentLevelXP) * 100
	if progress > 100 {
		progress = 100
	}
	if progress < 0 {
		progress = 0
	}
	
	return progress
}

// IsMaxLevel checks if the player is at max level.
func (p *PlayerStats) IsMaxLevel() bool {
	return p.Level >= MaxLevel
}

// GetStatDescription returns a description of a stat.
func GetStatDescription(statName string) string {
	switch statName {
	case StatAttack:
		return "Increases damage dealt"
	case StatDefense:
		return "Reduces damage taken"
	case StatDodge:
		return "Chance to avoid attacks"
	case StatCritRate:
		return "Chance for critical hits"
	default:
		return "Unknown stat"
	}
}

// GetStatLimits returns the soft cap for each stat.
func GetStatLimits() map[string]int {
	return map[string]int{
		StatAttack:   1000,
		StatDefense:  1000,
		StatDodge:    500,
		StatCritRate: 100, // Percentage
	}
}

// ValidateStatAllocation validates if a stat allocation is within limits.
func ValidateStatAllocation(currentValue, newValue int, statName string) error {
	limits := GetStatLimits()
	if limit, ok := limits[statName]; ok {
		if newValue > limit {
			return fmt.Errorf("%s exceeds soft cap of %d", statName, limit)
		}
	}
	return nil
}

// PlayerStatsToJSON converts a slice of player stats to JSON.
func PlayerStatsToJSON(stats []*PlayerStats) (string, error) {
	jsonBytes, err := json.Marshal(stats)
	if err != nil {
		return "", fmt.Errorf("failed to marshal player stats: %w", err)
	}
	return string(jsonBytes), nil
}

// GainXPResultToJSON converts a gain XP result to JSON.
func GainXPResultToJSON(result *GainXPResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gain XP result: %w", err)
	}
	return string(jsonBytes), nil
}

// StatAllocationResultToJSON converts a stat allocation result to JSON.
func StatAllocationResultToJSON(result *StatAllocationResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal stat allocation result: %w", err)
	}
	return string(jsonBytes), nil
}

// GenerateProgressionReport generates a progression report for a player.
func GenerateProgressionReport(stats *PlayerStats) map[string]interface{} {
	return map[string]interface{}{
		"user_id":           stats.UserID,
		"level":             stats.Level,
		"xp":                stats.XP,
		"xp_to_next_level":  XPRequiredForNextLevel(stats.Level),
		"progress_percent":  stats.GetProgressToNextLevel(),
		"ability_points":    stats.AbilityPoints,
		"total_stats":       stats.GetTotalStats(),
		"stats":             stats.Stats,
		"is_max_level":      stats.IsMaxLevel(),
		"stat_descriptions": map[string]string{
			StatAttack:   GetStatDescription(StatAttack),
			StatDefense:  GetStatDescription(StatDefense),
			StatDodge:    GetStatDescription(StatDodge),
			StatCritRate: GetStatDescription(StatCritRate),
		},
		"stat_limits": GetStatLimits(),
		"timestamp":   time.Now().UnixMilli(),
	}
}
