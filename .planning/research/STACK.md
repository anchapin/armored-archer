# Stack Research

**Domain:** Testing & QA Infrastructure for Go Backend and Godot Game Client
**Researched:** 2026-03-19
**Confidence:** HIGH

## Recommended Stack

### Core Testing Frameworks

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Go testing** | Built-in (Go 1.25+) | Standard Go testing framework | Native to Go, no dependencies, table-driven tests, subtests, parallel execution |
| **testify** | v1.11.1+ | Assertion library and test suites | Most popular Go testing toolkit, readable assertions, mock support, test suite organization |
| **GUT (Godot Unit Test)** | v9.5.0+ | Unit testing framework for Godot 4 | Native GDScript testing, comprehensive assertions, mocking, CI integration, JUnit XML output |
| **Go standard library** | testing/pprof | Benchmarking and profiling | Built-in profiling tools, CPU/memory analysis, bottleneck identification |

### Mocking and Test Doubles

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **testify/mock** | v1.11.1+ | Mock objects for Go interfaces | General mocking, expectation-based testing, when you need readable mock syntax |
| **gomock** | (deprecated, use uber/mock) | Interface-based mocking | AVOID - Officially deprecated June 2023, use uber/mock instead |
| **uber/mock** | Latest maintained fork | Interface-based mocking | When you need generated mocks for interfaces, better type safety than testify/mock |

### Load and Performance Testing

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **k6** | Latest (Grafana k6) | Load testing and performance benchmarking | For HTTP API load testing, developer-friendly JavaScript scripts, CI/CD integration |
| **vegeta** | v12+ | HTTP load testing tool | For constant request rate testing, UNIX-composable CLI, Prometheus integration |
| **Go benchmarking** | Built-in | Micro-benchmarks | For function-level performance testing, before/after comparisons |

### Code Coverage Tools

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **go test -cover** | Built-in | Code coverage for Go | Standard coverage reports, coverage profiles, HTML output |
| **gocov** | Latest | Coverage reporting | For aggregated coverage reports across multiple packages |
| **gocovmerge** | Latest | Merge coverage files | When combining coverage from multiple test runs |
| **GUT coverage** | Built-in to GUT | Godot test coverage | Line and function coverage for GDScript tests |

### Test Reporting and Visualization

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **JUnit XML** | Standard format | Test result format | CI/CD integration, test reporting dashboards |
| **go test -json** | Built-in | JSON test output | For parsing test results in CI/CD pipelines |
| **Prometheus metrics** | (already in stack) | Performance metrics | Track test execution time, performance regressions |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **mockgen** (from uber/mock) | Generate mock interfaces | Use `go generate` with `//go:generate mockgen` directives |
| **go test -race** | Race condition detection | Run regularly in CI, especially for concurrent code |
| **go test -shuffle** | Randomize test execution | Detect inter-test dependencies |
| **GUT CLI** | Run Godot tests from command line | Essential for CI/CD integration |

## Installation

### Go Backend Testing Tools

```bash
# Core testing (already in Go standard library)
# No installation needed for testing package

# Testify - assertions, mocks, suites
go get github.com/stretchr/testify@latest

# Uber Mock (maintained fork of gomock)
go install go.uber.org/mock/mockgen@latest
go get go.uber.org/mock@latest

# Coverage tools
go install github.com/axw/gocov/gocov@latest
go install github.com/wadey/gocovmerge@latest

# Load testing tools
go install github.com/tsenart/vegeta@latest
# k6 is installed separately (see below)
```

### Godot Client Testing Tools

```bash
# GUT (Godot Unit Test) - Install via Godot Asset Library
# 1. In Godot Editor: Project > Asset Library > Plugins
# 2. Search for "GUT" and install
# 3. Enable plugin in Project Settings > Plugins
#
# OR manually install:
# git clone https://github.com/bitwes/Gut.git addons/gut
# Then enable in Project Settings > Plugins

# GUT Command Line Interface (for CI/CD)
# Included with GUT addon, no separate installation needed
# Usage: godot --script addons/gut/gut_cmdln.gd -ginclude_subdirs
```

### Load Testing Tools

```bash
# k6 (JavaScript-based load testing)
# Linux
curl https://github.com/grafana/k6/releases/download/v0.54.0/k6-v0.54.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.54.0-linux-amd64/k6 /usr/local/bin/

# macOS
brew install k6

# Verify installation
k6 version

# Vegeta (Go-based load testing)
# Already installed above via go install
vegeta --version
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **testify** | Ginkgo (BDD framework) | Use Ginkgo for BDD-style tests, documentation-heavy tests, or when team prefers RSpec-style syntax |
| **k6** | Locust, JMeter | Use Locust for Python-based load testing, JMeter for legacy GUI-based testing (both less developer-friendly) |
| **GUT** | WAT (Godot testing framework) | AVOID - WAT is less maintained, fewer features, smaller community |
| **uber/mock** | testify/mock | Use testify/mock for simpler mocking needs without code generation |
| **Go built-in profiling** | pprof web UI | Use pprof web UI for interactive profiling sessions, flame graph visualization |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **golang/mock** | Officially deprecated June 2023, no longer maintained | uber/mock (maintained fork) |
| **Jest** (for Go) | Wrong language, meant for JavaScript/TypeScript | Go's built-in testing + testify |
| **WAT testing framework** | Less maintained, smaller community than GUT | GUT (Godot Unit Test) |
| **Manual test scripts** | Brittle, hard to maintain, no coverage reports | Proper test frameworks with assertions |
| **Testing without race detector** | Misses race conditions that only appear in production | Always run `go test -race` in CI |
| **Godot 3.x test frameworks** | Incompatible with Godot 4 | Use GUT 9.x for Godot 4 |

## Stack Patterns by Variant

**If testing Go Nakama modules:**
- Use `testify/assert` for readable assertions
- Use `testify/suite` for organizing integration tests
- Use `uber/mock` for mocking Nakama interfaces
- Run with `-race` flag to detect race conditions
- Because: Nakama is concurrent, race detection is critical

**If testing Godot autoloads:**
- Use GUT's `inner test classes` to group related tests
- Use GUT's `doubling` feature to mock autoload dependencies
- Use GUT's `parameterized tests` for testing multiple scenarios
- Because: Autoloads are global singletons, proper isolation is essential

**If load testing Nakama RPC endpoints:**
- Use k6 for HTTP-based load testing (simple scripts, good reporting)
- Use vegeta for constant request rate testing (better for stress testing)
- Monitor with Prometheus metrics already in stack
- Because: k6 is more developer-friendly, vegeta better for sustained load

**If testing combat calculations (Go backend):**
- Use table-driven tests with testify assertions
- Use Go benchmarks for performance-critical calculations
- Use property-based testing with rapid (optional)
- Because: Combat has many edge cases, table tests ensure coverage

**If testing UI components (Godot):**
- Use GUT's test doubles to mock user input
- Use GUT's signal spying to verify UI interactions
- Test in headless mode for CI/CD
- Because: UI tests need to verify user interactions without visual rendering

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Go 1.25+ | testify v1.11.1+ | Testify supports Go 1.19+, Go 1.25 is future-proof |
| GUT v9.5.0+ | Godot 4.5+ | GUT 9.x is for Godot 4.x, GUT 7.x is for Godot 3.x |
| uber/mock | Go 1.18+ | Requires Go modules, replaces deprecated golang/mock |
| k6 | All platforms | Single binary, no dependencies |
| vegeta v12+ | Go 1.20+ | Library and CLI versioned separately since v8.0.0 |

## Integration with Existing Stack

### Nakama Go Backend

```go
// Example: Testify + Uber Mock for Nakama module testing
package module_test

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/suite"
    "go.uber.org/mock/gomock"
    "github.com/heroiclabs/nakama-common/v3/go/api"
)

// Test suite for Nakama RPC module
type CombatModuleTestSuite struct {
    suite.Suite
    mockCtrl *gomock.Controller
    mockDb    *MockDatabase
}

func (s *CombatModuleTestSuite) SetupTest() {
    s.mockCtrl = gomock.NewController(s.T())
    s.mockDb = NewMockDatabase(s.mockCtrl)
}

func (s *CombatModuleTestSuite) TearDownTest() {
    s.mockCtrl.Finish()
}

func (s *CombatModuleTestSuite) TestCombatCalculation() {
    // Use testify assertions
    assert.Equal(s.T(), 100, calculateDamage(50, 2))
}
```

### Godot Client with GUT

```gdscript
# Example: GUT test for CombatManager
extends GutTest

var combat_manager: CombatManager

func before_each():
    combat_manager = CombatManager.new()

func test_damage_calculation():
    var damage = combat_manager.calculate_damage(50, 2.0)
    assert_eq(damage, 100, "Damage should be attack * multiplier")

func test_damage_with_zero_attack():
    var damage = combat_manager.calculate_damage(0, 2.0)
    assert_eq(damage, 0, "Zero attack should result in zero damage")

func test_damage_table-driven():
    var test_cases = [
        {attack = 100, mult = 1.5, expected = 150},
        {attack = 50, mult = 2.0, expected = 100},
        {attack = 75, mult = 1.0, expected = 75},
    ]

    for case_data in test_cases:
        var result = combat_manager.calculate_damage(case_data.attack, case_data.mult)
        assert_eq(result, case_data.expected, "Damage calculation failed")
```

### Load Testing with k6

```javascript
// Example: k6 load test for Nakama RPC endpoint
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

const NAKAMA_HOST = __ENV.NAKAMA_HOST || 'localhost';
const NAKAMA_PORT = __ENV.NAKAMA_PORT || '7350';

export default function () {
  // Test combat RPC endpoint
  let payload = JSON.stringify({
    attacker_id: "player1",
    defender_id: "player2",
    attack_power: 100,
  });

  let params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + __ENV.NAKAMA_SERVER_KEY,
    },
  };

  let res = http.post(
    `http://${NAKAMA_HOST}:${NAKAMA_PORT}/v2/rpc/combat_calculate`,
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has damage result': (r) => JSON.parse(r.body).damage !== undefined,
  });

  sleep(1);
}
```

### Load Testing with Vegeta

```bash
# Example: Vegeta load test for Nakama
# Create targets file: targets.txt
echo "POST http://localhost:7350/v2/rpc/combat_calculate
Content-Type: application/json
Authorization: Bearer defaultkey

{\"attacker_id\":\"player1\",\"defender_id\":\"player2\",\"attack_power\":100}" > targets.txt

# Run attack
vegeta attack -rate=100 -duration=30s -targets=targets.txt | tee results.bin | vegeta report

# Generate detailed reports
vegeta report -type=json results.bin > metrics.json
vegeta report -type=hist[0,50ms,100ms,200ms,500ms] results.bin
vegeta plot results.bin > plot.html
```

### CI/CD Integration

```yaml
# Example: GitHub Actions workflow for Go tests
name: Backend Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14-alpine
        env:
          POSTGRES_DB: nakama_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.25'
          cache: true

      - name: Install dependencies
        working-directory: ./backend
        run: |
          go mod download
          go install github.com/stretchr/testify/assert@latest
          go install go.uber.org/mock/mockgen@latest

      - name: Generate mocks
        working-directory: ./backend
        run: go generate ./...

      - name: Run tests with coverage
        working-directory: ./backend
        run: |
          go test -v -race -coverprofile=coverage.out -covermode=atomic ./...

      - name: Run benchmarks
        working-directory: ./backend
        run: go test -bench=. -benchmem ./...

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./backend/coverage.out
          flags: backend

      - name: Run load tests
        working-directory: ./backend
        run: |
          # Run k6 load tests
          k6 run --out json=load-test-results.json tests/load/combat_rpc.js
```

```yaml
# Example: GitHub Actions workflow for Godot tests
name: Godot Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Godot
        run: |
          wget -q https://github.com/godotengine/godot/releases/download/4.6-stable/Godot_v4.6-stable_linux.x86_64.zip
          unzip -q Godot_v4.6-stable_linux.x86_64.zip
          chmod +x Godot_v4.6-stable_linux.x86_64
          mv Godot_v4.6-stable_linux.x86_64 godot4

      - name: Run GUT tests
        run: |
          ./godot4 --headless --script addons/gut/gut_cmdln.gd \
            -ginclude_subdirs \
            -gdir=res://test/ \
            -gexit \
            -gjunit_xml_file=test-results/junit.xml

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: godot-test-results
          path: test-results/junit.xml
```

## Testing Strategy Recommendations

### 1. Unit Tests (80% of tests)
- **Go Backend**: Test individual functions, business logic, data validation
- **Godot Client**: Test autoload methods, utility functions, UI component logic
- **Tools**: testify (Go), GUT (Godot)
- **Coverage goal**: 80%+ for critical paths

### 2. Integration Tests (15% of tests)
- **Go Backend**: Test Nakama RPC handlers, database interactions, API contracts
- **Godot Client**: Test autoload interactions, scene loading, signal connections
- **Tools**: testify/suite (Go), GUT inner test classes (Godot)
- **Coverage goal**: Key workflows only

### 3. Load Tests (3% of tests)
- **Target**: Nakama RPC endpoints, database queries
- **Tools**: k6 for standard load tests, vegeta for stress tests
- **Frequency**: Run nightly, before releases
- **Metrics**: P95 latency < 500ms, error rate < 1%

### 4. Property-Based Tests (2% of tests)
- **Target**: Combat calculations, RNG systems, data serialization
- **Tools**: rapid (Go), custom property test helpers (Godot)
- **Goal**: Find edge cases that table-driven tests miss

### 5. End-to-End Tests (<1% of tests)
- **Target**: Critical user journeys (login → match → combat → rewards)
- **Tools**: Custom test harness, k6 scripts
- **Frequency**: Run in staging environment only

## Quality Gates

### Coverage Thresholds
- **Critical paths** (combat, matchmaking, progression): 90%+
- **Business logic** (gear system, seasons): 80%+
- **Infrastructure code** (logging, metrics): 60%+
- **UI components**: 70%+

### Performance Benchmarks
- **Combat calculations**: < 1ms per calculation
- **RPC handlers**: P95 < 100ms (excluding database)
- **Database queries**: P95 < 50ms for indexed queries
- **Load tests**: Handle 100 concurrent users with < 500ms P95 latency

### Flaky Test Detection
- **Retry strategy**: Run tests 3 times before failing
- **Quarantine**: Move flaky tests to separate suite
- **Fix time**: Critical flaky tests must be fixed within 1 sprint

## Sources

- [Testify GitHub](https://github.com/stretchr/testify) - HIGH confidence (official documentation)
- [GUT (Godot Unit Test) GitHub](https://github.com/bitwes/Gut) - HIGH confidence (official documentation)
- [k6 Documentation](https://k6.io/docs/) - HIGH confidence (official documentation)
- [Vegeta GitHub](https://github.com/tsenart/vegeta) - HIGH confidence (official documentation)
- [Go Testing Tutorial](https://go.dev/doc/tutorial/add-a-test) - HIGH confidence (official Go documentation)
- [Go Mock - Deprecated Notice](https://github.com/golang/mock) - HIGH confidence (official deprecation notice)
- [Uber Mock](https://go.uber.org/mock) - HIGH confidence (maintained fork of gomock)
- [gRPC Gateway](https://github.com/grpc-ecosystem/grpc-gateway) - MEDIUM confidence (for API testing context)

---
*Stack research for: Testing & QA Infrastructure*
*Researched: 2026-03-19*
