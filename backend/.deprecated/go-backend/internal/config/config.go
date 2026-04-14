// Package config provides configuration management for the Armored Archer backend.
// It loads configuration from environment variables and provides type-safe access.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the application.
type Config struct {
	Environment  string
	Server       ServerConfig
	Database     DatabaseConfig
	RevenueCat   RevenueCatConfig
	Session      SessionConfig
	Logger       LoggerConfig
	Match        MatchConfig
	Metrics      MetricsConfig
	Alerting     AlertingConfig
	Social       SocialConfig
	Leaderboard  LeaderboardConfig
}

// ServerConfig holds server-related configuration.
type ServerConfig struct {
	Host          string
	Port          int
	ConsolePort   int
	Key           string
	ConsoleKey    string
	ReadTimeout   int
	WriteTimeout  int
}

// DatabaseConfig holds database-related configuration.
type DatabaseConfig struct {
	Address         string
	Host            string
	Port            int
	User            string
	Password        string
	Database        string
	ConnMaxLifetime int
	MaxOpenConns    int
	MaxIdleConns    int
}

// RevenueCatConfig holds RevenueCat IAP configuration.
type RevenueCatConfig struct {
	PublicKey    string
	SecretKey    string
	WebhookSecret string
}

// SessionConfig holds session management configuration.
type SessionConfig struct {
	EncryptionKey       string
	RefreshEncryptionKey string
	TokenEncryptionKey  string
	ExpirySec           int
}

// LoggerConfig holds logging configuration.
type LoggerConfig struct {
	Level       string
	Format      string
	Output      string
	ScrubLogs   bool
}

// MatchConfig holds match configuration.
type MatchConfig struct {
	AllowHostLoopback bool
}

// MetricsConfig holds metrics configuration.
type MetricsConfig struct {
	Namespace      string
	Prefix         string
	PrometheusPort int
}

// AlertingConfig holds alerting configuration.
type AlertingConfig struct {
	Enabled             bool
	DefaultProvider     string
	MinEnvironmentLevel string
}

// SocialConfig holds social authentication configuration.
type SocialConfig struct {
	EnableAnonymousAuth bool
	EnableDeviceAuth    bool
}

// LeaderboardConfig holds leaderboard configuration.
type LeaderboardConfig struct {
	EnableRankCache bool
	RankCacheSize   int
}

// Load loads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
	}

	// Server config
	cfg.Server = ServerConfig{
		Host:         getEnv("NAKAMA_SERVER_HOST", "0.0.0.0"),
		Port:         getEnvAsInt("NAKAMA_SERVER_PORT", 7350),
		ConsolePort:  getEnvAsInt("NAKAMA_CONSOLE_PORT", 7351),
		Key:          getEnv("NAKAMA_SERVER_KEY", "defaultkey"),
		ConsoleKey:   getEnv("NAKAMA_CONSOLE_KEY", ""),
		ReadTimeout:  getEnvAsInt("NAKAMA_READ_TIMEOUT", 10),
		WriteTimeout: getEnvAsInt("NAKAMA_WRITE_TIMEOUT", 10),
	}

	// Database config
	dbAddress := getEnv("DATABASE_ADDRESS", "")
	if dbAddress == "" {
		dbAddress = getEnv("NAKAMA_DATABASE_ADDRESS", "")
	}
	cfg.Database = DatabaseConfig{
		Address:         dbAddress,
		Host:            getEnv("DB_HOST", "postgres"),
		Port:            getEnvAsInt("DB_PORT", 5432),
		User:            getEnv("DB_USER", "postgres"),
		Password:        getEnv("DB_PASSWORD", "changeme"),
		Database:        getEnv("DB_NAME", "nakama"),
		ConnMaxLifetime: getEnvAsInt("DB_CONN_MAX_LIFETIME", 60),
		MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
		MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
	}

	// RevenueCat config
	cfg.RevenueCat = RevenueCatConfig{
		PublicKey:     getEnv("REVENUECAT_PUBLIC_KEY", ""),
		SecretKey:     getEnv("REVENUECAT_SECRET_KEY", ""),
		WebhookSecret: getEnv("REVENUECAT_WEBHOOK_SECRET", ""),
	}

	// Session config
	cfg.Session = SessionConfig{
		EncryptionKey:       getEnv("SESSION_ENCRYPTION_KEY", "default-token-key"),
		RefreshEncryptionKey: getEnv("REFRESH_ENCRYPTION_KEY", "default-refresh-key"),
		TokenEncryptionKey:  getEnv("TOKEN_ENCRYPTION_KEY", ""),
		ExpirySec:           getEnvAsInt("SESSION_EXPIRY_SEC", 7200),
	}

	// Logger config
	cfg.Logger = LoggerConfig{
		Level:     getEnv("LOGGER_LEVEL", "DEBUG"),
		Format:    getEnv("LOGGER_FORMAT", "json"),
		Output:    getEnv("LOGGER_OUTPUT", "stdout"),
		ScrubLogs: getEnvAsBool("LOGGER_SCRUB_LOGS", true),
	}

	// Match config
	cfg.Match = MatchConfig{
		AllowHostLoopback: getEnvAsBool("MATCH_ALLOW_HOST_LOOPBACK", true),
	}

	// Metrics config
	cfg.Metrics = MetricsConfig{
		Namespace:      getEnv("METRIC_NAMESPACE", "nakama"),
		Prefix:         getEnv("METRIC_PREFIX", "nakama"),
		PrometheusPort: getEnvAsInt("METRIC_PROMETHEUS_PORT", 9100),
	}

	// Alerting config
	cfg.Alerting = AlertingConfig{
		Enabled:             getEnvAsBool("ALERTING_ENABLED", false),
		DefaultProvider:     getEnv("ALERTING_DEFAULT_PROVIDER", "prometheus"),
		MinEnvironmentLevel: getEnv("ALERTING_MIN_ENV_LEVEL", "production"),
	}

	// Social config
	cfg.Social = SocialConfig{
		EnableAnonymousAuth: getEnvAsBool("SOCIAL_ENABLE_ANONYMOUS_AUTH", true),
		EnableDeviceAuth:    getEnvAsBool("SOCIAL_ENABLE_DEVICE_AUTH", true),
	}

	// Leaderboard config
	cfg.Leaderboard = LeaderboardConfig{
		EnableRankCache: getEnvAsBool("LEADERBOARD_ENABLE_RANK_CACHE", true),
		RankCacheSize:   getEnvAsInt("LEADERBOARD_RANK_CACHE_SIZE", 1000),
	}

	return cfg, nil
}

// Validate validates the configuration.
func (c *Config) Validate() error {
	// Validate server key in production
	if c.Environment == "production" && c.Server.Key == "defaultkey" {
		return fmt.Errorf("NAKAMA_SERVER_KEY must be set in production")
	}

	// Validate RevenueCat public key
	if c.RevenueCat.PublicKey == "" {
		return fmt.Errorf("REVENUECAT_PUBLIC_KEY is required")
	}

	// Validate database address
	if c.Database.Address == "" {
		return fmt.Errorf("DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required")
	}

	// Validate session keys in production
	if c.Environment == "production" {
		if c.Session.EncryptionKey == "default-token-key" {
			return fmt.Errorf("SESSION_ENCRYPTION_KEY must be set in production")
		}
		if c.Session.RefreshEncryptionKey == "default-refresh-key" {
			return fmt.Errorf("REFRESH_ENCRYPTION_KEY must be set in production")
		}
	}

	// Validate port numbers
	if !isValidPort(c.Server.Port) {
		return fmt.Errorf("invalid server port: %d (must be between 1 and 65535)", c.Server.Port)
	}
	if !isValidPort(c.Server.ConsolePort) {
		return fmt.Errorf("invalid console port: %d (must be between 1 and 65535)", c.Server.ConsolePort)
	}
	if !isValidPort(c.Database.Port) {
		return fmt.Errorf("invalid database port: %d (must be between 1 and 65535)", c.Database.Port)
	}

	return nil
}

// getEnv returns the value of an environment variable or a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt returns the value of an environment variable as an integer or a default value.
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvAsBool returns the value of an environment variable as a boolean or a default value.
func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		lowerValue := strings.ToLower(value)
		if lowerValue == "true" || lowerValue == "1" || lowerValue == "yes" {
			return true
		}
		if lowerValue == "false" || lowerValue == "0" || lowerValue == "no" {
			return false
		}
	}
	return defaultValue
}

// isValidPort checks if a port number is valid (1-65535).
func isValidPort(port int) bool {
	return port >= 1 && port <= 65535
}
