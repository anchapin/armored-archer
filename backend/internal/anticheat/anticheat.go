// Package anticheat provides anti-cheat validation for the Armored Archer backend.
package anticheat

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// ViolationType represents the type of anti-cheat violation.
type ViolationType string

const (
	ViolationTiming      ViolationType = "timing"
	ViolationSignature   ViolationType = "signature"
	ViolationFrequency   ViolationType = "frequency"
	ViolationImpossibile ViolationType = "impossible_action"
)

// ViolationSeverity represents the severity of a violation.
type ViolationSeverity string

const (
	SeverityLow    ViolationSeverity = "low"
	SeverityMedium ViolationSeverity = "medium"
	SeverityHigh   ViolationSeverity = "high"
)

// AntiCheatViolation represents an anti-cheat violation.
type AntiCheatViolation struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	ViolationType ViolationType   `json:"violation_type"`
	Severity    ViolationSeverity `json:"severity"`
	Description string            `json:"description"`
	Timestamp   int64             `json:"timestamp"`
	Context     map[string]string `json:"context,omitempty"`
}

// RequestSignature represents an anti-cheat request signature.
type RequestSignature struct {
	RequestID string `json:"request_id"`
	Timestamp int64  `json:"timestamp"`
	Signature string `json:"signature"`
	Nonce     string `json:"nonce"`
}

// AntiCheatValidator validates requests for cheating.
type AntiCheatValidator struct {
	secretKey       string
	seenNonces      map[string]bool
	maxRequestAge   time.Duration
	requestWindow   time.Duration
}

// NewAntiCheatValidator creates a new anti-cheat validator.
func NewAntiCheatValidator(secretKey string) *AntiCheatValidator {
	return &AntiCheatValidator{
		secretKey:     secretKey,
		seenNonces:    make(map[string]bool),
		maxRequestAge: 30 * time.Second,
		requestWindow: 5 * time.Second,
	}
}

// ValidateSignature validates a request signature.
func (v *AntiCheatValidator) ValidateSignature(req *RequestSignature, userID string) error {
	if req.RequestID == "" {
		return errors.New("request_id is required")
	}
	if req.Signature == "" {
		return errors.New("signature is required")
	}
	if req.Nonce == "" {
		return errors.New("nonce is required")
	}

	// Check timestamp freshness
	reqTime := time.UnixMilli(req.Timestamp)
	now := time.Now()
	age := now.Sub(reqTime)

	if age > v.maxRequestAge {
		return fmt.Errorf("request too old: %v", age)
	}

	if age < -v.requestWindow {
		return fmt.Errorf("request timestamp in future: %v", age)
	}

	// Check nonce uniqueness (prevent replay attacks)
	if v.seenNonces[req.Nonce] {
		return errors.New("nonce already used (possible replay attack)")
	}
	v.seenNonces[req.Nonce] = true

	// Clean old nonces (keep only last 5 minutes)
	v.cleanupNonces()

	// Verify signature
	expectedSignature := v.generateSignature(req.RequestID, req.Timestamp, userID)
	if !hmac.Equal([]byte(req.Signature), []byte(expectedSignature)) {
		return errors.New("invalid signature")
	}

	return nil
}

// ValidateCombatAction validates a combat action for cheating.
func (v *AntiCheatValidator) ValidateCombatAction(userID, actionType string, angle, power float64, timestamp int64) (*AntiCheatViolation, error) {
	// Check for impossible angles
	if angle < 0 || angle > 2*3.14159*2 {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityHigh,
			Description: "Impossible angle value",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"angle": fmt.Sprintf("%f", angle),
			},
		}, nil
	}

	// Check for impossible power values
	if power < 0 || power > 1.5 {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityMedium,
			Description: "Impossible power value",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"power": fmt.Sprintf("%f", power),
			},
		}, nil
	}

	// Check request frequency (simple rate limiting)
	// In production, this would use Redis or similar

	return nil, nil
}

// ValidateTiming validates action timing.
func (v *AntiCheatValidator) ValidateTiming(userID string, actionsPerSecond float64) (*AntiCheatViolation, error) {
	// Typical human reaction time is ~200ms, so max ~5 actions/second
	// Allow some buffer for network latency
	const MaxActionsPerSecond = 10

	if actionsPerSecond > MaxActionsPerSecond {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationFrequency,
			Severity:    SeverityHigh,
			Description: fmt.Sprintf("Excessive action frequency: %.2f actions/sec", actionsPerSecond),
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"actions_per_second": fmt.Sprintf("%f", actionsPerSecond),
			},
		}, nil
	}

	return nil, nil
}

// RecordViolation records an anti-cheat violation.
func (v *AntiCheatValidator) RecordViolation(violation *AntiCheatViolation) {
	// In production, this would store to database
	// For now, just log
	_ = violation
}

// GetSeverity returns the severity for a violation type.
func GetSeverity(violationType ViolationType) ViolationSeverity {
	switch violationType {
	case ViolationTiming:
		return SeverityMedium
	case ViolationSignature:
		return SeverityHigh
	case ViolationFrequency:
		return SeverityHigh
	case ViolationImpossibile:
		return SeverityHigh
	default:
		return SeverityLow
	}
}

// generateSignature generates an HMAC signature for a request.
func (v *AntiCheatValidator) generateSignature(requestID string, timestamp int64, userID string) string {
	message := fmt.Sprintf("%s:%d:%s", requestID, timestamp, userID)
	h := hmac.New(sha256.New, []byte(v.secretKey))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// cleanupNonces removes old nonces from the seen set.
func (v *AntiCheatValidator) cleanupNonces() {
	// Simple cleanup - in production use LRU cache
	if len(v.seenNonces) > 10000 {
		v.seenNonces = make(map[string]bool)
	}
}

// generateViolationID generates a unique violation ID.
func generateViolationID() string {
	return fmt.Sprintf("v_%d", time.Now().UnixNano())
}

// GenerateSignature generates a signature for a request (client-side).
func GenerateSignature(secretKey, requestID string, timestamp int64, userID string) string {
	message := fmt.Sprintf("%s:%d:%s", requestID, timestamp, userID)
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// ValidatePlayerStats validates player stats for impossible values.
func ValidatePlayerStats(userID string, level, attack, defense, dodge, critRate int) (*AntiCheatViolation, error) {
	// Check for impossible stat values
	maxStatForLevel := level * 10 // Example: max stat is 10x level

	if attack > maxStatForLevel {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityHigh,
			Description: "Impossible attack stat",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"attack": fmt.Sprintf("%d", attack),
				"max_allowed": fmt.Sprintf("%d", maxStatForLevel),
			},
		}, nil
	}

	if defense > maxStatForLevel {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityHigh,
			Description: "Impossible defense stat",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"defense": fmt.Sprintf("%d", defense),
				"max_allowed": fmt.Sprintf("%d", maxStatForLevel),
			},
		}, nil
	}

	if dodge > maxStatForLevel {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityHigh,
			Description: "Impossible dodge stat",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"dodge": fmt.Sprintf("%d", dodge),
				"max_allowed": fmt.Sprintf("%d", maxStatForLevel),
			},
		}, nil
	}

	if critRate > 100 {
		return &AntiCheatViolation{
			ID:          generateViolationID(),
			UserID:      userID,
			ViolationType: ViolationImpossibile,
			Severity:    SeverityHigh,
			Description: "Impossible crit rate (>100%)",
			Timestamp:   time.Now().UnixMilli(),
			Context: map[string]string{
				"crit_rate": fmt.Sprintf("%d", critRate),
			},
		}, nil
	}

	return nil, nil
}

// ViolationsToJSON converts a slice of violations to JSON.
func ViolationsToJSON(violations []*AntiCheatViolation) (string, error) {
	// Implementation would marshal to JSON
	// For now, return placeholder
	return "[]", nil
}
