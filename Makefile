# Armored Archer - Makefile
# Single command setup for development environment

# Project directories
BACKEND_DIR := backend

# Colors for output
GREEN := $(shell tput setaf 2 2>/dev/null || echo "")
BLUE := $(shell tput setaf 4 2>/dev/null || echo "")
YELLOW := $(shell tput setaf 3 2>/dev/null || echo "")
RESET := $(shell tput sgr0 2>/dev/null || echo "")

.PHONY: help setup backend-install backend-start backend-stop backend-dev backend-test backend-build backend-lint backend-check backend-migrate backend-migrate-new check-game-schema backend-db-schema clean release-notes test-flaky-backend test-flaky-godot test-flaky-report build-perf-track rollback services-start services-stop services-restart services-restart-destructive services-cold-start services-assert-cold-start services-status services-health services-logs services-validate services-clean tech-debt-check tech-debt-check-ci tech-debt-sync tech-debt-sync-dry tech-debt-github tech-debt-github-create bundle-size-check agents-md-check agents-md-check-ci dead-code-check dead-code-check-ci duplicate-code-check duplicate-code-check-ci ci-services-start ci-services-stop ci-services-status ci-services-restart ci ci-parallel ci-persist ci-clean ci-status serve-burndown smoke-test smoke-test-backend smoke-test-client smoke-test-quick smoke-test-verbose smoke-test-ci smoke-test-report

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
	@echo "  make backend-build      Build TypeScript backend"
	@echo "  make backend-lint       Lint TypeScript backend code"
	@echo "  make backend-check      Run TypeScript linting and type checking"
	@echo ""
	@echo "$(GREEN)Smoke Tests$(RESET)"
	@echo "  make smoke-test        Run all smoke tests (backend + client)"
	@echo "  make smoke-test-backend Run backend smoke tests only"
	@echo "  make smoke-test-client  Run Godot client E2E tests only"
	@echo "  make smoke-test-quick   Run quick smoke tests (skip performance)"
	@echo "  make smoke-test-verbose Run smoke tests with verbose output"
	@echo "  make smoke-test-ci      Run smoke tests in CI mode (exit on failure)"
	@echo "  make smoke-test-report  View latest smoke test report"
	@echo ""
	@echo "$(GREEN)Flaky Test Detection$(RESET)"
	@echo "  make test-flaky-backend Run flaky test detection for backend"
	@echo "  make test-flaky-godot   Run flaky test detection for Godot"
	@echo "  make test-flaky-report  Generate flaky test report"
	@echo ""
	@echo ""
	@echo "$(GREEN)Build Performance$(RESET)"
	@echo "  make build-perf-track   View build performance metrics"
	@echo ""
	@echo "$(GREEN)Dashboard$(RESET)"
	@echo "  make serve-burndown   Serve MVP Burndown Dashboard locally"
	@echo ""
	@echo "$(GREEN)Deployment$(RESET)"
	@echo "  make rollback          Show rollback automation help"
	@echo ""
	@echo "$(GREEN)Database Commands$(RESET)"
	@echo "  make backend-migrate    Run database migrations (reads backend/.env; human-supervised — see docs/db/MIGRATIONS.md)"
	@echo "  make backend-migrate-new Create new migration file"
	@echo "  make check-game-schema   Verify game tables exist (read-only, never migrates; issue #891)"
	@echo "  make backend-db-schema   Display current database schema"
	@echo ""
	@echo "$(GREEN)Local Services (Dev)$(RESET)"
	@echo "  make services-start                 Start Nakama + PostgreSQL (robust cold-start, #907)"
	@echo "  make services-cold-start            Same as services-start"
	@echo "  make services-assert-cold-start     Assert stack reached all-green"
	@echo "  make services-stop                  Stop all service containers"
	@echo "  make services-restart               Restart all services"
	@echo "  make services-restart-destructive   Drop volume + re-run cold-start (self-heal test)"
	@echo "  make services-status                Show service status"
	@echo "  make services-health                Check service health"
	@echo "  make services-logs                  View service logs"
	@echo "  make services-validate              Validate prerequisites"
	@echo "  make services-clean                 Stop and remove services + volumes"
	@echo ""
	@echo "$(GREEN)CI Services (for act)$(RESET)"
	@echo "  make ci-services-start  Start CI services (PostgreSQL:5432, Nakama:7350)"
	@echo "  make ci-services-stop   Stop CI services"
	@echo "  make ci-services-status Show CI services status"
	@echo "  make ci-services-restart Restart CI services"
	@echo ""
	@echo "$(GREEN)Local CI (optimized for speed)$(RESET)"
	@echo "  make ci                Run all CI jobs sequentially"
	@echo "  make ci-parallel       Run all CI jobs in parallel (4 workers)"
	@echo "  make ci-persist        Run CI and keep services running"
	@echo "  make ci-clean          Stop and cleanup CI services"
	@echo "  make ci-clear-cache    Clear act action cache (fixes git clone errors)"
	@echo "  make ci-status         Show CI services status"
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
	@echo "$(GREEN)Notes$(RESET)"
	@echo "  - Godot: Open project in Godot 4.x Editor and press F5 to run"
	@echo "  - Nakama Console: http://localhost:7351 (admin:password)"
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

# DEPRECATED: Go backend commands - Go migration was abandoned
# See backend/.deprecated/ for Go backend artifacts
# backend-test-go: $(info $(YELLOW)Go backend is deprecated - use TypeScript$(RESET))
# backend-build-go: $(info $(YELLOW)Go backend is deprecated - use TypeScript$(RESET))
# backend-lint-go: $(info $(YELLOW)Go backend is deprecated - use TypeScript$(RESET))
# backend-fmt-go: $(info $(YELLOW)Go backend is deprecated - use TypeScript$(RESET))

backend-build:
	@echo "$(BLUE)Building TypeScript backend...$(RESET)"
	cd $(BACKEND_DIR) && npm run build

backend-lint:
	@echo "$(BLUE)Linting TypeScript backend code...$(RESET)"
	cd $(BACKEND_DIR) && npm run lint

backend-check:
	@echo "$(BLUE)Running linting and type checking...$(RESET)"
	cd $(BACKEND_DIR) && npm run lint && npm run typecheck

dev: backend-dev

## Cleanup
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(RESET)"
	cd $(BACKEND_DIR) && rm -rf build/ coverage/ test-results.txt
	@echo "$(GREEN)✓ Clean complete$(RESET)"

## Database Commands
# Issue #891 / #896: the DSN is assembled at runtime from backend/.env
# (POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB). No secrets in the target.
# See docs/db/MIGRATIONS.md — schema mutations still require human supervision.
backend-migrate:
	@echo "$(BLUE)Running database migrations...$(RESET)"
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		echo "$(YELLOW)backend/.env missing — copy backend/.env.example to backend/.env first.$(RESET)"; \
		exit 1; \
	fi
	@set -a; . $(BACKEND_DIR)/.env; set +a; \
	DSN="postgres://$${POSTGRES_USER:-postgres}:$${POSTGRES_PASSWORD}@postgres:5432/$${POSTGRES_DB:-nakama}"; \
	echo "$(BLUE)DSN: postgres://$${POSTGRES_USER:-postgres}:***@postgres:5432/$${POSTGRES_DB:-nakama}$(RESET)"; \
	docker exec -e POSTGRES_USER=$${POSTGRES_USER:-postgres} \
	            -e POSTGRES_PASSWORD=$${POSTGRES_PASSWORD} \
	            -e POSTGRES_DB=$${POSTGRES_DB:-nakama} \
	            armored_archer_server \
	            /nakama/nakama migrate up --database.address "$$DSN" \
	  || { echo "$(YELLOW)Make sure backend is running: make backend-start$(RESET)"; exit 1; }

# Issue #891: pure-read schema verification. NEVER applies migrations.
# See backend/scripts/check-game-schema.sh.
check-game-schema:
	@echo "$(BLUE)Verifying game schema (read-only, no migration will be applied)...$(RESET)"
	@bash $(BACKEND_DIR)/scripts/check-game-schema.sh

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

## MVP Burndown Dashboard
serve-burndown:
	@echo "$(BLUE)Serving MVP Burndown Dashboard...$(RESET)"
	@echo ""
	@echo "Dashboard URL: $(YELLOW)http://localhost:8080/docs/mvp-burndown-dashboard.html$(RESET)"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@if command -v python3 &> /dev/null; then \
		python3 -m http.server 8080; \
	elif command -v python &> /dev/null; then \
		python -m SimpleHTTPServer 8080; \
	else \
		echo "$(YELLOW)Error: Python is not installed$(RESET)"; \
		echo "Install Python or use 'npx http-server -p 8080'"; \
	fi

## Local Services Management
# Issue #907: services-start is now backed by scripts/cold-start.sh so a truly
# cold state (no containers, no volumes) reaches `make services-health`
# all-green with zero manual steps. If you already have a healthy stack this
# is a no-op (docker compose up -d is idempotent) — preserved for back-compat.
services-start:
	@echo "$(BLUE)Starting local services (Nakama + PostgreSQL) — robust cold-start (#907)$(RESET)"
	@./scripts/cold-start.sh
	@echo ""
	@echo "Run 'make services-health' to verify services are healthy."

services-cold-start:
	@echo "$(BLUE)Robust cold-start (alias for services-start, see #907)$(RESET)"
	@./scripts/cold-start.sh

services-assert-cold-start:
	@echo "$(BLUE)Asserting cold-start reached all-green (#907)$(RESET)"
	@./scripts/assert-cold-start.sh

services-stop:
	@echo "$(BLUE)Stopping local services...$(RESET)"
	cd $(BACKEND_DIR) && docker compose down
	@echo "$(GREEN)✓ Services stopped$(RESET)"

services-restart:
	@echo "$(BLUE)Restarting local services...$(RESET)"
	cd $(BACKEND_DIR) && docker compose restart
	@echo "$(GREEN)✓ Services restarted$(RESET)"

# Issue #907: destructive-restart scenario — drops postgres container + the
# named data volume, then re-runs cold-start. Use this to verify the self-
# healing path reaches all-green from a truly cold state.
services-restart-destructive:
	@echo "$(BLUE)Destructive restart — drops containers + named data volume then re-runs cold-start (#907)$(RESET)"
	@echo "$(YELLOW)WARNING: this removes the local postgres data volume.$(RESET)"
	@cd $(BACKEND_DIR) && docker compose down -v
	@./scripts/cold-start.sh

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
	@if curl -s --max-time 5 http://localhost:7350/ > /dev/null 2>&1; then \
		echo "$(GREEN)Healthy$(RESET)"; \
	else \
		echo "$(YELLOW)Not responding$(RESET)"; \
		exit 1; \
	fi
	@echo -n "$(BLUE)Checking PostgreSQL: $(RESET)"
	@if docker exec armored_archer_db pg_isready -U postgres > /dev/null 2>&1; then \
		echo "$(GREEN)Healthy$(RESET)"; \
	elif docker exec $$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1) pg_isready -U postgres > /dev/null 2>&1; then \
		echo "$(GREEN)Healthy$(RESET)"; \
	else \
		echo "$(YELLOW)Not responding$(RESET)"; \
		exit 1; \
	fi

services-logs:
	@echo "$(BLUE)Viewing service logs (Ctrl+C to exit)...$(RESET)"
	cd $(BACKEND_DIR) && docker compose logs -f

services-validate:
	@echo "$(BLUE)Validating local services setup...$(RESET)"
	@echo ""
	@echo "$(BLUE)Checking prerequisites...$(RESET)"
	@command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓ Docker installed$(RESET)" || echo "$(YELLOW)✗ Docker not found$(RESET)"
	@command -v docker compose >/dev/null 2>&1 && echo "$(GREEN)✓ Docker Compose installed$(RESET)" || echo "$(YELLOW)✗ Docker Compose not found$(RESET)"
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

## CI Services (for local act testing)
# These services match the CI environment exactly (different ports than dev)
ci-services-start:
	@echo "$(BLUE)Starting CI services (for act)...$(RESET)"
	docker compose -f .github/docker-compose.yml -p ci-armored-archer up -d
	@echo "$(GREEN)✓ CI services started$(RESET)"
	@echo "  - PostgreSQL: localhost:5432 (CI port)"
	@echo "  - Nakama:    localhost:7350"
	@echo ""
	@echo "Run with act:"
	@echo "  act -W .github/workflows/test.yml"

ci-services-stop:
	@echo "$(BLUE)Stopping CI services...$(RESET)"
	docker compose -f .github/docker-compose.yml -p ci-armored-archer down
	@echo "$(GREEN)✓ CI services stopped$(RESET)"

ci-services-status:
	@echo "$(BLUE)CI Services Status:$(RESET)"
	docker compose -f .github/docker-compose.yml -p ci-armored-archer ps

ci-services-restart:
	@echo "$(BLUE)Restarting CI services...$(RESET)"
	@docker compose -f .github/docker-compose.yml -p ci-armored-archer restart
	@echo "$(GREEN)✓ CI services restarted$(RESET)"

## Local CI (optimized for speed)
# Uses scripts/ci-local.sh with parallel execution and fast docker-compose
ci:
	@echo "$(BLUE)Running local CI...$(RESET)"
	@./scripts/ci-local.sh --fast

ci-parallel:
	@echo "$(BLUE)Running local CI in parallel...$(RESET)"
	@./scripts/ci-local.sh --fast --parallel

ci-persist:
	@echo "$(BLUE)Running local CI with service persistence...$(RESET)"
	@./scripts/ci-local.sh --fast --persist

ci-clean:
	@echo "$(BLUE)Cleaning up CI services...$(RESET)"
	@./scripts/ci-local.sh --clean

ci-status:
	@echo "$(BLUE)CI Services Status:$(RESET)"
	@./scripts/ci-local.sh --status

ci-clear-cache:
	@echo "$(BLUE)Clearing act action cache...$(RESET)"
	@./scripts/ci-local.sh --clear-cache

## Smoke Tests (End-to-End Vertical Slice)
# Issue: #684 - [Sprint 1] Create end-to-end smoke test script
smoke-test:
	@echo "$(BLUE)Running complete smoke test suite...$(RESET)"
	@./scripts/run-smoke-tests.sh

smoke-test-backend:
	@echo "$(BLUE)Running backend smoke tests only...$(RESET)"
	@./scripts/run-smoke-tests.sh --backend

smoke-test-client:
	@echo "$(BLUE)Running client E2E smoke tests only...$(RESET)"
	@./scripts/run-smoke-tests.sh --client

smoke-test-quick:
	@echo "$(BLUE)Running quick smoke tests (skip performance)...$(RESET)"
	@./scripts/run-smoke-tests.sh --quick

smoke-test-verbose:
	@echo "$(BLUE)Running smoke tests with verbose output...$(RESET)"
	@./scripts/run-smoke-tests.sh --verbose

smoke-test-ci:
	@echo "$(BLUE)Running smoke tests in CI mode (exit on first failure)...$(RESET)"
	@./scripts/run-smoke-tests.sh --ci

smoke-test-report:
	@echo "$(BLUE)Opening latest smoke test report...$(RESET)"
	@if [ -d reports/smoke-tests ]; then \
		LATEST_REPORT=$$(ls -t reports/smoke-tests/*.html 2>/dev/null | head -1); \
		if [ -n "$$LATEST_REPORT" ]; then \
			if command -v xdg-open >/dev/null 2>&1; then \
				xdg-open "$$LATEST_REPORT"; \
			elif command -v open >/dev/null 2>&1; then \
				open "$$LATEST_REPORT"; \
			else \
				echo "$(YELLOW)Report: $$LATEST_REPORT$(RESET)"; \
			fi; \
		else \
			echo "$(YELLOW)No smoke test reports found. Run: make smoke-test$(RESET)"; \
		fi; \
	else \
		echo "$(YELLOW)Smoke test reports directory not found. Run: make smoke-test$(RESET)"; \
	fi
