// Package circuitbreaker provides circuit breaker implementation for fault tolerance.
package circuitbreaker

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// CircuitState represents the state of a circuit breaker.
type CircuitState int

const (
	// StateClosed - Circuit is closed, requests flow normally
	StateClosed CircuitState = iota
	// StateOpen - Circuit is open, requests are blocked
	StateOpen
	// StateHalfOpen - Circuit is testing if service recovered
	StateHalfOpen
)

func (s CircuitState) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	}
	return "UNKNOWN"
}

// CircuitBreakerConfig defines circuit breaker configuration.
type CircuitBreakerConfig struct {
	// FailureThreshold - number of failures before opening circuit
	FailureThreshold int
	// SuccessThreshold - number of successes in half-open state before closing
	SuccessThreshold int
	// Timeout - duration to wait before transitioning from open to half-open
	Timeout time.Duration
	// HalfOpenMaxRequests - maximum requests allowed in half-open state
	HalfOpenMaxRequests int
}

// DefaultConfig returns default circuit breaker configuration.
func DefaultConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold:    5,
		SuccessThreshold:    3,
		Timeout:             30 * time.Second,
		HalfOpenMaxRequests: 3,
	}
}

// CircuitBreaker implements the circuit breaker pattern.
type CircuitBreaker struct {
	name            string
	config          CircuitBreakerConfig
	state           CircuitState
	failures        int
	successes       int
	halfOpenReqs    int
	lastFailureTime time.Time
	lastStateChange time.Time
	mu              sync.RWMutex
	logger          runtime.Logger
	onStateChange   func(CircuitState, CircuitState)
}

// logDebug logs a debug message if logger is available.
func (cb *CircuitBreaker) logDebug(format string, args ...interface{}) {
	if cb.logger != nil {
		cb.logger.Debug(format, args...)
	}
}

// logInfo logs an info message if logger is available.
func (cb *CircuitBreaker) logInfo(format string, args ...interface{}) {
	if cb.logger != nil {
		cb.logger.Info(format, args...)
	}
}

// logError logs an error message if logger is available.
func (cb *CircuitBreaker) logError(format string, args ...interface{}) {
	if cb.logger != nil {
		cb.logger.Error(format, args...)
	}
}

// NewCircuitBreaker creates a new circuit breaker.
func NewCircuitBreaker(name string, config CircuitBreakerConfig, logger runtime.Logger) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:            name,
		config:          config,
		state:           StateClosed,
		lastStateChange: time.Now(),
		logger:          logger,
	}
	cb.logDebug("Circuit breaker '%s' created with config: %+v", name, config)
	return cb
}

// Execute executes a function with circuit breaker protection.
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	if err := cb.Allow(); err != nil {
		return err
	}

	err := fn()
	cb.RecordResult(err)
	return err
}

// ExecuteWithResult executes a function with circuit breaker protection and returns a result.
func (cb *CircuitBreaker) ExecuteWithResult(ctx context.Context, fn func() (interface{}, error)) (interface{}, error) {
	if err := cb.Allow(); err != nil {
		return nil, err
	}

	result, err := fn()
	cb.RecordResult(err)
	return result, err
}

// Allow checks if a request should be allowed through the circuit.
func (cb *CircuitBreaker) Allow() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return nil

	case StateOpen:
		// Check if timeout has elapsed
		if time.Since(cb.lastFailureTime) > cb.config.Timeout {
			cb.transitionTo(StateHalfOpen)
			cb.halfOpenReqs = 1
			return nil
		}
		return errors.New("circuit breaker is OPEN")

	case StateHalfOpen:
		// Allow limited requests in half-open state
		if cb.halfOpenReqs < cb.config.HalfOpenMaxRequests {
			cb.halfOpenReqs++
			return nil
		}
		return errors.New("circuit breaker is HALF_OPEN (max requests reached)")

	default:
		return errors.New("circuit breaker in unknown state")
	}
}

// RecordResult records the result of an operation.
func (cb *CircuitBreaker) RecordResult(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.failures++
		cb.logDebug("Circuit breaker '%s' recorded failure (%d/%d)", cb.name, cb.failures, cb.config.FailureThreshold)

		if cb.state == StateHalfOpen {
			// Any failure in half-open state opens the circuit
			cb.transitionTo(StateOpen)
		} else if cb.failures >= cb.config.FailureThreshold {
			cb.transitionTo(StateOpen)
		}
	} else {
		cb.successes++

		if cb.state == StateHalfOpen {
			cb.halfOpenReqs++
			if cb.successes >= cb.config.SuccessThreshold {
				cb.transitionTo(StateClosed)
			}
		}
	}
}

// RecordSuccess records a successful operation.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.RecordResult(nil)
}

// RecordFailure records a failed operation.
func (cb *CircuitBreaker) RecordFailure() {
	cb.RecordResult(errors.New("recorded failure"))
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// StateString returns the current state as a string.
func (cb *CircuitBreaker) StateString() string {
	return cb.State().String()
}

// Reset resets the circuit breaker to closed state.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.transitionTo(StateClosed)
	cb.failures = 0
	cb.successes = 0
	cb.halfOpenReqs = 0
}

// Stats returns circuit breaker statistics.
func (cb *CircuitBreaker) Stats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return map[string]interface{}{
		"name":               cb.name,
		"state":              cb.state.String(),
		"failures":           cb.failures,
		"successes":          cb.successes,
		"half_open_requests": cb.halfOpenReqs,
		"last_failure_time":  cb.lastFailureTime,
		"last_state_change":  cb.lastStateChange,
	}
}

// transitionTo transitions to a new state (must be called with lock held).
func (cb *CircuitBreaker) transitionTo(newState CircuitState) {
	oldState := cb.state
	cb.state = newState
	cb.lastStateChange = time.Now()

	cb.logInfo("Circuit breaker '%s' transitioned from %s to %s", cb.name, oldState, newState)

	if cb.onStateChange != nil {
		cb.onStateChange(oldState, newState)
	}

	// Reset counters on state transition
	if newState == StateClosed {
		cb.failures = 0
		cb.successes = 0
		cb.halfOpenReqs = 0
	} else if newState == StateHalfOpen {
		cb.successes = 0
		cb.halfOpenReqs = 0
	}
}

// SetOnStateChange sets a callback for state changes.
func (cb *CircuitBreaker) SetOnStateChange(callback func(CircuitState, CircuitState)) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.onStateChange = callback
}

// CircuitBreakerManager manages multiple circuit breakers.
type CircuitBreakerManager struct {
	breakers map[string]*CircuitBreaker
	mu       sync.RWMutex
	logger   runtime.Logger
}

// NewCircuitBreakerManager creates a new circuit breaker manager.
func NewCircuitBreakerManager(logger runtime.Logger) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*CircuitBreaker),
		logger:   logger,
	}
}

// GetOrCreate gets an existing circuit breaker or creates a new one.
func (m *CircuitBreakerManager) GetOrCreate(name string, config CircuitBreakerConfig) *CircuitBreaker {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cb, exists := m.breakers[name]; exists {
		return cb
	}

	cb := NewCircuitBreaker(name, config, m.logger)
	m.breakers[name] = cb
	return cb
}

// Get gets a circuit breaker by name.
func (m *CircuitBreakerManager) Get(name string) (*CircuitBreaker, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	cb, exists := m.breakers[name]
	return cb, exists
}

// GetAll returns all circuit breakers.
func (m *CircuitBreakerManager) GetAll() map[string]*CircuitBreaker {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]*CircuitBreaker, len(m.breakers))
	for k, v := range m.breakers {
		result[k] = v
	}
	return result
}

// Stats returns statistics for all circuit breakers.
func (m *CircuitBreakerManager) Stats() map[string]map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]map[string]interface{})
	for name, cb := range m.breakers {
		result[name] = cb.Stats()
	}
	return result
}
