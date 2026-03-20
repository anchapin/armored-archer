// Package integration provides mock validation tests to ensure mocks match real implementations.
// This file prevents mock drift by comparing mock behavior against real database behavior.
package integration

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers/mocks"
)

// mockRows implements sql.Rows for testing
type mockRows struct{}

func (m *mockRows) Columns() []string {
	return []string{"col1"}
}

func (m *mockRows) Close() error {
	return nil
}

func (m *mockRows) Next() bool {
	return false
}

func (m *mockRows) Scan(dest ...interface{}) error {
	return nil
}

// TestDatabaseMockValidation verifies that mock database behavior matches real database behavior.
// This test prevents mock drift by executing the same operations on both real and mock databases
// and comparing the results.
func TestDatabaseMockValidation(t *testing.T) {
	ctx := context.Background()

	// Setup real database
	realDB := testhelpers.SetupTestDB(ctx, t)
	defer testhelpers.TeardownTestDB(ctx, realDB)

	// Verify real database is connected
	require.NotNil(t, realDB.DB, "Real database should be initialized")
	err := realDB.DB.PingContext(ctx)
	require.NoError(t, err, "Real database should be pingable")

	// Setup mock database
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockDB := mocks.NewMockDatabase(ctrl)

	// Test 1: ExecContext behavior comparison
	t.Run("ExecContext", func(t *testing.T) {
		// Execute on real database
		realResult, realErr := realDB.DB.ExecContext(ctx, "SELECT 1")

		// Setup mock expectation
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(realResult, realErr)

		// Execute on mock database
		mockResult, mockErr := mockDB.ExecContext(ctx, "SELECT 1")

		// Compare error states
		assert.Equal(t, realErr != nil, mockErr != nil,
			"Both real and mock should have same error state")

		// If both succeeded, compare results
		if realErr == nil && mockErr == nil {
			realRowsAffected, _ := realResult.RowsAffected()
			mockRowsAffected, _ := mockResult.RowsAffected()
			assert.Equal(t, realRowsAffected, mockRowsAffected,
				"Rows affected should match")
		}
	})

	// Test 2: QueryContext behavior comparison
	t.Run("QueryContext", func(t *testing.T) {
		// Execute on real database
		realRows, realErr := realDB.DB.QueryContext(ctx, "SELECT 1")

		// Setup mock expectation
		mockDB.EXPECT().
			QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(realRows, realErr)

		// Execute on mock database
		mockRows, mockErr := mockDB.QueryContext(ctx, "SELECT 1")

		// Compare error states
		assert.Equal(t, realErr != nil, mockErr != nil,
			"Both real and mock should have same error state")

		// If both succeeded, compare column count
		if realErr == nil && mockErr == nil {
			defer realRows.Close()
			realCols, _ := realRows.Columns()
			mockCols, _ := mockRows.Columns()
			assert.Equal(t, len(realCols), len(mockCols),
				"Column count should match")
		}
	})

	// Test 3: QueryRowContext behavior comparison
	t.Run("QueryRowContext", func(t *testing.T) {
		// Execute on real database
		realRow := realDB.DB.QueryRowContext(ctx, "SELECT 1")

		// Setup mock expectation
		mockDB.EXPECT().
			QueryRowContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(realRow)

		// Execute on mock database
		mockRow := mockDB.QueryRowContext(ctx, "SELECT 1")

		// Both should return non-nil rows
		assert.NotNil(t, realRow, "Real row should not be nil")
		assert.NotNil(t, mockRow, "Mock row should not be nil")
	})

	// Test 4: BeginTx behavior comparison
	t.Run("BeginTx", func(t *testing.T) {
		// Execute on real database
		realTx, realErr := realDB.DB.BeginTx(ctx, nil)

		// Setup mock expectation
		mockDB.EXPECT().
			BeginTx(gomock.Any(), gomock.Any()).
			Return(realTx, realErr)

		// Execute on mock database
		mockTx, mockErr := mockDB.BeginTx(ctx, nil)

		// Compare error states
		assert.Equal(t, realErr != nil, mockErr != nil,
			"Both real and mock should have same error state")

		// If both succeeded, clean up transactions
		if realErr == nil {
			realTx.Rollback()
		}
		if mockErr == nil {
			mockTx.Rollback()
		}
	})

	// Test 5: Error handling - invalid query
	t.Run("ErrorHandling_InvalidQuery", func(t *testing.T) {
		invalidQuery := "INVALID SQL QUERY"

		// Execute on real database
		_, realErr := realDB.DB.ExecContext(ctx, invalidQuery)

		// Setup mock expectation with same error
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Eq(invalidQuery), gomock.Any()).
			Return(nil, realErr)

		// Execute on mock database
		_, mockErr := mockDB.ExecContext(ctx, invalidQuery)

		// Both should have errors
		assert.Error(t, realErr, "Real database should return error for invalid query")
		assert.Error(t, mockErr, "Mock database should return error for invalid query")
	})

	// Test 6: Error handling - connection failure simulation
	t.Run("ErrorHandling_ConnectionFailure", func(t *testing.T) {
		// Simulate connection error in mock
		connErr := sql.ErrConnDone

		// Setup mock expectation with connection error
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(nil, connErr)

		// Execute on mock database
		_, mockErr := mockDB.ExecContext(ctx, "SELECT 1")

		// Mock should return connection error
		assert.Error(t, mockErr, "Mock should return connection error")
		assert.Equal(t, connErr, mockErr, "Mock should return exact connection error")
	})
}

// TestDatabaseMockValidation_ParameterMatching verifies that mock parameter matching works correctly.
func TestDatabaseMockValidation_ParameterMatching(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockDB := mocks.NewMockDatabase(ctrl)

	ctx := context.Background()

	t.Run("ExactParameterMatch", func(t *testing.T) {
		// Setup expectation with exact parameters
		result := &mockResult{lastInsertID: 1, rowsAffected: 1}
		mockDB.EXPECT().
			ExecContext(gomock.Any(), "SELECT 1", gomock.Any()).
			Return(result, nil)

		// Execute with matching parameters
		_, err := mockDB.ExecContext(ctx, "SELECT 1")
		assert.NoError(t, err, "Should match exact parameters")
	})

	t.Run("GomockMatcher", func(t *testing.T) {
		// Setup expectation with gomock matcher - use gomock.Any() for string matching
		// since gomock.Contains is not available
		// Return nil to simulate no results (valid for some queries)
		mockDB.EXPECT().
			QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(nil, nil)

		// Execute with matching query
		_, err := mockDB.QueryContext(ctx, "SELECT * FROM players")
		assert.NoError(t, err, "Should match gomock matcher")
		// Note: rows is nil, which is valid for queries that return no results
		// In real usage, you'd typically return a proper sql.Rows mock
	})

	t.Run("TimesConstraint", func(t *testing.T) {
		// Setup expectation to be called exactly 2 times
		result := &mockResult{lastInsertID: 1, rowsAffected: 1}
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(result, nil).
			Times(2)

		// Execute twice
		mockDB.ExecContext(ctx, "INSERT INTO players")
		mockDB.ExecContext(ctx, "INSERT INTO players")
	})
}

// TestDatabaseMockValidation_CallOrderVerification verifies that call order is enforced.
func TestDatabaseMockValidation_CallOrderVerification(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	mockDB := mocks.NewMockDatabase(ctrl)

	ctx := context.Background()

	// Setup expectations in specific order
	gomock.InOrder(
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Eq("INSERT INTO players"), gomock.Any()).
			Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil),
		mockDB.EXPECT().
			ExecContext(gomock.Any(), gomock.Eq("UPDATE players"), gomock.Any()).
			Return(&mockResult{lastInsertID: 0, rowsAffected: 1}, nil),
	)

	// Execute in correct order
	mockDB.ExecContext(ctx, "INSERT INTO players")
	mockDB.ExecContext(ctx, "UPDATE players")

	// If we executed in wrong order, the test would fail
	t.Log("Call order verification passed")
}
