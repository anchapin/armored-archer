package circuitbreaker_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/circuitbreaker"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestCircuitBreakerInitialState(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker("test", circuitbreaker.DefaultConfig(), nil)

	testhelpers.AssertEqual(t, circuitbreaker.StateClosed, cb.State(),
		"Initial state should be CLOSED")
}

func TestCircuitBreakerAllowsWhenClosed(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker("test", circuitbreaker.DefaultConfig(), nil)

	err := cb.Allow()
	testhelpers.AssertNoError(t, err, "Should allow when closed")
}

func TestCircuitBreakerOpensAfterThreshold(t *testing.T) {
	config := circuitbreaker.CircuitBreakerConfig{
		FailureThreshold:    3,
		SuccessThreshold:    2,
		Timeout:             100 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := circuitbreaker.NewCircuitBreaker("test", config, nil)

	// Record failures up to threshold
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	testhelpers.AssertEqual(t, circuitbreaker.StateOpen, cb.State(),
		"Should be OPEN after 3 failures")

	// Should reject requests when open
	err := cb.Allow()
	testhelpers.AssertError(t, err, "Should error when open")
}

func TestCircuitBreakerTransitionsToHalfOpen(t *testing.T) {
	config := circuitbreaker.CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := circuitbreaker.NewCircuitBreaker("test", config, nil)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	testhelpers.AssertEqual(t, circuitbreaker.StateOpen, cb.State(),
		"Should be OPEN")

	// Wait for timeout
	time.Sleep(config.Timeout + 10*time.Millisecond)

	// Should allow one request and transition to half-open
	err := cb.Allow()
	testhelpers.AssertNoError(t, err, "Should allow after timeout")
	testhelpers.AssertEqual(t, circuitbreaker.StateHalfOpen, cb.State(),
		"Should be HALF_OPEN")
}

func TestCircuitBreakerClosesAfterSuccessThreshold(t *testing.T) {
	config := circuitbreaker.CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 3,
	}

	cb := circuitbreaker.NewCircuitBreaker("test", config, nil)

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

	testhelpers.AssertEqual(t, circuitbreaker.StateClosed, cb.State(),
		"Should be CLOSED after successes")
}

func TestCircuitBreakerExecute(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker("test", circuitbreaker.DefaultConfig(), nil)

	// Test successful execution
	err := cb.Execute(context.Background(), func() error {
		return nil
	})
	testhelpers.AssertNoError(t, err, "Should succeed")

	// Test failed execution
	err = cb.Execute(context.Background(), func() error {
		return errors.New("test error")
	})
	testhelpers.AssertError(t, err, "Should fail")
}

func TestCircuitBreakerExecuteWithResult(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker("test", circuitbreaker.DefaultConfig(), nil)

	// Test successful execution with result
	result, err := cb.ExecuteWithResult(context.Background(), func() (interface{}, error) {
		return "success", nil
	})
	testhelpers.AssertNoError(t, err, "Should succeed")
	testhelpers.AssertEqual(t, "success", result, "Result should match")
}

func TestCircuitBreakerStats(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker("test", circuitbreaker.DefaultConfig(), nil)

	cb.RecordSuccess()
	cb.RecordSuccess()
	cb.RecordFailure()

	stats := cb.Stats()

	testhelpers.AssertEqual(t, "test", stats["name"], "Name should match")
	testhelpers.AssertTrue(t, stats["failures"].(int) == 1, "Should have 1 failure")
	testhelpers.AssertTrue(t, stats["successes"].(int) == 2, "Should have 2 successes")
}

func TestCircuitBreakerReset(t *testing.T) {
	config := circuitbreaker.CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := circuitbreaker.NewCircuitBreaker("test", config, nil)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	testhelpers.AssertEqual(t, circuitbreaker.StateOpen, cb.State(),
		"Should be OPEN")

	// Reset
	cb.Reset()

	testhelpers.AssertEqual(t, circuitbreaker.StateClosed, cb.State(),
		"Should be CLOSED after reset")

	stats := cb.Stats()
	testhelpers.AssertTrue(t, stats["failures"].(int) == 0, "Should have 0 failures after reset")
}

func TestCircuitBreakerManager(t *testing.T) {
	manager := circuitbreaker.NewCircuitBreakerManager(nil)

	// Get or create
	cb1 := manager.GetOrCreate("test1", circuitbreaker.DefaultConfig())
	testhelpers.AssertNotNil(t, cb1, "Should create circuit breaker")

	// Get existing
	cb2 := manager.GetOrCreate("test1", circuitbreaker.DefaultConfig())
	testhelpers.AssertEqual(t, cb1, cb2, "Should get existing circuit breaker")

	// Get non-existing
	cb3, exists := manager.Get("test2")
	testhelpers.AssertFalse(t, exists, "Should not exist")
	testhelpers.AssertNil(t, cb3, "Should be nil")

	// Get all
	all := manager.GetAll()
	testhelpers.AssertEqual(t, 1, len(all), "Should have 1 circuit breaker")

	// Stats
	stats := manager.Stats()
	testhelpers.AssertEqual(t, 1, len(stats), "Should have 1 stats entry")
}

func TestDefaultConfig(t *testing.T) {
	config := circuitbreaker.DefaultConfig()

	testhelpers.AssertEqual(t, 5, config.FailureThreshold, "Default failure threshold should be 5")
	testhelpers.AssertEqual(t, 3, config.SuccessThreshold, "Default success threshold should be 3")
	testhelpers.AssertEqual(t, 30*time.Second, config.Timeout, "Default timeout should be 30s")
	testhelpers.AssertEqual(t, 3, config.HalfOpenMaxRequests, "Default half-open max requests should be 3")
}

func TestCircuitBreakerStateString(t *testing.T) {
	testhelpers.AssertEqual(t, "CLOSED", circuitbreaker.StateClosed.String(),
		"CLOSED state string should match")
	testhelpers.AssertEqual(t, "OPEN", circuitbreaker.StateOpen.String(),
		"OPEN state string should match")
	testhelpers.AssertEqual(t, "HALF_OPEN", circuitbreaker.StateHalfOpen.String(),
		"HALF_OPEN state string should match")
}

func TestCircuitBreakerRecordResult(t *testing.T) {
	config := circuitbreaker.CircuitBreakerConfig{
		FailureThreshold:    2,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	}

	cb := circuitbreaker.NewCircuitBreaker("test", config, nil)

	// Record success
	cb.RecordResult(nil)
	testhelpers.AssertEqual(t, circuitbreaker.StateClosed, cb.State(),
		"Should remain closed on success")

	// Record failures
	cb.RecordResult(errors.New("error 1"))
	cb.RecordResult(errors.New("error 2"))
	testhelpers.AssertEqual(t, circuitbreaker.StateOpen, cb.State(),
		"Should open after failures")
}
