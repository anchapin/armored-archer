// Package matchhistory provides match history and rankings for the Armored Archer backend.
package matchhistory

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"
)

// MatchResult represents the result of a match.
type MatchResult string

const (
	MatchResultWin        MatchResult = "win"
	MatchResultLoss       MatchResult = "loss"
	MatchResultDraw       MatchResult = "draw"
	MatchResultAbandoned  MatchResult = "abandoned"
)

// MatchType represents the type of match.
type MatchType string

const (
	MatchTypePvE    MatchType = "pve"
	MatchTypePvP    MatchType = "pvp"
	MatchTypeRanked MatchType = "ranked"
)

// MatchRecord represents a single match in history.
type MatchRecord struct {
	MatchID      string      `json:"match_id"`
	UserID       string      `json:"user_id"`
	MatchType    MatchType   `json:"match_type"`
	Result       MatchResult `json:"result"`
	Score        int         `json:"score"`
	OpponentID   string      `json:"opponent_id,omitempty"`
	DurationSec  int64       `json:"duration_sec"`
	Timestamp    int64       `json:"timestamp"`
	RatingChange int         `json:"rating_change,omitempty"`
}

// PlayerRanking represents a player's ranking.
type PlayerRanking struct {
	UserID     string  `json:"user_id"`
	Username   string  `json:"username"`
	Rating     int     `json:"rating"`
	Wins       int     `json:"wins"`
	Losses     int     `json:"losses"`
	WinRate    float64 `json:"win_rate"`
	LastActive int64   `json:"last_active"`
}

// NewMatchRecord creates a new match record.
func NewMatchRecord(userID, matchID string, matchType MatchType, result MatchResult, score int, opponentID string, durationSec int64) *MatchRecord {
	return &MatchRecord{
		MatchID:     matchID,
		UserID:      userID,
		MatchType:   matchType,
		Result:      result,
		Score:       score,
		OpponentID:  opponentID,
		DurationSec: durationSec,
		Timestamp:   time.Now().UnixMilli(),
	}
}

// ToJSON converts a match record to JSON string.
func (m *MatchRecord) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match record: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a match record from JSON.
func FromJSON(jsonStr string) (*MatchRecord, error) {
	var record MatchRecord
	if err := json.Unmarshal([]byte(jsonStr), &record); err != nil {
		return nil, fmt.Errorf("failed to parse match record JSON: %w", err)
	}
	return &record, nil
}

// CalculateRatingChange calculates ELO-style rating change.
func CalculateRatingChange(playerRating, opponentRating int, won bool) int {
	const K = 32 // K-factor

	expected := 1.0 / (1.0 + float64(opponentRating-playerRating)/400)
	actual := 0.0
	if won {
		actual = 1.0
	}

	change := int(K * (actual - expected))
	if change == 0 {
		if won {
			change = 1
		} else {
			change = -1
		}
	}

	return change
}

// SortByTimestamp sorts match records by timestamp (newest first).
func SortByTimestamp(records []*MatchRecord) {
	sort.Slice(records, func(i, j int) bool {
		return records[i].Timestamp > records[j].Timestamp
	})
}

// FilterByMatchType filters match records by type.
func FilterByMatchType(records []*MatchRecord, matchType MatchType) []*MatchRecord {
	filtered := make([]*MatchRecord, 0)
	for _, r := range records {
		if r.MatchType == matchType {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// FilterByResult filters match records by result.
func FilterByResult(records []*MatchRecord, result MatchResult) []*MatchRecord {
	filtered := make([]*MatchRecord, 0)
	for _, r := range records {
		if r.Result == result {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// GetWinLossRecord calculates wins and losses from match history.
func GetWinLossRecord(records []*MatchRecord) (wins, losses int) {
	for _, r := range records {
		switch r.Result {
		case MatchResultWin:
			wins++
		case MatchResultLoss, MatchResultAbandoned:
			losses++
		}
	}
	return wins, losses
}

// CalculateWinRate calculates win rate from wins and losses.
func CalculateWinRate(wins, losses int) float64 {
	if wins+losses == 0 {
		return 0
	}
	return float64(wins) / float64(wins+losses) * 100
}

// MatchesToJSON converts a slice of match records to JSON.
func MatchesToJSON(records []*MatchRecord) (string, error) {
	jsonBytes, err := json.Marshal(records)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match records: %w", err)
	}
	return string(jsonBytes), nil
}

// ValidateMatchRecord validates a match record.
func (m *MatchRecord) Validate() error {
	if m.MatchID == "" {
		return errors.New("match_id is required")
	}
	if m.UserID == "" {
		return errors.New("user_id is required")
	}
	if m.MatchType == "" {
		return errors.New("match_type is required")
	}
	if m.Result == "" {
		return errors.New("result is required")
	}
	return nil
}

// RankingsToJSON converts a slice of rankings to JSON.
func RankingsToJSON(rankings []*PlayerRanking) (string, error) {
	jsonBytes, err := json.Marshal(rankings)
	if err != nil {
		return "", fmt.Errorf("failed to marshal rankings: %w", err)
	}
	return string(jsonBytes), nil
}

// SortRankingsByRating sorts player rankings by rating (highest first).
func SortRankingsByRating(rankings []*PlayerRanking) {
	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Rating > rankings[j].Rating
	})
}
