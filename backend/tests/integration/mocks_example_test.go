// Package integration provides example tests demonstrating mock usage
// for RPC handler testing using uber-go/mock.
package integration

import (
	"context"
	"database/sql"
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/database"
	"github.com/anchapin/armored-archer/backend/internal/runtime"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

// mockResult is a simple implementation of sql.Result for testing.
type mockResult struct {
	lastInsertID int64
	rowsAffected int64
}

func (m *mockResult) LastInsertId() (int64, error) {
	return m.lastInsertID, nil
}

func (m *mockResult) RowsAffected() (int64, error) {
	return m.rowsAffected, nil
}

// TestMockDatabase_BasicUsage demonstrates basic mock database usage.
func TestMockDatabase_BasicUsage(t *testing.T) {
	// Create a gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	mockDB := mocks.NewMockDatabase(ctrl)

	// Set up expectations - mockDB should receive ExecContext call
	mockDB.EXPECT().
		ExecContext(gomock.Any(), gomock.Eq("INSERT INTO players (id, name) VALUES ($1, $2)"), gomock.Any()).
		Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)

	// Use the mock in code
	ctx := context.Background()
	_, err := mockDB.ExecContext(ctx, "INSERT INTO players (id, name) VALUES ($1, $2)", "player123", "TestPlayer")

	// Verify expectations were met (automatically done by ctrl.Finish())
	require.NoError(t, err)
	assert.NotNil(t, mockDB)
}

// TestMockLogger_BasicUsage demonstrates basic mock logger usage.
func TestMockLogger_BasicUsage(t *testing.T) {
	// Create a gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock logger
	mockLogger := mocks.NewMockLogger(ctrl)

	// Set up expectations - logger should receive Info, Debug, Warn, Error calls
	mockLogger.EXPECT().Info(gomock.Eq("Player created: %s"), gomock.Any()).Times(1)
	mockLogger.EXPECT().Debug(gomock.Any()).AnyTimes() // Allow any number of debug calls
	mockLogger.EXPECT().Warn(gomock.Any()).AnyTimes()  // Allow any number of warn calls
	mockLogger.EXPECT().Error(gomock.Any()).AnyTimes() // Allow any number of error calls

	// Use the mock in code
	mockLogger.Info("Player created: %s", "player123")
	mockLogger.Debug("Processing request")
	mockLogger.Warn("High latency detected")
	mockLogger.Error("Database connection failed")

	// Verify expectations were met (automatically done by ctrl.Finish())
}

// TestPlayerService_CreatePlayer demonstrates using mocks in an RPC handler pattern.
func TestPlayerService_CreatePlayer(t *testing.T) {
	// Create a gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mocks
	mockDB := mocks.NewMockDatabase(ctrl)
	mockLogger := mocks.NewMockLogger(ctrl)

	// Set up expectations
	ctx := context.Background()
	playerID := "player123"
	playerName := "TestPlayer"

	// Expect ExecContext to be called with specific parameters
	mockDB.EXPECT().
		ExecContext(ctx, gomock.Any(), gomock.Any(), gomock.Any()).
		Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)

	// Expect Info log to be called
	mockLogger.EXPECT().Info(gomock.Eq("Creating player: %s"), gomock.Eq(playerID))

	// Simulate RPC handler logic
	mockLogger.Info("Creating player: %s", playerID)
	_, err := mockDB.ExecContext(ctx, "INSERT INTO players (id, name) VALUES ($1, $2)", playerID, playerName)

	// Verify results
	require.NoError(t, err)
}

// TestMockDatabase_QueryContext demonstrates mocking query operations.
func TestMockDatabase_QueryContext(t *testing.T) {
	// Create a gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	mockDB := mocks.NewMockDatabase(ctrl)

	// Set up expectations
	ctx := context.Background()
	playerID := "player123"

	// Note: In a real test, you would mock sql.Rows using a custom implementation
	// or use a real in-memory database for integration tests.
	// This example shows the pattern for setting up expectations.
	mockDB.EXPECT().
		QueryContext(ctx, gomock.Eq("SELECT id, name FROM players WHERE id = $1"), gomock.Eq(playerID)).
		Return(nil, sql.ErrNoRows) // Simulate player not found

	// Use the mock in code
	rows, err := mockDB.QueryContext(ctx, "SELECT id, name FROM players WHERE id = $1", playerID)

	// Verify expectations were met
	require.Error(t, err)
	assert.Equal(t, sql.ErrNoRows, err)
	assert.Nil(t, rows)
}

// TestMockDatabase_BeginTx demonstrates mocking transaction operations.
func TestMockDatabase_BeginTx(t *testing.T) {
	// Create a gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	mockDB := mocks.NewMockDatabase(ctrl)

	// Set up expectations
	ctx := context.Background()

	// Mock BeginTx to return a mock transaction
	// Note: In a real test, you would need to create a mock sql.Tx or use test doubles
	mockDB.EXPECT().
		BeginTx(ctx, gomock.Any()).
		Return(nil, sql.ErrTxDone) // Simulate transaction error

	// Use the mock in code
	tx, err := mockDB.BeginTx(ctx, nil)

	// Verify expectations were met
	require.Error(t, err)
	assert.Equal(t, sql.ErrTxDone, err)
	assert.Nil(t, tx)
}

// TestInterfaceSegregation demonstrates that our interfaces are minimal.
func TestInterfaceSegregation(t *testing.T) {
	// Verify that DBWrapper implements the Database interface
	var _ database.Database = &database.DBWrapper{}

	// Verify that NakamaLogger implements the Logger interface
	var _ runtime.Logger = &runtime.NakamaLogger{}

	// This test ensures that our interfaces are properly defined
	// and that the concrete types implement them correctly.
	assert.True(t, true, "Interface segregation verified")
}
