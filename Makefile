# Armored Archer - Makefile
# Single command setup for development environment

# Project directories
BACKEND_DIR := backend

# Colors for output
GREEN := $(shell tput setaf 2 2>/dev/null || echo "")
BLUE := $(shell tput setaf 4 2>/dev/null || echo "")
YELLOW := $(shell tput setaf 3 2>/dev/null || echo "")
RESET := $(shell tput sgr0 2>/dev/null || echo "")

.PHONY: help setup backend-install backend-start backend-stop backend-dev backend-test backend-build backend-lint backend-check backend-migrate backend-migrate-new backend-db-schema clean release-notes test-flaky-backend test-flaky-godot test-flaky-report build-perf-track rollback

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
	@echo "  make backend-test       Run backend tests"
	@echo "  make backend-build      Build TypeScript backend"
	@echo "  make backend-lint       Lint backend code"
	@echo "  make backend-check      Run linting and type checking"
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
	@echo "$(GREEN)Deployment$(RESET)"
	@echo "  make rollback          Show rollback automation help"
	@echo ""
	@echo "$(GREEN)Database Commands$(RESET)"
	@echo "  make backend-migrate    Run database migrations"
	@echo "  make backend-migrate-new Create new migration file"
	@echo "  make backend-db-schema   Display current database schema"
	@echo ""
	@echo "$(GREEN)Development$(RESET)"
	@echo "  make dev                Start development (backend with auto-reload)"
	@echo "  make clean              Clean build artifacts"
	@echo ""
	@echo "$(GREEN)Release Notes$(RESET)"
	@echo "  make release-notes      Generate release notes from git history"
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
	cd $(BACKEND_DIR) && docker-compose up -d
	@echo "$(GREEN)Nakama started: http://localhost:7350$(RESET)"
	@echo "$(GREEN)Admin Console: http://localhost:7351 (admin:password)$(RESET)"

backend-stop:
	@echo "$(BLUE)Stopping backend...$(RESET)"
	cd $(BACKEND_DIR) && docker-compose down

backend-dev:
	@echo "$(BLUE)Starting backend with auto-reload...$(RESET)"
	cd $(BACKEND_DIR) && npm run dev

backend-test:
	@echo "$(BLUE)Running backend tests...$(RESET)"
	cd $(BACKEND_DIR) && npm test

backend-build:
	@echo "$(BLUE)Building TypeScript backend...$(RESET)"
	cd $(BACKEND_DIR) && npm run build

backend-lint:
	@echo "$(BLUE)Linting backend code...$(RESET)"
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
=======
>>>>>>> theirs
>>>>>>> main
