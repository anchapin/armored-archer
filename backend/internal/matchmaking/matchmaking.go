// Package matchmaking provides matchmaking and PvP match management for the Armored Archer backend.
package matchmaking

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"
)

// Match status constants
const (
	MatchStatusPending   = "pending"
	MatchStatusActive    = "active"
	MatchStatusCompleted = "completed"
	MatchStatusExpired   = "expired"
)

// Match type constants
const (
	MatchTypeRanked  = "ranked"
	MatchTypeCasual  = "casual"
)

// Match result constants
const (
	MatchResultWin        = "win"
	MatchResultLoss       = "loss"
	MatchResultDraw       = "draw"
	MatchResultAbandoned  = "abandoned"
)

// Match expiration time (24 hours)
const MatchExpirationMs = 24 * 60 * 60 * 1000

// PvPMatch represents a PvP match.
type PvPMatch struct {
	MatchID         string  `json:"match_id"`
	CreatorID       string  `json:"creator_id"`
	OpponentID      string  `json:"opponent_id"`
	CreatorRank     int     `json:"creator_rank"`
	OpponentRank    int     `json:"opponent_rank"`
	MatchType       string  `json:"match_type"`
	IsPunchUp       bool    `json:"is_punch_up"`
	Status          string  `json:"status"`
	CreatedAt       int64   `json:"created_at"`
	UpdatedAt       int64   `json:"updated_at"`
	Winner          string  `json:"winner,omitempty"`
	ExpiresAt       int64   `json:"expires_at"`
	LastTurnTs      int64   `json:"last_turn_timestamp"`
	CreatorTurnData *TurnData `json:"creator_turn_data,omitempty"`
	OpponentTurnData *TurnData `json:"opponent_turn_data,omitempty"`
}

// TurnData represents turn data for a match.
type TurnData map[string]interface{}

// CreateMatchRequest represents a request to create a match.
type CreateMatchRequest struct {
	MatchType         string `json:"match_type"`
	IsPunchUp         bool   `json:"is_punch_up,omitempty"`
	TargetOpponentID  string `json:"target_opponent_id,omitempty"`
}

// AcceptMatchRequest represents a request to accept a match.
type AcceptMatchRequest struct {
	MatchID string `json:"match_id"`
}

// ListMatchesRequest represents a request to list matches.
type ListMatchesRequest struct {
	MatchType string `json:"match_type,omitempty"`
	MinRank   int    `json:"min_rank,omitempty"`
	MaxRank   int    `json:"max_rank,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// CompleteMatchRequest represents a request to complete a match.
type CompleteMatchRequest struct {
	MatchID   string `json:"match_id"`
	WinnerID  string `json:"winner_id"`
	LoserID   string `json:"loser_id"`
	IsPunchUp bool   `json:"is_punch_up,omitempty"`
}

// MatchListResult represents the result of listing matches.
type MatchListResult struct {
	Success    bool      `json:"success"`
	Matches    []*PvPMatch `json:"matches"`
	PlayerRank int       `json:"player_rank"`
	Total      int       `json:"total"`
}

// NewPvPMatch creates a new PvP match.
func NewPvPMatch(creatorID, opponentID string, creatorRank, opponentRank int, matchType string, isPunchUp bool) *PvPMatch {
	now := time.Now().UnixMilli()
	return &PvPMatch{
		MatchID:      generateMatchID(),
		CreatorID:    creatorID,
		OpponentID:   opponentID,
		CreatorRank:  creatorRank,
		OpponentRank: opponentRank,
		MatchType:    matchType,
		IsPunchUp:    isPunchUp,
		Status:       MatchStatusPending,
		CreatedAt:    now,
		UpdatedAt:    now,
		ExpiresAt:    now + MatchExpirationMs,
		LastTurnTs:   now,
	}
}

// Accept accepts a pending match.
func (m *PvPMatch) Accept() {
	if m.Status == MatchStatusPending {
		m.Status = MatchStatusActive
		m.UpdatedAt = time.Now().UnixMilli()
		m.LastTurnTs = time.Now().UnixMilli()
	}
}

// Complete completes a match with a winner.
func (m *PvPMatch) Complete(winnerID string) {
	if m.Status == MatchStatusActive {
		m.Status = MatchStatusCompleted
		m.Winner = winnerID
		m.UpdatedAt = time.Now().UnixMilli()
	}
}

// IsExpired checks if a match has expired.
func (m *PvPMatch) IsExpired() bool {
	return time.Now().UnixMilli() > m.ExpiresAt || m.Status == MatchStatusExpired
}

// Expire marks a match as expired.
func (m *PvPMatch) Expire() {
	m.Status = MatchStatusExpired
	m.UpdatedAt = time.Now().UnixMilli()
}

// CanAccept checks if a user can accept this match.
func (m *PvPMatch) CanAccept(userID string) bool {
	return m.Status == MatchStatusPending && 
		   m.OpponentID == userID && 
		   !m.IsExpired()
}

// CanComplete checks if a user can complete this match.
func (m *PvPMatch) CanComplete(userID string) bool {
	return m.Status == MatchStatusActive && 
		   (m.CreatorID == userID || m.OpponentID == userID) &&
		   !m.IsExpired()
}

// Validate validates a create match request.
func (r *CreateMatchRequest) Validate() error {
	if r.MatchType != MatchTypeRanked && r.MatchType != MatchTypeCasual {
		return fmt.Errorf("invalid match_type: must be 'ranked' or 'casual'")
	}
	return nil
}

// Validate validates an accept match request.
func (r *AcceptMatchRequest) Validate() error {
	if r.MatchID == "" {
		return fmt.Errorf("match_id is required")
	}
	return nil
}

// Validate validates a complete match request.
func (r *CompleteMatchRequest) Validate() error {
	if r.MatchID == "" {
		return fmt.Errorf("match_id is required")
	}
	if r.WinnerID == "" {
		return fmt.Errorf("winner_id is required")
	}
	if r.LoserID == "" {
		return fmt.Errorf("loser_id is required")
	}
	if r.WinnerID == r.LoserID {
		return fmt.Errorf("winner and loser must be different")
	}
	return nil
}

// CalculateRank calculates a player's rank from their stats.
func CalculateRank(level int, wins, losses int) int {
	// Simple rank calculation: base rank from level, adjusted by win rate
	baseRank := level * 10
	
	if wins+losses == 0 {
		return baseRank
	}
	
	winRate := float64(wins) / float64(wins+losses)
	rankAdjustment := int((winRate - 0.5) * 100)
	
	return baseRank + rankAdjustment
}

// CalculateEloChange calculates Elo rating change after a match.
func CalculateEloChange(winnerElo, loserElo int, isPunchUp bool) (winnerChange, loserChange int) {
	const K = 32 // K-factor for Elo
	
	// Calculate expected scores
	winnerExpected := 1.0 / (1.0 + math.Pow(10, float64(loserElo-winnerElo)/400))
	loserExpected := 1.0 / (1.0 + math.Pow(10, float64(winnerElo-loserElo)/400))
	
	// Actual scores (1 for winner, 0 for loser)
	winnerActual := 1.0
	loserActual := 0.0
	
	// Calculate changes
	winnerChange = int(float64(K) * (winnerActual - winnerExpected))
	loserChange = int(float64(K) * (loserActual - loserExpected))
	
	// Punch-up bonus: winner gains more, loser loses less
	if isPunchUp && loserElo > winnerElo+100 {
		winnerChange = winnerChange + 5
		if loserChange < -5 {
			loserChange = loserChange + 5
		}
	}
	
	// Minimum change of 1
	if winnerChange == 0 {
		winnerChange = 1
	}
	if loserChange == 0 {
		loserChange = -1
	}
	
	return winnerChange, loserChange
}

// FilterMatches filters a list of matches by criteria.
func FilterMatches(matches []*PvPMatch, matchType string, minRank, maxRank int) []*PvPMatch {
	filtered := make([]*PvPMatch, 0)
	
	for _, m := range matches {
		// Skip expired matches
		if m.IsExpired() {
			continue
		}
		
		// Filter by match type
		if matchType != "" && m.MatchType != matchType {
			continue
		}
		
		// Filter by rank range
		if minRank > 0 && m.CreatorRank < minRank && m.OpponentRank < minRank {
			continue
		}
		if maxRank > 0 && m.CreatorRank > maxRank && m.OpponentRank > maxRank {
			continue
		}
		
		filtered = append(filtered, m)
	}
	
	return filtered
}

// SortMatchesByCreatedAt sorts matches by creation time (newest first).
func SortMatchesByCreatedAt(matches []*PvPMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].CreatedAt > matches[j].CreatedAt
	})
}

// GetActiveMatchForUser returns the active match for a user.
func GetActiveMatchForUser(matches []*PvPMatch, userID string) *PvPMatch {
	for _, m := range matches {
		if m.Status == MatchStatusActive && !m.IsExpired() {
			if m.CreatorID == userID || m.OpponentID == userID {
				return m
			}
		}
	}
	return nil
}

// GetPendingMatchesForUser returns pending matches for a user.
func GetPendingMatchesForUser(matches []*PvPMatch, userID string) []*PvPMatch {
	pending := make([]*PvPMatch, 0)
	for _, m := range matches {
		if m.Status == MatchStatusPending && !m.IsExpired() {
			if m.OpponentID == userID {
				pending = append(pending, m)
			}
		}
	}
	return pending
}

// ToJSON converts a match to JSON string.
func (m *PvPMatch) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a match from JSON.
func MatchFromJSON(jsonStr string) (*PvPMatch, error) {
	var match PvPMatch
	if err := json.Unmarshal([]byte(jsonStr), &match); err != nil {
		return nil, fmt.Errorf("failed to parse match JSON: %w", err)
	}
	return &match, nil
}

// MatchesToJSON converts a slice of matches to JSON.
func MatchesToJSON(matches []*PvPMatch) (string, error) {
	jsonBytes, err := json.Marshal(matches)
	if err != nil {
		return "", fmt.Errorf("failed to marshal matches: %w", err)
	}
	return string(jsonBytes), nil
}

// MatchListResultToJSON converts a match list result to JSON.
func MatchListResultToJSON(result *MatchListResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal match list result: %w", err)
	}
	return string(jsonBytes), nil
}

func generateMatchID() string {
	return fmt.Sprintf("match_%d", time.Now().UnixNano())
}

// GetRankFromElo calculates a display rank from Elo rating.
func GetRankFromElo(elo int) int {
	// Simple tier system based on Elo
	switch {
	case elo >= 2000:
		return 10 // Master
	case elo >= 1800:
		return 9  // Diamond
	case elo >= 1600:
		return 8  // Platinum
	case elo >= 1400:
		return 7  // Gold
	case elo >= 1200:
		return 6  // Silver
	case elo >= 1000:
		return 5  // Bronze
	default:
		return elo / 100 // Unranked tiers
	}
}

// IsPunchUp determines if a match is a punch-up (opponent is significantly higher rank).
func IsPunchUp(creatorRank, opponentRank int) bool {
	return opponentRank > creatorRank + 50
}

// PlayerRanking represents a player's ranking entry.
type PlayerRanking struct {
	UserID     string `json:"user_id"`
	Username   string `json:"username"`
	Elo        int    `json:"elo"`
	Rank       int    `json:"rank"`
	Wins       int    `json:"wins"`
	Losses     int    `json:"losses"`
	SeasonID   string `json:"season_id"`
	LastActive int64  `json:"last_active"`
}

// UpdateRanking updates a player's ranking after a match.
func (p *PlayerRanking) UpdateRanking(won bool, eloChange int) {
	p.Elo += eloChange
	if p.Elo < 0 {
		p.Elo = 0
	}
	
	if won {
		p.Wins++
	} else {
		p.Losses++
	}
	
	p.Rank = GetRankFromElo(p.Elo)
	p.LastActive = time.Now().UnixMilli()
}

// GetWinRate calculates win rate from wins and losses.
func (p *PlayerRanking) GetWinRate() float64 {
	if p.Wins+p.Losses == 0 {
		return 0
	}
	return float64(p.Wins) / float64(p.Wins+p.Losses) * 100
}

// RankingsToJSON converts a slice of rankings to JSON.
func RankingsToJSON(rankings []*PlayerRanking) (string, error) {
	jsonBytes, err := json.Marshal(rankings)
	if err != nil {
		return "", fmt.Errorf("failed to marshal rankings: %w", err)
	}
	return string(jsonBytes), nil
}

// SortRankingsByElo sorts rankings by Elo (highest first).
func SortRankingsByElo(rankings []*PlayerRanking) {
	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Elo > rankings[j].Elo
	})
}
