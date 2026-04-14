package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Set up test environment variables
	os.Setenv("REVENUECAT_PUBLIC_KEY", "test_public_key")
	os.Setenv("DATABASE_ADDRESS", "postgres://test:test@localhost:5432/test")
	defer os.Unsetenv("REVENUECAT_PUBLIC_KEY")
	defer os.Unsetenv("DATABASE_ADDRESS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.Environment != "development" {
		t.Errorf("Expected environment to be 'development', got '%s'", cfg.Environment)
	}

	if cfg.Server.Port != 7350 {
		t.Errorf("Expected server port to be 7350, got %d", cfg.Server.Port)
	}

	if cfg.RevenueCat.PublicKey != "test_public_key" {
		t.Errorf("Expected RevenueCat public key to be 'test_public_key', got '%s'", cfg.RevenueCat.PublicKey)
	}
}

func TestValidate(t *testing.T) {
	// Test missing required config
	cfg := &Config{
		Environment: "production",
		Server: ServerConfig{
			Key: "defaultkey",
		},
		RevenueCat: RevenueCatConfig{
			PublicKey: "",
		},
		Database: DatabaseConfig{
			Address: "",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Error("Expected validation to fail for missing required config")
	}

	// Test valid config
	cfg2 := &Config{
		Environment: "development",
		Server: ServerConfig{
			Key:         "testkey",
			Port:        7350,
			ConsolePort: 7351,
		},
		RevenueCat: RevenueCatConfig{
			PublicKey: "test_key",
		},
		Database: DatabaseConfig{
			Address: "postgres://test@localhost:5432/test",
			Port:    5432,
		},
	}

	err = cfg2.Validate()
	if err != nil {
		t.Errorf("Expected validation to pass, got: %v", err)
	}
}

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	value := getEnv("TEST_VAR", "default")
	if value != "test_value" {
		t.Errorf("Expected 'test_value', got '%s'", value)
	}

	value = getEnv("NONEXISTENT_VAR", "default")
	if value != "default" {
		t.Errorf("Expected 'default', got '%s'", value)
	}
}

func TestGetEnvAsInt(t *testing.T) {
	os.Setenv("TEST_INT", "123")
	defer os.Unsetenv("TEST_INT")

	value := getEnvAsInt("TEST_INT", 0)
	if value != 123 {
		t.Errorf("Expected 123, got %d", value)
	}

	value = getEnvAsInt("NONEXISTENT_INT", 42)
	if value != 42 {
		t.Errorf("Expected 42, got %d", value)
	}
}

func TestGetEnvAsBool(t *testing.T) {
	os.Setenv("TEST_BOOL_TRUE", "true")
	os.Setenv("TEST_BOOL_FALSE", "false")
	os.Setenv("TEST_BOOL_1", "1")
	os.Setenv("TEST_BOOL_0", "0")
	defer os.Unsetenv("TEST_BOOL_TRUE")
	defer os.Unsetenv("TEST_BOOL_FALSE")
	defer os.Unsetenv("TEST_BOOL_1")
	defer os.Unsetenv("TEST_BOOL_0")

	if !getEnvAsBool("TEST_BOOL_TRUE", false) {
		t.Error("Expected true")
	}
	if getEnvAsBool("TEST_BOOL_FALSE", true) {
		t.Error("Expected false")
	}
	if !getEnvAsBool("TEST_BOOL_1", false) {
		t.Error("Expected true")
	}
	if getEnvAsBool("TEST_BOOL_0", true) {
		t.Error("Expected false")
	}
}

func TestIsValidPort(t *testing.T) {
	tests := []struct {
		port     int
		expected bool
	}{
		{0, false},
		{1, true},
		{80, true},
		{443, true},
		{7350, true},
		{65535, true},
		{65536, false},
		{-1, false},
	}

	for _, tt := range tests {
		result := isValidPort(tt.port)
		if result != tt.expected {
			t.Errorf("isValidPort(%d) = %v, expected %v", tt.port, result, tt.expected)
		}
	}
}
