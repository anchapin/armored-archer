// Package testhelpers provides Nakama server testcontainers setup for load tests.
// This enables automated Nakama server provisioning with testcontainers database.
package testhelpers

import (
	"context"
	"fmt"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// NakamaTestContainer wraps testcontainers Nakama server instance.
type NakamaTestContainer struct {
	Container testcontainers.Container
	Host      string
	Port      string
}

// SetupNakamaServer starts a Nakama server container connected to the test database.
//
// The Nakama server is configured with:
// - Image: ghcr.io/heroiclabs/nakama:latest
// - Port: 7350 (mapped to random host port)
// - Database: Connected to provided testDB ConnStr
// - Startup timeout: 60 seconds
//
// Example:
//
//	ctx := context.Background()
//	tdb := testhelpers.SetupTestDB(ctx, t)
//	defer testhelpers.TeardownTestDB(ctx, tdb)
//	nakama, err := testhelpers.SetupNakamaServer(ctx, tdb.ConnStr)
//	if err != nil {
//	    t.Fatalf("Failed to setup Nakama: %v", err)
//	}
//	defer testhelpers.TeardownNakamaServer(ctx, nakama)
func SetupNakamaServer(ctx context.Context, databaseConnStr string) (*NakamaTestContainer, error) {
	// Start Nakama server container with database connection
	nakamaContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "ghcr.io/heroiclabs/nakama:latest",
			ExposedPorts: []string{"7350/tcp"},
			Env: map[string]string{
				"NAKAMA_DATABASE_ADDRESS": databaseConnStr,
				"NAKAMA_NAME":              "nakama_test",
				"NAKAMA_LOG_LEVEL":         "info",
			},
			WaitingFor: wait.ForAll(
				wait.ForLog("Startup complete").
					WithOccurrence(1).
					WithStartupTimeout(60*time.Second),
				wait.ForHTTP("/").
					WithPort("7350").
					WithStartupTimeout(10*time.Second),
			),
		},
		Started: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to start nakama container: %w", err)
	}

	// Get mapped host and port
	host, err := nakamaContainer.Host(ctx)
	if err != nil {
		nakamaContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to get nakama host: %w", err)
	}

	port, err := nakamaContainer.MappedPort(ctx, "7350")
	if err != nil {
		nakamaContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to get nakama port: %w", err)
	}

	return &NakamaTestContainer{
		Container: nakamaContainer,
		Host:      host,
		Port:      port.Port(),
	}, nil
}

// TeardownNakamaServer stops the Nakama container and cleans up resources.
//
// This should be called in a defer statement after SetupNakamaServer.
//
// Example:
//
//	defer testhelpers.TeardownNakamaServer(ctx, nakama)
func TeardownNakamaServer(ctx context.Context, nakama *NakamaTestContainer) error {
	if nakama == nil || nakama.Container == nil {
		return nil
	}

	if err := nakama.Container.Terminate(ctx); err != nil {
		return fmt.Errorf("failed to terminate nakama container: %w", err)
	}

	return nil
}

// GetEndpoint returns the Nakama server URL for k6 load tests.
//
// Example:
//
//	url := nakama.GetEndpoint()
//	// Returns: "http://host:port"
func (n *NakamaTestContainer) GetEndpoint() string {
	return fmt.Sprintf("http://%s:%s", n.Host, n.Port)
}
