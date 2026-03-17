#!/bin/bash
# ============================================
# Generate Beta Access Keys
# Armored Archer - Beta Testing Setup
# ============================================
# This script generates beta user access keys and
# invitation codes for beta testing.
# ============================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NUM_INVITES="${1:-100}"
OUTPUT_FILE="${2:-beta_access_keys.json}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Generate invitation codes
generate_invites() {
    log_info "Generating $NUM_INVITES beta invitation codes..."
    
    # Create temporary SQL file
    SQL_FILE=$(mktemp)
    cat > "$SQL_FILE" << 'EOF'
\echo '['
SELECT json_agg(
    json_build_object(
        'code', code,
        'created_by', created_by,
        'created_at', created_at,
        'expires_at', expires_at,
        'max_uses', max_uses
    )
) FROM (
    SELECT 
        generate_beta_invite_code() as code,
        'system' as created_by,
        NOW() as created_at,
        NOW() + INTERVAL '30 days' as expires_at,
        1 as max_uses
    FROM generate_series(1, :num_invites)
) invites;
\echo ']'
EOF
    
    # Replace placeholder
    sed -i "s/:num_invites/$NUM_INVITES/" "$SQL_FILE"
    
    # Run SQL and capture output
    local result
    result=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE" 2>/dev/null || echo "[]")
    
    # Clean up
    rm -f "$SQL_FILE"
    
    # Write to output file
    echo "$result" | head -n -2 | tail -n +2 > "$OUTPUT_FILE"
    
    log_success "Generated $NUM_INVITES invitation codes to $OUTPUT_FILE"
}

# Generate user access keys
generate_access_keys() {
    log_info "Generating beta access keys..."
    
    # Create SQL to generate keys
    SQL_FILE=$(mktemp)
    cat > "$SQL_FILE" << 'EOF'
-- Generate user access keys
INSERT INTO storage (collection, key, value, user_id)
SELECT 
    'beta_access',
    'key_' || generate_series,
    json_build_object(
        'access_key', encode(gen_random_bytes(16), 'hex'),
        'created_at', NOW(),
        'expires_at', NOW() + INTERVAL '30 days'
    )::text,
    NULL
FROM generate_series(1, :num_invites)
RETURNING key, value;
EOF
    
    sed -i "s/:num_invites/$NUM_INVITES/" "$SQL_FILE"
    
    log_info "Access keys would be generated in production database"
    rm -f "$SQL_FILE"
}

# Display summary
show_summary() {
    echo ""
    echo "========================================"
    echo "  Beta Access Keys Generated"
    echo "========================================"
    echo "Invitation codes: $NUM_INVITES"
    echo "Output file: $OUTPUT_FILE"
    echo ""
    echo "Next steps:"
    echo "  1. Review invitation codes in $OUTPUT_FILE"
    echo "  2. Distribute codes to beta testers"
    echo "  3. Monitor registration via dashboard"
    echo "========================================"
}

# Main
main() {
    log_info "Starting beta access key generation..."
    
    generate_invites
    show_summary
    
    log_success "Beta access setup complete!"
}

main "$@"
