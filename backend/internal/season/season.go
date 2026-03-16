// Package season provides seasonal content and leaderboard functionality for the Armored Archer backend.
package season

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Season status constants
const (
	SeasonStatusActive = "active"
	SeasonStatusEnded  = "ended"
)

// Rank tier constants
const (
	RankTierLegendary = "legendary"
	RankTierEpic      = "epic"
	RankTierRare      = "rare"
	RankTierUncommon  = "uncommon"
	RankTierCommon    = "common"
)

// Default season duration (4 weeks in milliseconds)
const DefaultSeasonDurationWeeks = 4
const DefaultSeasonDurationMs = DefaultSeasonDurationWeeks * 7 * 24 * 60 * 60 * 1000

// Rank decay configuration
const RankDecayDays = 7           // Days of inactivity before decay starts
const RankDecayAmount = 25        // Points lost per decay period
const RankDecayMaxLoss = 100      // Maximum points that can be lost per decay
const RankDecayMinScore = 800     // Minimum score after decay
const RankDecayCheckMs = 24 * 60 * 60 * 1000 // Check every 24 hours

// SeasonRewards represents rewards for a season.
type SeasonRewards struct {
	RankTier string `json:"rank_tier"`
	Coins    int    `json:"coins"`
	Gems     int    `json:"gems"`
	Cosmetics *struct {
		Title string `json:"title"`
		Aura  string `json:"aura,omitempty"`
	} `json:"cosmetics,omitempty"`
}

// LeaderboardRecord represents a leaderboard record.
type LeaderboardRecord struct {
	OwnerID   string `json:"owner_id"`
	Username  string `json:"username"`
	Rank      int    `json:"rank"`
	Score     int    `json:"score"`
	Metadata  string `json:"metadata,omitempty"`
	Expiry    int64  `json:"expiry,omitempty"`
	MaxNumScore int  `json:"max_num_score,omitempty"`
	NumScore  int    `json:"num_score,omitempty"`
}

// SeasonInfo represents information about a season.
type SeasonInfo struct {
	SeasonID       string `json:"season_id"`
	SeasonNumber   int    `json:"season_number"`
	StartTime      int64  `json:"start_time"`
	EndTime        int64  `json:"end_time"`
	Status         string `json:"status"`
	DurationWeeks  int    `json:"duration_weeks"`
}

// LeaderboardEntry represents a player's entry in the leaderboard.
type LeaderboardEntry struct {
	OwnerID  string `json:"owner_id"`
	Username string `json:"username"`
	Rank     int    `json:"rank"`
	Score    int    `json:"score"`
	Meta     struct {
		Wins        int     `json:"wins"`
		Losses      int     `json:"losses"`
		WinRate     float64 `json:"win_rate"`
		PunchUpWins int     `json:"punch_up_wins"`
	} `json:"meta"`
}

// RankChange represents rank changes after a match.
type RankChange struct {
	WinnerID      string `json:"winner_id"`
	LoserID       string `json:"loser_id"`
	WinnerOldRank int    `json:"winner_old_rank"`
	LoserOldRank  int    `json:"loser_old_rank"`
	WinnerNewRank int    `json:"winner_new_rank"`
	LoserNewRank  int    `json:"loser_new_rank"`
	IsPunchUp     bool   `json:"is_punch_up"`
}

// GetSeasonInfoResult represents the result of getting season info.
type GetSeasonInfoResult struct {
	Success       bool         `json:"success"`
	Season        *SeasonInfo  `json:"season"`
	PlayerRank    *int         `json:"player_rank,omitempty"`
	PlayerScore   int          `json:"player_score"`
	TimeRemaining int64        `json:"time_remaining"`
}

// GetLeaderboardResult represents the result of getting a leaderboard.
type GetLeaderboardResult struct {
	Success bool               `json:"success"`
	Entries []*LeaderboardEntry `json:"entries"`
	Total   int                `json:"total"`
}

// SeasonRewardClaim represents a claimed season reward.
type SeasonRewardClaim struct {
	UserID      string `json:"user_id"`
	SeasonID    string `json:"season_id"`
	RankTier    string `json:"rank_tier"`
	ClaimedAt   int64  `json:"claimed_at"`
	Rewards     *SeasonRewards `json:"rewards"`
}

// NewSeasonInfo creates a new season info.
func NewSeasonInfo(seasonNumber int, startTime, endTime int64) *SeasonInfo {
	return &SeasonInfo{
		SeasonID:      fmt.Sprintf("season_%d", seasonNumber),
		SeasonNumber:  seasonNumber,
		StartTime:     startTime,
		EndTime:       endTime,
		Status:        SeasonStatusActive,
		DurationWeeks: DefaultSeasonDurationWeeks,
	}
}

// GetCurrentSeason returns the current season info.
func GetCurrentSeason() *SeasonInfo {
	// For simplicity, calculate current season based on epoch time
	// In production, this would read from a database or config
	seasonEpoch := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	now := time.Now().UnixMilli()
	
	seasonNumber := int((now - seasonEpoch) / DefaultSeasonDurationMs) + 1
	seasonStart := seasonEpoch + int64(seasonNumber-1)*DefaultSeasonDurationMs
	seasonEnd := seasonStart + DefaultSeasonDurationMs
	
	status := SeasonStatusActive
	if now > seasonEnd {
		status = SeasonStatusEnded
	}
	
	return &SeasonInfo{
		SeasonID:      fmt.Sprintf("season_%d", seasonNumber),
		SeasonNumber:  seasonNumber,
		StartTime:     seasonStart,
		EndTime:       seasonEnd,
		Status:        status,
		DurationWeeks: DefaultSeasonDurationWeeks,
	}
}

// GetTimeRemaining returns the time remaining in the season.
func (s *SeasonInfo) GetTimeRemaining() int64 {
	now := time.Now().UnixMilli()
	remaining := s.EndTime - now
	if remaining < 0 {
		remaining = 0
	}
	return remaining
}

// IsExpired checks if the season has ended.
func (s *SeasonInfo) IsExpired() bool {
	return time.Now().UnixMilli() > s.EndTime
}

// GetRankTier returns the rank tier for a given score.
func GetRankTier(score int) string {
	switch {
	case score >= 2000:
		return RankTierLegendary
	case score >= 1800:
		return RankTierEpic
	case score >= 1600:
		return RankTierRare
	case score >= 1400:
		return RankTierUncommon
	default:
		return RankTierCommon
	}
}

// GetRewardsForTier returns the rewards for a rank tier.
func GetRewardsForTier(tier string) *SeasonRewards {
	rewards := &SeasonRewards{
		RankTier: tier,
	}
	
	switch tier {
	case RankTierLegendary:
		rewards.Coins = 10000
		rewards.Gems = 500
		rewards.Cosmetics = &struct {
			Title string `json:"title"`
			Aura  string `json:"aura,omitempty"`
		}{
			Title: "Legendary Archer",
			Aura:  "golden",
		}
	case RankTierEpic:
		rewards.Coins = 5000
		rewards.Gems = 250
		rewards.Cosmetics = &struct {
			Title string `json:"title"`
			Aura  string `json:"aura,omitempty"`
		}{
			Title: "Epic Archer",
			Aura:  "purple",
		}
	case RankTierRare:
		rewards.Coins = 2500
		rewards.Gems = 100
	case RankTierUncommon:
		rewards.Coins = 1000
		rewards.Gems = 50
	case RankTierCommon:
		rewards.Coins = 500
		rewards.Gems = 25
	}
	
	return rewards
}

// CalculateSeasonRewards calculates rewards for a player based on their rank.
func CalculateSeasonRewards(rank int, score int) *SeasonRewards {
	tier := GetRankTier(score)
	return GetRewardsForTier(tier)
}

// ApplyRankDecay applies rank decay to a player's score.
func ApplyRankDecay(currentScore int, daysInactive int) int {
	if daysInactive < RankDecayDays {
		return currentScore // No decay yet
	}
	
	decayPeriods := daysInactive / RankDecayDays
	totalDecay := decayPeriods * RankDecayAmount
	
	if totalDecay > RankDecayMaxLoss {
		totalDecay = RankDecayMaxLoss
	}
	
	newScore := currentScore - totalDecay
	if newScore < RankDecayMinScore {
		newScore = RankDecayMinScore
	}
	
	return newScore
}

// GetDaysInactive calculates days since last activity.
func GetDaysInactive(lastActiveMs int64) int {
	now := time.Now().UnixMilli()
	diffMs := now - lastActiveMs
	return int(diffMs / (24 * 60 * 60 * 1000))
}

// ToJSON converts season info to JSON string.
func (s *SeasonInfo) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(s)
	if err != nil {
		return "", fmt.Errorf("failed to marshal season info: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates season info from JSON.
func SeasonInfoFromJSON(jsonStr string) (*SeasonInfo, error) {
	var info SeasonInfo
	if err := json.Unmarshal([]byte(jsonStr), &info); err != nil {
		return nil, fmt.Errorf("failed to parse season info JSON: %w", err)
	}
	return &info, nil
}

// ToJSON converts a leaderboard entry to JSON string.
func (e *LeaderboardEntry) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal leaderboard entry: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a leaderboard entry from JSON.
func LeaderboardEntryFromJSON(jsonStr string) (*LeaderboardEntry, error) {
	var entry LeaderboardEntry
	if err := json.Unmarshal([]byte(jsonStr), &entry); err != nil {
		return nil, fmt.Errorf("failed to parse leaderboard entry JSON: %w", err)
	}
	return &entry, nil
}

// ToJSON converts season rewards to JSON string.
func (r *SeasonRewards) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("failed to marshal season rewards: %w", err)
	}
	return string(jsonBytes), nil
}

// LeaderboardEntriesToJSON converts a slice of leaderboard entries to JSON.
func LeaderboardEntriesToJSON(entries []*LeaderboardEntry) (string, error) {
	jsonBytes, err := json.Marshal(entries)
	if err != nil {
		return "", fmt.Errorf("failed to marshal leaderboard entries: %w", err)
	}
	return string(jsonBytes), nil
}

// SeasonInfosToJSON converts a slice of season infos to JSON.
func SeasonInfosToJSON(infos []*SeasonInfo) (string, error) {
	jsonBytes, err := json.Marshal(infos)
	if err != nil {
		return "", fmt.Errorf("failed to marshal season infos: %w", err)
	}
	return string(jsonBytes), nil
}

// GetSeasonInfoResultToJSON converts a get season info result to JSON.
func GetSeasonInfoResultToJSON(result *GetSeasonInfoResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal season info result: %w", err)
	}
	return string(jsonBytes), nil
}

// GetLeaderboardResultToJSON converts a get leaderboard result to JSON.
func GetLeaderboardResultToJSON(result *GetLeaderboardResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal leaderboard result: %w", err)
	}
	return string(jsonBytes), nil
}

// Validate validates a season info.
func (s *SeasonInfo) Validate() error {
	if s.SeasonID == "" {
		return errors.New("season_id is required")
	}
	if s.StartTime >= s.EndTime {
		return errors.New("start_time must be before end_time")
	}
	if s.Status != SeasonStatusActive && s.Status != SeasonStatusEnded {
		return errors.New("invalid status")
	}
	return nil
}

// GetSeasonNumberFromID extracts the season number from a season ID.
func GetSeasonNumberFromID(seasonID string) (int, error) {
	var num int
	_, err := fmt.Sscanf(seasonID, "season_%d", &num)
	if err != nil {
		return 0, fmt.Errorf("invalid season ID format: %w", err)
	}
	return num, nil
}

// GenerateSeasonID generates a season ID from a season number.
func GenerateSeasonID(seasonNumber int) string {
	return fmt.Sprintf("season_%d", seasonNumber)
}

// GetNextSeason returns the next season info.
func GetNextSeason(current *SeasonInfo) *SeasonInfo {
	return NewSeasonInfo(
		current.SeasonNumber + 1,
		current.EndTime,
		current.EndTime + DefaultSeasonDurationMs,
	)
}

// GetPreviousSeason returns the previous season info.
func GetPreviousSeason(current *SeasonInfo) *SeasonInfo {
	if current.SeasonNumber <= 1 {
		return nil // No previous season
	}
	
	prevStart := current.StartTime - DefaultSeasonDurationMs
	prevEnd := current.StartTime
	
	return NewSeasonInfo(current.SeasonNumber - 1, prevStart, prevEnd)
}

// IsSeasonActive checks if a season is currently active.
func IsSeasonActive(season *SeasonInfo) bool {
	now := time.Now().UnixMilli()
	return season.Status == SeasonStatusActive && now >= season.StartTime && now < season.EndTime
}

// GetWinRate calculates win rate from wins and losses.
func GetWinRate(wins, losses int) float64 {
	if wins+losses == 0 {
		return 0
	}
	return float64(wins) / float64(wins+losses) * 100
}

// NewLeaderboardEntry creates a new leaderboard entry.
func NewLeaderboardEntry(ownerID, username string, score, rank int) *LeaderboardEntry {
	entry := &LeaderboardEntry{
		OwnerID:  ownerID,
		Username: username,
		Score:    score,
		Rank:     rank,
	}
	entry.Meta.WinRate = GetWinRate(entry.Meta.Wins, entry.Meta.Losses)
	return entry
}

// UpdateWinLoss updates the win/loss record for a leaderboard entry.
func (e *LeaderboardEntry) UpdateWinLoss(won bool) {
	if won {
		e.Meta.Wins++
	} else {
		e.Meta.Losses++
	}
	e.Meta.WinRate = GetWinRate(e.Meta.Wins, e.Meta.Losses)
}

// RecordPunchUpWin records a punch-up win.
func (e *LeaderboardEntry) RecordPunchUpWin() {
	e.Meta.PunchUpWins++
}
