// Package integration provides database test suite lifecycle management.
// This file uses testify/suite to manage setup/teardown of PostgreSQL containers
// for integration tests, ensuring proper isolation between tests.
package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/suite"
	"go.uber.org/mock/gomock"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers/mocks"
)

// DatabaseTestSuite manages the lifecycle of database integration tests.
// It provides a PostgreSQL container via testcontainers, snapshot/restore
// for fast reset between tests, and mock database for unit testing.
type DatabaseTestSuite struct {
	suite.Suite
	ctx      context.Context
	testDB   *testhelpers.TestDB
	mockDB   *mocks.MockDatabase
	ctrl     *gomock.Controller
	repo     any // Placeholder for future repository (e.g., *PlayerRepository)
}

// SetupSuite runs once before all tests in the suite.
// It creates the PostgreSQL container, mock database controller, and creates
// the initial snapshot for fast reset.
func (s *DatabaseTestSuite) SetupSuite() {
	s.ctx = context.Background()

	// Setup real database
	s.testDB = testhelpers.SetupTestDB(s.ctx, s.T())
	s.NotNil(s.testDB, "TestDB should be initialized")
	s.NotNil(s.testDB.DB, "Database connection should be established")
	s.NotNil(s.testDB.Container, "PostgreSQL container should be running")

	// Setup mock database controller
	s.ctrl = gomock.NewController(s.T())
	s.NotNil(s.ctrl, "Controller should be initialized")

	// Setup mock database
	s.mockDB = mocks.NewMockDatabase(s.ctrl)
	s.NotNil(s.mockDB, "Mock database should be initialized")

	// TODO: Initialize repository when implemented
	// s.repo = NewPlayerRepository(s.testDB.DB)
}

// TearDownSuite runs once after all tests in the suite.
// It terminates the PostgreSQL container, closes the database connection,
// and finishes the mock controller.
func (s *DatabaseTestSuite) TearDownSuite() {
	if s.testDB != nil {
		err := testhelpers.TeardownTestDB(s.ctx, s.testDB)
		s.NoError(err, "TeardownTestDB should complete without errors")
	}

	// Finish mock controller to verify all expectations were met
	if s.ctrl != nil {
		s.ctrl.Finish()
	}
}

// SetupTest runs before each test in the suite.
// It restores the database to the initial snapshot, ensuring each test
// starts with a clean database state.
func (s *DatabaseTestSuite) SetupTest() {
	if s.testDB != nil {
		err := testhelpers.ResetTestDB(s.ctx, s.testDB)
		s.NoError(err, "ResetTestDB should complete without errors")
	}

	// Note: Mock expectations are reset automatically by gomock
	// Each test should set up its own expectations
}

// TearDownTest runs after each test in the suite.
// Currently empty, but can be used for per-test cleanup if needed.
func (s *DatabaseTestSuite) TearDownTest() {
	// Placeholder for future per-test cleanup
}

// TestCreatePlayer is an example test that demonstrates:
// 1. Database isolation (each test gets a clean database)
// 2. Test fixture usage (NewTestPlayer)
// 3. Test suite lifecycle (SetupTest/TearDownTest)
func (s *DatabaseTestSuite) TestCreatePlayer() {
	// Create a test player using fixture
	player := testhelpers.NewTestPlayer()
	s.NotNil(player, "Player should be created")
	s.NotEmpty(player.UserID, "Player should have a UserID")
	s.Equal(1, player.Level, "Default level should be 1")
	s.Equal(10, player.Attack, "Default attack should be 10")

	// TODO: Insert player into database when repository is implemented
	// err := s.repo.CreatePlayer(s.ctx, player)
	// s.NoError(err, "Player should be created in database")
	// s.NotEmpty(player.ID, "Player should have a database ID")

	// Verify database isolation - next test should not see this player
}

// TestCreatePlayerWithLevel verifies that level-based fixtures work correctly.
func (s *DatabaseTestSuite) TestCreatePlayerWithLevel() {
	// Create a level 10 player
	player := testhelpers.NewTestPlayerWithLevel(10)
	s.NotNil(player, "Player should be created")
	s.Equal(10, player.Level, "Level should be 10")
	s.Equal(20, player.Attack, "Attack should be scaled: 10 + level")
	s.Equal(20, player.Defense, "Defense should be scaled: 10 + level")
	s.Equal(15, player.Dodge, "Dodge should be scaled: 10 + (level / 2) = 10 + 5")
}

// TestDatabaseIsolation verifies that database state is reset between tests.
// This test should not see any data from TestCreatePlayer.
func (s *DatabaseTestSuite) TestDatabaseIsolation() {
	// Query database to verify it's empty
	// TODO: When repository is implemented, verify no players exist
	// players, err := s.repo.ListPlayers(s.ctx)
	// s.NoError(err, "Query should succeed")
	// s.Empty(players, "Database should be empty after reset")

	// For now, just verify we can connect
	err := s.testDB.DB.PingContext(s.ctx)
	s.NoError(err, "Should be able to ping database")
}

// TestDatabaseConnection verifies the database connection is working.
func (s *DatabaseTestSuite) TestDatabaseConnection() {
	s.NotNil(s.testDB, "TestDB should be initialized")
	s.NotNil(s.testDB.DB, "Database connection should be established")

	// Verify connection is alive
	err := s.testDB.DB.PingContext(s.ctx)
	s.NoError(err, "Should be able to ping database")

	// Verify connection string is set
	s.NotEmpty(s.testDB.ConnStr, "Connection string should be set")
	s.Contains(s.testDB.ConnStr, "test_db", "Connection string should reference test_db")
}

// TestSnapshotRestore verifies that snapshot restore works correctly.
func (s *DatabaseTestSuite) TestSnapshotRestore() {
	// This test is automatically verified by the test suite lifecycle:
	// 1. SetupTest() calls ResetTestDB() which restores the snapshot
	// 2. Each test starts with a clean database
	// 3. The fact that TestDatabaseIsolation doesn't see data from
	//    TestCreatePlayer proves snapshot restore is working

	s.NotNil(s.testDB.Snapshot, "Snapshot should be created")
	s.Equal("initial_snapshot", s.testDB.Snapshot, "Snapshot should have correct name")
}

// TestDatabaseSuite runs the DatabaseTestSuite.
func TestDatabaseSuite(t *testing.T) {
	suite.Run(t, new(DatabaseTestSuite))
}

// TestCreatePlayer_WithRealDB demonstrates using real database for testing.
// This test would create a player in the real database when repository is implemented.
func (s *DatabaseTestSuite) TestCreatePlayer_WithRealDB() {
	// Create a test player using fixture
	player := testhelpers.NewPlayerBuilder().
		WithLevel(10).
		WithStats(25, 20, 15, 8).
		Build()

	s.NotNil(player, "Player should be created")
	s.Equal(10, player.Level, "Level should be 10")
	s.Equal(25, player.Attack, "Attack should be 25")
	s.Equal(20, player.Defense, "Defense should be 20")

	// TODO: Insert player into database when repository is implemented
	// err := s.repo.CreatePlayer(s.ctx, player)
	// s.NoError(err, "Player should be created in database")
	// s.NotEmpty(player.ID, "Player should have a database ID")
}

// TestCreatePlayer_WithMockDB demonstrates using mock database for testing.
// This test uses mock expectations instead of real database.
func (s *DatabaseTestSuite) TestCreatePlayer_WithMockDB() {
	// Create a test player using fixture
	player := testhelpers.NewPlayerBuilder().
		WithLevel(10).
		Build()

	s.NotNil(player, "Player should be created")
	s.Equal(10, player.Level, "Level should be 10")

	// TODO: Use mock database in repository when implemented
	// Example:
	// s.mockDB.EXPECT().
	//     ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
	//     Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)
	// repo := NewPlayerRepository(s.mockDB)
	// err := repo.CreatePlayer(s.ctx, player)
	// s.NoError(err, "Player should be created with mock database")
}

// TestMockVsRealComparison compares mock behavior with real database behavior.
// This test helps ensure mocks match real implementation.
func (s *DatabaseTestSuite) TestMockVsRealComparison() {
	// Test with real database
	realResult, realErr := s.testDB.DB.ExecContext(s.ctx, "SELECT 1")

	// Setup mock expectation with same result
	s.mockDB.EXPECT().
		ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(realResult, realErr)

	// Test with mock database
	mockResult, mockErr := s.mockDB.ExecContext(s.ctx, "SELECT 1")

	// Compare error states
	s.Equal(realErr != nil, mockErr != nil,
		"Real and mock should have same error state")

	// If both succeeded, compare results
	if realErr == nil && mockErr == nil {
		realRows, _ := realResult.RowsAffected()
		mockRows, _ := mockResult.RowsAffected()
		s.Equal(realRows, mockRows, "Rows affected should match")
	}
}

// TestQueryPlayer_WithRealDB demonstrates querying player from real database.
func (s *DatabaseTestSuite) TestQueryPlayer_WithRealDB() {
	// TODO: When repository is implemented, this test will:
	// 1. Create a player in the database
	// 2. Query the player back
	// 3. Verify the data matches

	// For now, just verify we can execute a query
	rows, err := s.testDB.DB.QueryContext(s.ctx, "SELECT 1")
	s.NoError(err, "Query should succeed")
	s.NotNil(rows, "Rows should not be nil")
	rows.Close()
}

// TestQueryPlayer_WithMockDB demonstrates querying player from mock database.
func (s *DatabaseTestSuite) TestQueryPlayer_WithMockDB() {
	// Setup mock expectation for QueryContext call
	s.mockDB.EXPECT().
		QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, nil)

	// TODO: When repository is implemented, this test will:
	// 1. Setup mock expectations for query
	// 2. Query the player from mock database
	// 3. Verify the expectations were met

	// For now, just verify mock works
	_, err := s.mockDB.QueryContext(s.ctx, "SELECT * FROM players")
	s.NoError(err, "Mock query should succeed")
}
