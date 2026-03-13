#!/bin/bash
#
# Rollback Script for Armored Archer
# 
# This script automates rollback of deployments to the previous known good state.
# Supports: Docker Compose, Nakama server, PostgreSQL database
#
# Usage:
#   ./scripts/rollback.sh [version|docker|db|all]
#
# Options:
#   version  - Rollback to previous deployed version
#   docker   - Restart Docker containers to previous state
#   db       - Rollback database migrations
#   all      - Full rollback (default)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

rollback_docker() {
    log_info "Rolling back Docker containers..."
    
    # Check if docker-compose.yml exists
    if [ -f "${PROJECT_ROOT}/backend/docker-compose.yml" ]; then
        cd "${PROJECT_ROOT}/backend"
        
        # Get current containers
        CONTAINERS=$(docker-compose ps -q 2>/dev/null || true)
        
        if [ -n "$CONTAINERS" ]; then
            # Stop current containers
            docker-compose down || true
            
            # Restore from backup if exists
            if [ -f "${BACKUP_DIR}/docker-compose.backup.yml" ]; then
                log_info "Restoring docker-compose from backup"
                cp "${BACKUP_DIR}/docker-compose.backup.yml" docker-compose.yml
            fi
            
            # Start containers
            docker-compose up -d
            log_info "Docker containers rolled back"
        else
            log_warn "No running containers to rollback"
        fi
    else
        log_warn "No docker-compose.yml found"
    fi
}

rollback_database() {
    log_info "Rolling back database migrations..."
    
    # Check if we have database backup
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/nakama_backup_*.sql 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Found backup: $LATEST_BACKUP"
        
        # Check if PostgreSQL is accessible
        if docker ps | grep -q postgres; then
            DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
            if [ -n "$DB_CONTAINER" ]; then
                log_info "Restoring database from backup..."
                docker exec -i "$DB_CONTAINER" psql -U postgres -d nakama < "$LATEST_BACKUP"
                log_info "Database rolled back successfully"
            fi
        else
            log_warn "PostgreSQL container not running"
        fi
    else
        log_warn "No database backup found"
    fi
}

rollback_version() {
    log_info "Rolling back application version..."
    
    # Check for version tag backup
    if [ -f "${BACKUP_DIR}/previous_version" ]; then
        PREV_VERSION=$(cat "${BACKUP_DIR}/previous_version")
        log_info "Rolling back to version: $PREV_VERSION"
        
        # Git checkout if it's a git repo
        if [ -d "${PROJECT_ROOT}/.git" ]; then
            cd "$PROJECT_ROOT"
            git checkout "$PREV_VERSION" 2>/dev/null || log_warn "Could not checkout version"
        fi
    else
        log_warn "No version backup found"
    fi
}

# Create a backup before rollback (for emergency restore)
create_backup() {
    log_info "Creating pre-rollback backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Backup docker-compose
    if [ -f "${PROJECT_ROOT}/backend/docker-compose.yml" ]; then
        cp "${PROJECT_ROOT}/backend/docker-compose.yml" \
           "${BACKUP_DIR}/docker-compose.backup.yml"
    fi
    
    # Backup database if container is running
    if docker ps | grep -q postgres; then
        DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
        if [ -n "$DB_CONTAINER" ]; then
            docker exec -i "$DB_CONTAINER" pg_dump -U postgres nakama \
                > "${BACKUP_DIR}/nakama_backup_${TIMESTAMP}.sql"
            log_info "Database backed up to: nakama_backup_${TIMESTAMP}.sql"
        fi
    fi
    
    # Save current version
    if [ -d "${PROJECT_ROOT}/.git" ]; then
        cd "$PROJECT_ROOT"
        git rev-parse HEAD > "${BACKUP_DIR}/previous_version"
    fi
    
    log_info "Backup completed"
}

# Main
case "${1:-all}" in
    version)
        rollback_version
        ;;
    docker)
        rollback_docker
        ;;
    db)
        rollback_database
        ;;
    all)
        create_backup
        rollback_docker
        rollback_database
        rollback_version
        log_info "Full rollback completed"
        ;;
    *)
        echo "Usage: $0 [version|docker|db|all]"
        exit 1
        ;;
esac
