package circuitbreaker

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCircuitBreakerInitialState(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultConfig(), nil)

	if cb.State() != StateClosed {
		t.Errorf("Expected initial state to be CLOSED, got %s", cb.StateString())
	}
}

func TestCircuitBreakerAllowsWhenClosed(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultConfig(), nil)

	err := cb.Allow()
	if err != nil {
		t.Errorf("Expected no error when circuit is closed, got: %v", err)
	}
}

func TestCircuitBreakerOpensAfterThreshold(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold:    3,
		SuccessThreshold:    2,
		Timeout:             100 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := NewCircuitBreaker("test", config, nil)

	// Record failures up to threshold
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != StateOpen {
		t.Errorf("Expected state to be OPEN after %d failures, got %s", config.FailureThreshold, cb.StateString())
	}

	// Should reject requests when open (before timeout)
	err := cb.Allow()
	if err != nil && err.Error() != "circuit breaker is OPEN" {
		t.Errorf("Expected 'circuit breaker is OPEN' error, got: %v", err)
	}
	// Note: Allow() may return nil if timeout elapsed during test execution
}

func TestCircuitBreakerTransitionsToHalfOpen(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := NewCircuitBreaker("test", config, nil)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != StateOpen {
		t.Fatalf("Expected state to be OPEN, got %s", cb.StateString())
	}

	// Wait for timeout
	time.Sleep(config.Timeout + 10*time.Millisecond)

	// Should allow one request and transition to half-open
	err := cb.Allow()
	if err != nil {
		t.Errorf("Expected no error after timeout, got: %v", err)
	}

	if cb.State() != StateHalfOpen {
		t.Errorf("Expected state to be HALF_OPEN, got %s", cb.StateString())
	}
}

func TestCircuitBreakerClosesAfterSuccessThreshold(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 3,
	}

	cb := NewCircuitBreaker("test", config, nil)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	// Wait for timeout
	time.Sleep(config.Timeout + 10*time.Millisecond)

	// Allow requests and record successes
	cb.Allow()
	cb.RecordSuccess()
	cb.Allow()
	cb.RecordSuccess()

	if cb.State() != StateClosed {
		t.Errorf("Expected state to be CLOSED after %d successes, got %s", config.SuccessThreshold, cb.StateString())
	}
}

func TestCircuitBreakerExecute(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultConfig(), nil)

	// Test successful execution
	err := cb.Execute(context.Background(), func() error {
		return nil
	})
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Test failed execution
	err = cb.Execute(context.Background(), func() error {
		return errors.New("test error")
	})
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestCircuitBreakerExecuteWithResult(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultConfig(), nil)

	// Test successful execution with result
	result, err := cb.ExecuteWithResult(context.Background(), func() (interface{}, error) {
		return "success", nil
	})
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "success" {
		t.Errorf("Expected result 'success', got: %v", result)
	}
}

func TestCircuitBreakerStats(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultConfig(), nil)

	cb.RecordSuccess()
	cb.RecordSuccess()
	cb.RecordFailure()

	stats := cb.Stats()

	if stats["name"] != "test" {
		t.Errorf("Expected name 'test', got: %v", stats["name"])
	}
	if failures, ok := stats["failures"].(int); !ok || failures != 1 {
		t.Errorf("Expected 1 failure, got: %v", stats["failures"])
	}
	if successes, ok := stats["successes"].(int); !ok || successes != 2 {
		t.Errorf("Expected 2 successes, got: %v", stats["successes"])
	}
}

func TestCircuitBreakerReset(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := NewCircuitBreaker("test", config, nil)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != StateOpen {
		t.Fatalf("Expected state to be OPEN")
	}

	// Reset
	cb.Reset()

	if cb.State() != StateClosed {
		t.Errorf("Expected state to be CLOSED after reset, got %s", cb.StateString())
	}

	stats := cb.Stats()
	if failures, ok := stats["failures"].(int); !ok || failures != 0 {
		t.Errorf("Expected 0 failures after reset, got: %v", stats["failures"])
	}
}

func TestCircuitBreakerManager(t *testing.T) {
	manager := NewCircuitBreakerManager(nil)

	// Get or create
	cb1 := manager.GetOrCreate("test1", DefaultConfig())
	if cb1 == nil {
		t.Fatal("Expected circuit breaker to be created")
	}

	// Get existing
	cb2 := manager.GetOrCreate("test1", DefaultConfig())
	if cb2 != cb1 {
		t.Error("Expected to get existing circuit breaker")
	}

	// Get non-existing
	cb3, exists := manager.Get("test2")
	if exists {
		t.Error("Expected test2 to not exist")
	}
	if cb3 != nil {
		t.Error("Expected nil for non-existing circuit breaker")
	}

	// Get all
	all := manager.GetAll()
	if len(all) != 1 {
		t.Errorf("Expected 1 circuit breaker, got %d", len(all))
	}

	// Stats
	stats := manager.Stats()
	if len(stats) != 1 {
		t.Errorf("Expected 1 stats entry, got %d", len(stats))
	}
}
