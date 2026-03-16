// Package storage provides storage constants and helpers for the Armored Archer backend.
package storage

import (
	"encoding/json"
	"fmt"
)

// StorageCollections defines standard storage collection names.
var StorageCollections = struct {
	PlayerStats       string
	PlayerInventory   string
	PlayerProgression string
	SeasonData        string
	MatchData         string
}{
	PlayerStats:       "player_stats",
	PlayerInventory:   "player_inventory",
	PlayerProgression: "player_progression",
	SeasonData:        "season_data",
	MatchData:         "match_data",
}

// StorageReadOptions defines options for reading from storage.
type StorageReadOptions struct {
	Collection string
	Key        string
	UserID     string
}

// StorageWriteOptions defines options for writing to storage.
type StorageWriteOptions struct {
	Collection string
	Key        string
	UserID     string
	Value      interface{}
	Version    string
}

// StorageObjectResult represents the result of a storage operation.
type StorageObjectResult struct {
	Success bool
	Data    interface{}
	Error   error
}

// CreateStorageRead creates a storage read request.
func CreateStorageRead(collection, key, userID string) StorageReadOptions {
	return StorageReadOptions{
		Collection: collection,
		Key:        key,
		UserID:     userID,
	}
}

// CreateStorageWrite creates a storage write request.
func CreateStorageWrite(collection, key, userID string, value interface{}) StorageWriteOptions {
	return StorageWriteOptions{
		Collection: collection,
		Key:        key,
		UserID:     userID,
		Value:      value,
	}
}

// MarshalValue marshals a value to JSON string for storage.
func MarshalValue(value interface{}) (string, error) {
	switch v := value.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		marshaled, err := json.Marshal(value)
		if err != nil {
			return "", fmt.Errorf("failed to marshal value: %w", err)
		}
		return string(marshaled), nil
	}
}

// UnmarshalValue unmarshals a JSON string from storage.
func UnmarshalValue(value string, target interface{}) error {
	if value == "" {
		return fmt.Errorf("empty value")
	}
	return json.Unmarshal([]byte(value), target)
}

// StorageObjectExists checks if storage objects exist.
func StorageObjectExists(count int) bool {
	return count > 0
}

// ParseStorageValueJSON parses storage value JSON with fallback.
func ParseStorageValueJSON(value string, fallback interface{}) (interface{}, error) {
	if value == "" {
		return fallback, nil
	}

	err := json.Unmarshal([]byte(value), &fallback)
	if err != nil {
		return fallback, fmt.Errorf("failed to parse storage value: %w", err)
	}

	return fallback, nil
}
