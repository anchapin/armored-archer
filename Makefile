# Armored Archer - Makefile
# Single command setup for development environment

# Project directories
BACKEND_DIR := backend

# Colors for output
GREEN := $(shell tput setaf 2 2>/dev/null || echo "")
BLUE := $(shell tput setaf 4 2>/dev/null || echo "")
YELLOW := $(shell tput setaf 3 2>/dev/null || echo "")
RESET := $(shell tput sgr0 2>/dev/null || echo "")

.PHONY: help setup backend-install backend-start backend-stop backend-dev backend-test backend-build backend-lint backend-check backend-migrate backend-migrate-new backend-db-schema backend-load-test benchmark benchmark-compare benchmark-update clean release-notes test-flaky-backend test-flaky-godot test-flaky-report check-test-pyramid check-test-pyramid-json check-test-pyramid-ci build-perf-track rollback services-start services-stop services-restart services-status services-health services-logs services-validate services-clean tech-debt-check tech-debt-check-ci tech-debt-sync tech-debt-sync-dry tech-debt-github tech-debt-github-create bundle-size-check agents-md-check agents-md-check-ci dead-code-check dead-code-check-ci duplicate-code-check duplicate-code-check-ci generate-mocks beta-start beta-stop beta-restart beta-status beta-health beta-logs beta-validate beta-clean beta-migrate beta-test test-all test coverage coverage-backend coverage-frontend coverage-html analyze-gaps test-property test-property-combat test-property-rng mutation-install mutation-test mutation-test-quick

# Default target
all: help

## ⚡ Setup & Installation
help:
	@echo ""
	@echo "$(BLUE)Armored Archer - Development Commands$(RESET)"
	@echo ""
	@echo "$(GREEN)Setup & Installation$(RESET)"
	@echo "  make setup              Install all dependencies (npm + Godot)"
	@echo ""
	@echo "$(GREEN)Backend Commands$(RESET)"
	@echo "  make backend-start      Start Nakama backend with Docker"
	@echo "  make backend-stop        Stop backend services"
	@echo "  make backend-dev        Start backend with auto-reload"
	@echo "  make backend-test       Run TypeScript backend tests"
	@echo "  make backend-test-go    Run Go backend tests"
	@echo "  make test-all           Run unified test suite (parallel)"
	@echo "  make test               Run unified test suite (alias for test-all)"
	@echo "  make test-parallel      Run tests with parallel execution"
	@echo "  make test-parallel-go   Run only Go tests in parallel"
	@echo "  make test-parallel-jest Run only Jest tests in parallel"
	@echo "  make backend-build      Build TypeScript backend"
	@echo "  make backend-build-go   Build Go backend"
	@echo "  make backend-lint       Lint TypeScript backend code"
	@echo "  make backend-lint-go    Lint Go backend code"
	@echo "  make backend-fmt-go     Format Go code"
	@echo "  make backend-check      Run TypeScript linting and type checking"
	@echo "  make generate-mocks     Generate mocks from interfaces"
	@echo ""
	@echo "$(GREEN)Flaky Test Detection$(RESET)"
	@echo "  make test-flaky-backend     Run flaky test detection for backend"
	@echo "  make test-flaky-godot      Run flaky test detection for Godot"
	@echo "  make test-flaky-mark       Mark flaky tests for quarantine"
	@echo "  make test-flaky-mark-dry  Preview quarantine changes (dry run)"
	@echo "  make test-flaky-detect-mark Detect and mark flaky tests (auto)"
	@echo "  make test-flaky-quarantine-list List quarantined tests"
	@echo "  make test-flaky-report      Generate flaky test report"
	@echo "  make test-property       Run property-based tests (all)"
	@echo "  make test-property-combat Run combat property tests"
	@echo "  make test-property-rng   Run RNG property tests"
	@echo ""
	@echo "$(GREEN)Mutation Testing$(RESET)"
	@echo "  make mutation-install    Install go-mutesting tool"
	@echo "  make mutation-test       Run mutation tests on all packages"
	@echo "  make mutation-test-quick  Run mutation tests on critical packages only"
	@echo ""
	@echo "$(GREEN)Test Pyramid Validation$(RESET)"
	@echo "  make check-test-pyramid      Validate test pyramid (70/20/10 ratio)"
	@echo "  make check-test-pyramid-json Validate pyramid with JSON output"
	@echo "  make check-test-pyramid-ci   Validate pyramid in CI mode"
	@echo ""
	@echo "$(GREEN)Coverage Reporting$(RESET)"
	@echo "  make coverage            Generate coverage reports (backend + frontend)"
	@echo "  make coverage-backend    Generate Go backend coverage with HTML report"
	@echo "  make coverage-frontend   Generate Godot frontend coverage (pass rate proxy)"
	@echo "  make coverage-html       Open HTML coverage report in browser"
	@echo "  make analyze-gaps       Identify functions with 0% coverage"
	@echo "  make coverage-gates      Enforce coverage thresholds (stage configurable)"
	@echo "  make coverage-gate-critical Enforce only critical path threshold"
	@echo "  make coverage-threshold-check Show current coverage vs all threshold stages"
	@echo "  make coverage-baseline-update Update package baselines from current coverage"
	@echo "  make coverage-history     Track coverage in history and show trend"
	@echo "  make coverage-dashboard  Generate coverage dashboard HTML"
	@echo "  make verify-cicd        Verify CI/CD coverage integration"
	@echo "  make verify-phase-12    Verify Phase 12 completion status"
	@echo ""
	@echo "$(GREEN)Build Performance$(RESET)"
	@echo "  make build-perf-track   View build performance metrics"
	@echo ""
	@echo "$(GREEN)Deployment$(RESET)"
	@echo "  make rollback          Show rollback automation help"
	@echo ""
	@echo "$(GREEN)Database Commands$(RESET)"
	@echo "  make backend-migrate    Run database migrations"
	@echo "  make backend-migrate-new Create new migration file"
	@echo "  make backend-db-schema   Display current database schema"
	@echo ""
	@echo "$(GREEN)Load Testing$(RESET)"
	@echo "  make backend-load-test  Run full load test (500 users)"
	@echo ""
	@echo "$(GREEN)Performance Benchmarking$(RESET)"
	@echo "  make benchmark             Run Go benchmarks with slow test detection"
	@echo "  make benchmark-slow       Identify slow benchmarks (>100ms)"
	@echo "  make benchmark-compare   Compare to baseline"
	@echo "  make benchmark-update     Update performance baseline"
	@echo "  make benchmark-history    Show performance history"
	@echo ""
	@echo "$(GREEN)Local Services$(RESET)"
	@echo "  make services-start     Start Nakama + PostgreSQL containers"
	@echo "  make services-stop      Stop all service containers"
	@echo "  make services-restart  Restart all services"
	@echo "  make services-status    Show service status"
	@echo "  make services-health   Check service health"
	@echo "  make services-logs     View service logs"
	@echo "  make services-validate Validate prerequisites"
	@echo "  make services-clean    Stop and remove services + volumes"
	@echo ""
	@echo "$(GREEN)Development$(RESET)"
	@echo "  make dev                Start development (backend with auto-reload)"
	@echo "  make clean              Clean build artifacts"
	@echo ""
	@echo "$(GREEN)Release Notes$(RESET)"
	@echo "  make release-notes      Generate release notes from git history"
	@echo ""
	@echo "$(GREEN)Tech Debt Tracking$(RESET)"
	@echo "  make tech-debt-check      Run tech debt detection and generate report"
	@echo "  make tech-debt-check-ci  Run tech debt detection in CI mode"
	@echo ""
	@echo "$(GREEN)Dead Code Detection$(RESET)"
	@echo "  make dead-code-check     Run dead code detection for all languages"
	@echo "  make dead-code-check-ci  Run dead code detection in CI mode (strict)"
	@echo ""
	@echo "$(GREEN)Duplicate Code Detection$(RESET)"
	@echo "  make duplicate-code-check     Run duplicate code detection for all languages"
	@echo "  make duplicate-code-check-ci  Run duplicate code detection in CI mode (strict)"
	@echo ""
	@echo "$(GREEN)AGENTS.md Validation$(RESET)"
	@echo "  make agents-md-check     Validate AGENTS.md format and structure"
	@echo "  make agents-md-check-ci Validate AGENTS.md in CI mode"
	@echo ""
	@echo "$(GREEN)Beta Environment$(RESET)"
	@echo "  make beta-start         Start beta environment (Nakama + PostgreSQL + monitoring)"
	@echo "  make beta-stop          Stop beta environment"
	@echo "  make beta-restart       Restart beta environment"
	@echo "  make beta-status        Show beta service status"
	@echo "  make beta-health        Check beta service health"
	@echo "  make beta-test          Run automated beta health tests"
	@echo "  make beta-logs          View beta service logs"
	@echo "  make beta-validate      Validate beta environment setup"
	@echo "  make beta-clean         Stop and remove beta services + volumes"
	@echo "  make beta-migrate       Run database migrations on beta"
	@echo ""
	@echo "$(GREEN)Notes$(RESET)"
	@echo "  - Godot: Open project in Godot 4.x Editor and press F5 to run"
	@echo "  - Nakama Console: http://localhost:7351 (admin:password)"
	@echo "  - Beta Console: http://localhost:7351 (admin:beta_admin_secure_password)"
	@echo ""

setup: backend-install
	@echo ""
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "Next steps:"
	@echo "  1. Start backend: $(YELLOW)make backend-start$(RESET)"
	@echo "  2. Run Godot: Open in Godot Editor and press F5"
	@echo ""

backend-install:
	@echo "$(BLUE)Installing backend dependencies...$(RESET)"
	cd $(BACKEND_DIR) && npm install

## Backend Commands
backend-start:
	@echo "$(BLUE)Starting Nakama backend...$(RESET)"
	cd $(BACKEND_DIR) && docker compose up -d
	@echo "$(GREEN)Nakama started: http://localhost:7350$(RESET)"
	@echo "$(GREEN)Admin Console: http://localhost:7351 (admin:password)$(RESET)"

backend-stop:
	@echo "$(BLUE)Stopping backend...$(RESET)"
	cd $(BACKEND_DIR) && docker compose down

backend-dev:
	@echo "$(BLUE)Starting backend with auto-reload...$(RESET)"
	cd $(BACKEND_DIR) && npm run dev

backend-test:
	@echo "$(BLUE)Running TypeScript backend tests...$(RESET)"
	cd $(BACKEND_DIR) && npm test

backend-test-go:
	@echo "$(BLUE)Running Go backend tests...$(RESET)"
	cd $(BACKEND_DIR) && go test ./...

test-all:
	@echo "$(BLUE)Running unified test suite (parallel)...$(RESET)"
	@./scripts/run-parallel-tests.sh

test: test-all

test-parallel:
	@echo "$(BLUE)Running tests with parallel execution...$(RESET)"
	@./scripts/run-parallel-tests.sh

test-parallel-go:
	@echo "$(BLUE)Running Go tests in parallel...$(RESET)"
	@./scripts/run-parallel-tests.sh --go-only

test-parallel-jest:
	@echo "$(BLUE)Running Jest tests in parallel...$(RESET)"
	@./scripts/run-parallel-tests.sh --jest-only

backend-build:
	@echo "$(BLUE)Building TypeScript backend...$(RESET)"
	cd $(BACKEND_DIR) && npm run build

backend-build-go:
	@echo "$(BLUE)Building Go backend...$(RESET)"
	cd $(BACKEND_DIR) && ./build-go.sh

backend-lint:
	@echo "$(BLUE)Linting TypeScript backend code...$(RESET)"
	cd $(BACKEND_DIR) && npm run lint

backend-lint-go:
	@echo "$(BLUE)Linting Go backend code...$(RESET)"
	cd $(BACKEND_DIR) && golangci-lint run || echo "$(YELLOW)golangci-lint not installed. Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest$(RESET)"

backend-fmt-go:
	@echo "$(BLUE)Formatting Go code...$(RESET)"
	cd $(BACKEND_DIR) && go fmt ./...

backend-check:
	@echo "$(BLUE)Running linting and type checking...$(RESET)"
	cd $(BACKEND_DIR) && npm run lint && npm run typecheck

generate-mocks:
	@echo "$(BLUE)Generating mocks from interfaces...$(RESET)"
	@command -v mockgen >/dev/null 2>&1 || { \
		echo "$(YELLOW)mockgen not found. Installing...$(RESET)"; \
		go install go.uber.org/mock/mockgen@latest; \
	}
	@export PATH=$$PATH:$$HOME/go/bin && \
	mockgen -source=$(BACKEND_DIR)/internal/database/database.go \
		-destination=$(BACKEND_DIR)/tests/testhelpers/mocks/database_mock.go \
		-package=mocks && \
	mockgen -source=$(BACKEND_DIR)/internal/runtime/nakama.go \
		-destination=$(BACKEND_DIR)/tests/testhelpers/mocks/logger_mock.go \
		-package=mocks
	@echo "$(GREEN)✓ Mocks generated successfully$(RESET)"

dev: backend-dev

## Cleanup
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(RESET)"
	cd $(BACKEND_DIR) && rm -rf build/ coverage/ test-results.txt
	@echo "$(GREEN)✓ Clean complete$(RESET)"

## Database Commands
backend-migrate:
	@echo "$(BLUE)Running database migrations...$(RESET)"
	@docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres://postgres:localdbpassword@postgres:5432/nakama || echo "$(YELLOW)Make sure backend is running: make backend-start$(RESET)"

backend-migrate-new:
	@echo "$(BLUE)Creating new migration file...$(RESET)"
	@read -p "Migration name (e.g., create_users_table): " MIGRATION_NAME; \
	if [ -z "$$MIGRATION_NAME" ]; then \
		echo "$(YELLOW)Migration name required$(RESET)"; \
		exit 1; \
	fi; \
	NEXT_NUM=$$(ls -1 $(BACKEND_DIR)/data/*.sql 2>/dev/null | tail -1 | sed 's/.*\/\([0-9]*\)_.*/\1/' | head -1); \
	if [ -z "$$NEXT_NUM" ]; then NEXT_NUM=0; fi; \
	NEXT_NUM=$$((NEXT_NUM + 1)); \
	TIMESTAMP=$$(date +%Y%m%d%H%M%S); \
	FILENAME=$(BACKEND_DIR)/data/$${NEXT_NUM}_$${MIGRATION_NAME}.sql; \
	echo "-- Migration: $$MIGRATION_NAME" > "$$FILENAME"; \
	echo "-- Created: $$(date)" >> "$$FILENAME"; \
	echo "" >> "$$FILENAME"; \
	echo "BEGIN;" >> "$$FILENAME"; \
	echo "" >> "$$FILENAME"; \
	echo "-- Add your SQL here" >> "$$FILENAME"; \
	echo "" >> "$$FILENAME"; \
	echo "COMMIT;" >> "$$FILENAME"; \
	echo "$(GREEN)Created: $$FILENAME$(RESET)"

backend-db-schema:
	@echo "$(BLUE)Current database schema...$(RESET)"
	@docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt' 2>/dev/null || echo "$(YELLOW)Make sure backend is running: make backend-start$(RESET)"

## Load Testing
backend-load-test:
	@echo "$(BLUE)Running full load test (500 users)...$(RESET)"
	@if [ ! -f .k6-bin/k6 ]; then \
		echo "$(YELLOW)k6 not found. Installing locally...$(RESET)"; \
		mkdir -p .k6-bin; \
		curl -L https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz | tar xvz -C .k6-bin --strip-components=1; \
	fi
	cd backend/tests/load && ../../../.k6-bin/k6 run k6.conf.js

## Performance Benchmarking
benchmark:
	@echo "$(BLUE)Running Go benchmarks with slow test detection...$(RESET)"
	@./scripts/benchmark-tests.sh

benchmark-slow:
	@echo "$(BLUE)Identifying slow benchmarks (>100ms)...$(RESET)"
	@./scripts/benchmark-tests.sh | grep -A 20 "Slow Benchmark Detection"

benchmark-compare:
	@echo "$(BLUE)Running benchmarks and comparing to baseline...$(RESET)"
	@./scripts/benchmark-tests.sh --compare

benchmark-update:
	@echo "$(BLUE)Updating performance baseline...$(RESET)"
	@./scripts/benchmark-tests.sh --update-baseline

benchmark-history:
	@echo "$(BLUE)Showing performance history...$(RESET)"
	@./scripts/benchmark-tests.sh --history

## Release Notes
release-notes:
	@echo "$(BLUE)Generating release notes...$(RESET)"
	@python3 scripts/generate_release_notes.py

## Flaky Test Detection
test-flaky-backend:
	@echo "$(BLUE)Running backend flaky test detection...$(RESET)"
	cd $(BACKEND_DIR) && npm run test:flaky

test-flaky-godot:
	@echo "$(BLUE)Running Godot flaky test detection...$(RESET)"
	python3 scripts/detect_godot_flaky_tests.py

test-flaky-report:
	@echo "$(BLUE)Generating flaky test report...$(RESET)"
	cd $(BACKEND_DIR) && npm run test:report

test-flaky-mark:
	@echo "$(BLUE)Marking flaky tests for quarantine...$(RESET)"
	@bash scripts/mark-flaky-tests.sh

test-flaky-mark-dry:
	@echo "$(BLUE)Previewing flaky test quarantine (dry run)...$(RESET)"
	@bash scripts/mark-flaky-tests.sh --dry-run

test-flaky-detect-mark:
	@echo "$(BLUE)Detecting and marking flaky tests...$(RESET)"
	@cd backend && bash ../scripts/detect-go-flaky-tests.sh 3 0.33 --auto-mark
	@python3 scripts/detect-godot-flaky-tests.py --runs=3

test-flaky-quarantine-list:
	@echo "$(BLUE)Quarantined tests:$(RESET)"
	@if [ -f data/flaky-test-quarantine.json ]; then \
		cat data/flaky-test-quarantine.json | jq -r 'to_entries[] | "\(.key) - \(.value.reason)"'; \
	else \
		echo "No quarantine registry found"; \
	fi

check-test-pyramid:
	@echo "$(BLUE)Validating test pyramid ratios...$(RESET)"
	@./scripts/check-test-pyramid.sh

check-test-pyramid-json:
	@echo "$(BLUE)Running test pyramid validation (JSON output)...$(RESET)"
	@./scripts/check-test-pyramid.sh --json
	@echo "$(GREEN)✓ Pyramid results written to data/test-pyramid-results.json$(RESET)"

check-test-pyramid-ci:
	@echo "$(BLUE)Running test pyramid validation (CI mode)...$(RESET)"
	@./scripts/check-test-pyramid.sh --ci
	@echo "$(GREEN)✓ Pyramid validation complete$(RESET)"

## Build Performance Tracking
build-perf-track:
	@echo "$(BLUE)Viewing build performance metrics...$(RESET)"
	@if [ -f .build-metrics/history.json ]; then \
		cat .build-metrics/history.json | jq -r '.[] | "Date: \(.date) | Build: \(.build_time) min | Test: \(.test_time) min | Commit: \(.commit[0:7])"'; \
	else \
		echo "$(YELLOW)No build metrics found. Run the build-performance workflow first.$(RESET)"; \
	fi

## Rollback Automation
rollback:
	@echo "$(BLUE)Rollback Automation$(RESET)"
	@echo ""
	@echo "To trigger a rollback, use GitHub Actions workflow_dispatch:"
	@echo "  1. Go to: Actions > Rollback Automation"
	@echo "  2. Select workflow: Rollback Automation"
	@echo "  3. Click 'Run workflow'"
	@echo ""
	@echo "Or use GitHub CLI:"
	@echo "  gh workflow run rollback.yml -f environment=staging -f reason='Hotfix' -f rollback_type=full"
	@echo ""
	@echo "Rollback types:"
	@echo "  - full: Rollback all components (database, nakama, godot)"
	@echo "  - database: Rollback database migrations only"
	@echo "  - nakama: Rollback Nakama server only"

## Local Services Management
services-start:
	@echo "$(BLUE)Starting local services (Nakama + PostgreSQL)...$(RESET)"
	cd $(BACKEND_DIR) && docker compose up -d
	@echo "$(GREEN)✓ Services started$(RESET)"
	@echo "  - Nakama API:     http://localhost:7350"
	@echo "  - Nakama Console: http://localhost:7351 (admin:password)"
	@echo "  - PostgreSQL:    localhost:5432"
	@echo ""
	@echo "Run 'make services-health' to verify services are healthy."

services-stop:
	@echo "$(BLUE)Stopping local services...$(RESET)"
	cd $(BACKEND_DIR) && docker compose down
	@echo "$(GREEN)✓ Services stopped$(RESET)"

services-restart:
	@echo "$(BLUE)Restarting local services...$(RESET)"
	cd $(BACKEND_DIR) && docker compose restart
	@echo "$(GREEN)✓ Services restarted$(RESET)"

services-status:
	@echo "$(BLUE)Local Services Status:$(RESET)"
	cd $(BACKEND_DIR) && docker compose ps

services-health:
	@echo "$(BLUE)Running health checks...$(RESET)"
	@echo ""
	@echo "$(BLUE)Container Status:$(RESET)"
	@docker ps --filter "name=armored" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
	@echo ""
	@echo -n "$(BLUE)Checking Nakama API: $(RESET)"
	@curl -s --max-time 5 http://localhost:7350/ > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || echo "$(YELLOW)Not responding$(RESET)"
	@echo -n "$(BLUE)Checking PostgreSQL: $(RESET)"
	@docker exec armored_archer_db pg_isready -U postgres > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || (docker exec $$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1) pg_isready -U postgres > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || echo "$(YELLOW)Not responding$(RESET)")

services-logs:
	@echo "$(BLUE)Viewing service logs (Ctrl+C to exit)...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose logs -f

services-validate:
	@echo "$(BLUE)Validating local services setup...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking prerequisites...$(RESET)"
	@command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓ Docker installed$(RESET)" || echo "$(YELLOW)✗ Docker not found$(RESET)"
	@command -v docker-compose >/dev/null 2>&1 && echo "$(GREEN)✓ Docker Compose installed$(RESET)" || echo "$(YELLOW)✗ Docker Compose not found$(RESET)"
	@docker ps >/dev/null 2>&1 && echo "$(GREEN)✓ Docker daemon running$(RESET)" || echo "$(YELLOW)✗ Docker daemon not running$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking environment file...$(RESET)"
	@if [ -f $(BACKEND_DIR)/.env ]; then \
		echo "$(GREEN)✓ .env file exists$(RESET)"; \
	else \
		echo "$(YELLOW)✗ .env file not found - run: cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env$(RESET)"; \
	fi

services-clean:
	@echo "$(BLUE)Stopping and removing local services...$(RESET)"
	cd $(BACKEND_DIR) && docker compose down -v
	@echo "$(GREEN)✓ Services and volumes removed$(RESET)"

## Tech Debt Tracking
tech-debt-check:
	@echo "$(BLUE)Running tech debt detection...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:report

tech-debt-check-ci:
	@echo "$(BLUE)Running tech debt detection (CI mode)...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:report:ci

tech-debt-sync:
	@echo "$(BLUE)Syncing tech debt items to documentation...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:sync

tech-debt-sync-dry:
	@echo "$(BLUE)Syncing tech debt items (dry run)...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:sync:dry

tech-debt-github:
	@echo "$(BLUE)Creating GitHub issues from tech debt...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:github

tech-debt-github-create:
	@echo "$(BLUE)Creating GitHub issues from tech debt...$(RESET)"
	cd $(BACKEND_DIR) && npm run tech-debt:github:create

## Bundle Size Tracking
bundle-size-check:
	@echo "$(BLUE)Running bundle size analysis...$(RESET)"
	cd $(BACKEND_DIR) && npm run bundle:check

## Dead Code Detection
# Run dead code detection for all languages (GDScript, TypeScript, Python)
dead-code-check:
	@echo "$(BLUE)Running dead code detection...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking GDScript (unused function arguments)...$(RESET)"
	@echo "(Note: Only checking unused-argument rule, other rules disabled)"
	@grep -r "unused-argument: true" gdlintrc > /dev/null && gdlint autoloads/ scripts/ scenes/ 2>&1 | grep "unused-argument" || echo "No unused arguments found in GDScript"
	@echo ""
	@echo "$(BLUE)Checking Python (unused imports/variables)...$(RESET)"
	@ruff check scripts/ --select=F401,F841 2>&1 || true
	@echo ""
	@echo "$(BLUE)Checking TypeScript (unused variables)...$(RESET)"
	@echo "(Note: Using ESLint no-unused-vars rule)"
	@cd backend && npm run lint -- --quiet --rule '@typescript-eslint/no-unused-vars: warn' 2>&1 || true
	@echo ""
	@echo "$(GREEN)✓ Dead code check complete$(RESET)"

# CI mode - strict dead code detection (fails on findings)
dead-code-check-ci:
	@echo "$(BLUE)Running dead code detection (CI mode)...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking GDScript (unused function arguments)...$(RESET)"
	@# Run gdlint but only check for unused-argument errors
	@if gdlint autoloads/ scripts/ scenes/ 2>&1 | grep -q "unused-argument"; then \
		echo "$(YELLOW)✗ Dead code detected in GDScript (unused function arguments)$(RESET)"; \
		gdlint autoloads/ scripts/ scenes/ 2>&1 | grep "unused-argument"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(BLUE)Checking Python (unused imports/variables)...$(RESET)"
	@if ruff check scripts/ --select=F401,F841 2>&1 | grep -q ";"; then \
		echo "$(YELLOW)✗ Dead code detected in Python (unused imports/variables)$(RESET)"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(BLUE)Checking TypeScript (unused variables)...$(RESET)"
	@cd backend && npm run lint -- --quiet --rule '@typescript-eslint/no-unused-vars: error'
	@echo ""
	@echo "$(GREEN)✓ No dead code detected$(RESET)"

## Duplicate Code Detection
# Run duplicate code detection for all languages (GDScript, TypeScript, Python)
duplicate-code-check:
	@echo "$(BLUE)Running duplicate code detection...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking for duplicate code in TypeScript (backend)...$(RESET)"
	@cd backend && npm run detect-duplicate || true
	@echo ""
	@echo "$(BLUE)Checking for duplicate code in GDScript and Python...$(RESET)"
	@npm run detect-duplicate -- autoloads/ scripts/ scenes/ || true
	@echo ""
	@echo "$(GREEN)✓ Duplicate code check complete$(RESET)"

# CI mode - strict duplicate code detection (fails if threshold exceeded)
duplicate-code-check-ci:
	@echo "$(BLUE)Running duplicate code detection (CI mode)...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking TypeScript (backend)...$(RESET)"
	@cd backend && npm run detect-duplicate:ci
	@echo ""
	@echo "$(BLUE)Checking GDScript and Python...$(RESET)"
	@npm run detect-duplicate:ci -- autoloads/ scripts/ scenes/
	@echo ""
	@echo "$(GREEN)✓ No duplicate code detected above threshold$(RESET)"

## AGENTS.md Validation
agents-md-check:
	@echo "$(BLUE)Running AGENTS.md validation...$(RESET)"
	cd $(BACKEND_DIR) && npm run validate:agents-md

agents-md-check-ci:
	@echo "$(BLUE)Running AGENTS.md validation (CI mode)...$(RESET)"
	cd $(BACKEND_DIR) && npm run validate:agents-md:ci

## Beta Environment Management
beta-start:
	@echo "$(BLUE)Starting beta environment...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml up -d
	@echo "$(GREEN)✓ Beta environment started$(RESET)"
	@echo "  - Nakama API:     http://localhost:7350"
	@echo "  - Nakama Console: http://localhost:7351 (admin:beta_admin_secure_password)"
	@echo "  - Prometheus:     http://localhost:9090"
	@echo "  - Grafana:        http://localhost:3000 (admin:admin_beta_change_me)"
	@echo ""
	@echo "Run 'make beta-health' to verify services are healthy."

beta-stop:
	@echo "$(BLUE)Stopping beta environment...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml down
	@echo "$(GREEN)✓ Beta environment stopped$(RESET)"

beta-restart:
	@echo "$(BLUE)Restarting beta environment...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml restart
	@echo "$(GREEN)✓ Beta environment restarted$(RESET)"

beta-status:
	@echo "$(BLUE)Beta Environment Status:$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml ps

beta-health:
	@echo "$(BLUE)Running beta health checks...$(RESET)"
	@echo ""
	@echo "$(BLUE)Container Status:$(RESET)"
	@docker ps --filter "name=beta" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
	@echo ""
	@echo -n "$(BLUE)Checking Nakama API: $(RESET)"
	@curl -s --max-time 5 http://localhost:7350/ > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || echo "$(YELLOW)Not responding$(RESET)"
	@echo -n "$(BLUE)Checking PostgreSQL: $(RESET)"
	@docker exec armored_archer_beta_db pg_isready -U postgres > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || echo "$(YELLOW)Not responding$(RESET)"
	@echo -n "$(BLUE)Checking Redis: $(RESET)"
	@docker exec armored_archer_beta_redis redis-cli ping > /dev/null 2>&1 && echo "$(GREEN)Healthy$(RESET)" || echo "$(YELLOW)Not responding$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking Beta Endpoints:$(RESET)"
	@echo -n "  - Beta API URL: "
	@curl -s --max-time 5 http://localhost:7350/ > /dev/null 2>&1 && echo "$(GREEN)Accessible$(RESET)" || echo "$(YELLOW)Not accessible$(RESET)"
	@echo -n "  - Beta Console: "
	@curl -s --max-time 5 http://localhost:7351/ > /dev/null 2>&1 && echo "$(GREEN)Accessible$(RESET)" || echo "$(YELLOW)Not accessible$(RESET)"

beta-logs:
	@echo "$(BLUE)Viewing beta logs (Ctrl+C to exit)...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml logs -f

beta-validate:
	@echo "$(BLUE)Validating beta environment setup...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking prerequisites...$(RESET)"
	@command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓ Docker installed$(RESET)" || echo "$(YELLOW)✗ Docker not found$(RESET)"
	@command -v docker-compose >/dev/null 2>&1 && echo "$(GREEN)✓ Docker Compose installed$(RESET)" || echo "$(YELLOW)✗ Docker Compose not found$(RESET)"
	@docker ps >/dev/null 2>&1 && echo "$(GREEN)✓ Docker daemon running$(RESET)" || echo "$(YELLOW)✗ Docker daemon not running$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking beta environment file...$(RESET)"
	@if [ -f $(BACKEND_DIR)/.env.beta ]; then \
		echo "$(GREEN)✓ .env.beta file exists$(RESET)"; \
	else \
		echo "$(YELLOW)✗ .env.beta file not found - run: cp $(BACKEND_DIR)/.env.beta.example $(BACKEND_DIR)/.env.beta$(RESET)"; \
	fi
	@echo ""
	@echo "$(BLUE)Checking beta docker-compose file...$(RESET)"
	@if [ -f $(BACKEND_DIR)/docker-compose.beta.yml ]; then \
		echo "$(GREEN)✓ docker-compose.beta.yml exists$(RESET)"; \
	else \
		echo "$(YELLOW)✗ docker-compose.beta.yml not found$(RESET)"; \
	fi

beta-clean:
	@echo "$(BLUE)Stopping and removing beta environment...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose -f docker-compose.beta.yml down -v
	@echo "$(GREEN)✓ Beta environment and volumes removed$(RESET)"

beta-migrate:
	@echo "$(BLUE)Running database migrations on beta...$(RESET)"
	@docker exec armored_archer_beta nakama migrate up --database.address postgres://postgres:beta_db_secure_password_change_me@postgres:5432/nakama_beta || echo "$(YELLOW)Make sure beta environment is running: make beta-start$(RESET)"

beta-test:
	@echo "$(BLUE)Running automated beta health tests...$(RESET)"
	@echo ""
	@echo "$(BLUE)Prerequisites:$(RESET)"
	@echo "  - Beta environment must be running: make beta-start"
	@echo ""
	cd $(BACKEND_DIR) && npm run test:integration -- tests/integration/beta_health.test.ts

## Property-Based Testing
test-property:
	@echo "$(BLUE)Running property-based tests...$(RESET)"
	cd $(BACKEND_DIR) && go test -v -run "Property" ./...

test-property-combat:
	@echo "$(BLUE)Running combat property tests...$(RESET)"
	cd $(BACKEND_DIR) && go test -v -run "Property" ./internal/combat/

test-property-rng:
	@echo "$(BLUE)Running RNG property tests...$(RESET)"
	cd $(BACKEND_DIR) && go test -v -run "Property" ./internal/rng/

## Coverage Reporting
coverage-frontend:
	@echo "$(BLUE)Running Godot tests for coverage...$(RESET)"
	@echo "Note: Godot lacks line coverage tooling, using test pass rate as proxy"
	./godot4 --headless --script test/run_all_tests.gd
	@python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml

coverage-backend:
	@echo "$(BLUE)Generating Go coverage report...$(RESET)"
	cd $(BACKEND_DIR) && bash scripts/generate-coverage-report.sh

coverage: coverage-backend coverage-frontend
	@echo ""
	@echo "$(GREEN)✓ Coverage reports generated$(RESET)"
	@echo "  - Backend HTML: backend/coverage/html/index.html"
	@echo "  - Frontend: Test pass rate (Godot limitation)"

coverage-html:
	@echo "$(BLUE)Opening coverage HTML report...$(RESET)"
	@xdg-open backend/coverage/html/index.html 2>/dev/null || open backend/coverage/html/index.html 2>/dev/null || echo "Open backend/coverage/html/index.html manually"

analyze-gaps:
	@echo "$(BLUE)Running coverage gap analysis...$(RESET)"
	@cd backend && bash tests/quality/analyze_gaps.sh

# Coverage Gates
coverage-gates:
	@echo "$(BLUE)Enforcing coverage gates (stage $${COVERAGE_GATE_STAGE:-1})...$(RESET)"
	@cd backend/tests/quality && ./coverage_gates.sh

coverage-gate-critical:
	@echo "$(BLUE)Enforcing critical path threshold only...$(RESET)"
	@cd backend/tests/quality && ./coverage_gates.sh critical

coverage-threshold-check:
	@echo "$(BLUE)=== Coverage Threshold Status ===$(RESET)"
	@echo ""
	@cd backend && go test -coverprofile=coverage/coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1
	@OVERALL=$$(go tool cover -func=coverage/coverage.out | grep total | awk '{print $$3}' | sed 's/%//'); \
	 echo "Current Overall Coverage: $$OVERALL%"; \
	 echo ""; \
	 echo "Stage Thresholds:"; \
	 echo "  Stage 1 (30%): $$(echo "$$OVERALL < 30" | bc -l 2>/dev/null || echo 0 | awk '{if($$1==1) print "FAIL"; else print "PASS"}')"; \
	 echo "  Stage 2 (45%): $$(echo "$$OVERALL < 45" | bc -l 2>/dev/null || echo 0 | awk '{if($$1==1) print "FAIL"; else print "PASS"}')"; \
	 echo "  Stage 3 (60%): $$(echo "$$OVERALL < 60" | bc -l 2>/dev/null || echo 0 | awk '{if($$1==1) print "FAIL"; else print "PASS"}')"; \
	 echo ""; \
	 echo "Critical Path Threshold (80%):"; \
	 CRITICAL=$$(go tool cover -func=coverage/coverage.out | grep -E "(combat|matchmaking|rpg)" | awk '{gsub(/%/, "", $$3); sum+=$$3; n++} END {printf "%.1f", n>0 ? sum/n : "0"}'); \
	 echo "  Current: $$CRITICAL%"; \
	 echo "  Status: $$(echo "$$CRITICAL < 80" | bc -l 2>/dev/null || echo 1 | awk '{if($$1==1) print "FAIL"; else print "PASS"}')"

coverage-baseline-update:
	@echo "$(BLUE)Updating package baselines from current coverage...$(RESET)"
	@cd backend && go test -coverprofile=coverage/coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1
	@scripts/check-coverage-regression.sh --update-baselines
	@echo "$(GREEN)Baselines updated$(RESET)"

coverage-gap-analysis:
	@echo "$(BLUE)Running coverage gap analysis...$(RESET)"
	@cd backend && go test -coverprofile=coverage/coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1
	@scripts/gap-analysis.sh

coverage-history:
	@echo "$(BLUE)Tracking coverage in history...$(RESET)"
	@cd backend && go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1
	@scripts/track-coverage-history.sh

coverage-dashboard:
	@echo "$(BLUE)Generating coverage dashboard...$(RESET)"
	@cd backend && go test -coverprofile=coverage/coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1
	@scripts/track-coverage-history.sh
	@scripts/generate-coverage-dashboard.sh
	@echo "$(GREEN)Dashboard generated: docs/coverage-dashboard.html$(RESET)"

ci-coverage-check:
	@echo "$(BLUE)Running CI coverage check...$(RESET)"
	@cd backend && go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./...
	@cd backend/tests/quality && ./coverage_gates.sh
	@scripts/check-coverage-regression.sh

verify-cicd:
	@echo "$(BLUE)Verifying CI/CD coverage integration...$(RESET)"
	@./scripts/verify-cicd-coverage.sh --full

verify-phase-12:
	@echo "$(BLUE)Verifying Phase 12 completion status...$(RESET)"
	@./scripts/verify-phase-12-approval.sh

## Mutation Testing
mutation-install:
	@echo "$(BLUE)Installing go-mutesting...$(RESET)"
	go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest
	@echo "$(GREEN)✓ go-mutesting installed$(RESET)"

mutation-test:
	@echo "$(BLUE)Running mutation testing...$(RESET)"
	bash scripts/run-mutation-tests.sh

mutation-test-quick:
	@echo "$(BLUE)Running quick mutation testing (critical packages only)...$(RESET)"
	go-mutesting --exec scripts/mutation-exec-handler.sh internal/combat/ internal/matchmaking/
