// Package testhelpers provides test helpers for integration tests.
package testhelpers

import (
	"fmt"
	"time"
)

// TestUser represents a test user.
type TestUser struct {
	ID       string
	Username string
}

// NewTestUser creates a new test user.
func NewTestUser(id, username string) *TestUser {
	return &TestUser{
		ID:       id,
		Username: username,
	}
}

// GenerateTestID generates a unique test ID.
func GenerateTestID(prefix string) string {
	return fmt.Sprintf("%s_test_%d", prefix, time.Now().UnixNano())
}

// AssertEqual asserts that two values are equal.
func AssertEqual[T any](t TestingT, expected, actual T, message string) {
	t.Helper()
	if any(expected) != any(actual) {
		t.Errorf("%s: expected %v, got %v", message, expected, actual)
	}
}

// AssertNotEqual asserts that two values are not equal.
func AssertNotEqual[T any](t TestingT, expected, actual T, message string) {
	t.Helper()
	if any(expected) == any(actual) {
		t.Errorf("%s: expected different values, got %v", message, expected)
	}
}

// AssertTrue asserts that a condition is true.
func AssertTrue(t TestingT, condition bool, message string) {
	t.Helper()
	if !condition {
		t.Errorf("%s: expected true, got false", message)
	}
}

// AssertFalse asserts that a condition is false.
func AssertFalse(t TestingT, condition bool, message string) {
	t.Helper()
	if condition {
		t.Errorf("%s: expected false, got true", message)
	}
}

// AssertNil asserts that a value is nil.
func AssertNil(t TestingT, value interface{}, message string) {
	t.Helper()
	if value != nil {
		t.Errorf("%s: expected nil, got %v", message, value)
	}
}

// AssertNotNil asserts that a value is not nil.
func AssertNotNil(t TestingT, value interface{}, message string) {
	t.Helper()
	if value == nil {
		t.Errorf("%s: expected non-nil value", message)
	}
}

// AssertError asserts that an error occurred.
func AssertError(t TestingT, err error, message string) {
	t.Helper()
	if err == nil {
		t.Errorf("%s: expected error, got nil", message)
	}
}

// AssertNoError asserts that no error occurred.
func AssertNoError(t TestingT, err error, message string) {
	t.Helper()
	if err != nil {
		t.Errorf("%s: expected no error, got %v", message, err)
	}
}

// TestingT is a minimal interface compatible with testing.T and testify.
type TestingT interface {
	Helper()
	Errorf(format string, args ...interface{})
	Fatalf(format string, args ...interface{})
	FailNow()
}

// MockTimer provides a mock timer for testing.
type MockTimer struct {
	CurrentTime time.Time
}

// NewMockTimer creates a new mock timer.
func NewMockTimer(startTime time.Time) *MockTimer {
	return &MockTimer{
		CurrentTime: startTime,
	}
}

// Now returns the current mock time.
func (m *MockTimer) Now() time.Time {
	return m.CurrentTime
}

// Advance advances the mock time by the given duration.
func (m *MockTimer) Advance(d time.Duration) {
	m.CurrentTime = m.CurrentTime.Add(d)
}

// SetTime sets the mock time to a specific time.
func (m *MockTimer) SetTime(t time.Time) {
	m.CurrentTime = t
}

// TestTable represents a table-driven test case.
type TestTable[T any] struct {
	Name     string
	Input    T
	Expected T
	HasError bool
}

// RunTableTests runs table-driven tests.
func RunTableTests[T any](t TestingT, tests []TestTable[T], testFunc func(T) (T, error)) {
	t.Helper()
	for _, tt := range tests {
		tt := tt // capture range variable
		result, err := testFunc(tt.Input)
		
		if tt.HasError {
			AssertError(t, err, tt.Name)
		} else {
			AssertNoError(t, err, tt.Name)
			AssertEqual(t, tt.Expected, result, tt.Name)
		}
	}
}
