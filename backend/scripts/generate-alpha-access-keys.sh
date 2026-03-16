#!/bin/bash

# =============================================================================
# Alpha Access Key Generator
# =============================================================================
# 
# Description: Generates secure alpha access keys for Armored Archer v2.1.0
# Alpha Testing Program. Keys follow the format: ALPHA-XXXX-XXXX-XXXX-XXXX
#
# Usage:
#   ./generate-alpha-access-keys.sh [count] [output_file]
#
# Arguments:
#   count       - Number of keys to generate (default: 50)
#   output_file - Output file for keys (default: alpha_keys_YYYYMMDD_HHMMSS.txt)
#
# Examples:
#   ./generate-alpha-access-keys.sh           # Generate 50 keys with default filename
#   ./generate-alpha-access-keys.sh 100       # Generate 100 keys
#   ./generate-alpha-access-keys.sh 100 keys.txt  # Generate 100 keys to keys.txt
#
# Requirements:
#   - Bash 4.0+
#   - OpenSSL or /dev/urandom for random generation
#   - sha256sum for checksum calculation
#
# Author: Armored Archer Development Team
# Version: 1.0
# Created: 2026-03-16
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
readonly DEFAULT_COUNT=50
readonly KEY_PREFIX="ALPHA"
readonly KEY_SEGMENT_LENGTH=4
readonly KEY_SEGMENTS=4

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

# Print usage information
usage() {
    cat << EOF
Usage: $SCRIPT_NAME [count] [output_file]

Generate alpha access keys for Armored Archer v2.1.0 Alpha Testing Program.

Arguments:
    count       Number of keys to generate (default: $DEFAULT_COUNT)
    output_file Output file for keys (default: alpha_keys_${TIMESTAMP}.txt)

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -c, --csv       Output in CSV format with metadata
    -j, --json      Output in JSON format
    --validate      Validate existing keys from file

Examples:
    $SCRIPT_NAME                      Generate $DEFAULT_COUNT keys with default filename
    $SCRIPT_NAME 100                  Generate 100 keys
    $SCRIPT_NAME 100 keys.txt         Generate 100 keys to keys.txt
    $SCRIPT_NAME 50 --csv             Generate 50 keys in CSV format
    $SCRIPT_NAME --validate keys.txt  Validate keys from file

EOF
}

# Log message with timestamp
log() {
    local level="$1"
    local message="$2"
    local color="$NC"
    
    case "$level" in
        INFO)  color="$GREEN" ;;
        WARN)  color="$YELLOW" ;;
        ERROR) color="$RED" ;;
        DEBUG) color="$BLUE" ;;
    esac
    
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] [$level]${NC} $message"
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Generate a random alphanumeric string
generate_random_segment() {
    local length=$1
    local result=""
    local chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789" # Excluding I, O, 1, 0 for readability
    
    # Try to use OpenSSL first, fall back to /dev/urandom
    if command_exists openssl; then
        result=$(openssl rand -base64 100 | tr -dc "$chars" | head -c "$length")
    elif [[ -r /dev/urandom ]]; then
        result=$(tr -dc "$chars" < /dev/urandom | head -c "$length")
    else
        # Fallback to $RANDOM (less secure but works)
        for ((i=0; i<length; i++)); do
            result+="${chars:$((RANDOM % ${#chars})):1}"
        done
    fi
    
    # Ensure we got the right length
    while [[ ${#result} -lt $length ]]; do
        result+="${chars:$((RANDOM % ${#chars})):1}"
    done
    
    echo "${result:0:$length}"
}

# Calculate checksum for a key (last 4 characters)
calculate_checksum() {
    local key_body="$1"
    local checksum
    
    # Use first 8 chars of SHA256, convert to base36 (0-9, A-Z)
    checksum=$(echo -n "$key_body" | sha256sum | cut -c1-6)
    # Convert hex to decimal and then to base36
    local decimal=$((16#$checksum))
    # Get 4 characters in base36
    printf '%04X' $((decimal % 0x10000)) | tr '0-9A-F' '0-9A-Z'
}

# Generate a single alpha access key
generate_key() {
    local key_body=""
    local segments=()
    
    # Generate 3 random segments (4th is checksum)
    for ((i=0; i<((KEY_SEGMENTS-1)); i++)); do
        segments+=("$(generate_random_segment $KEY_SEGMENT_LENGTH)")
    done
    
    # Create key body (without checksum)
    key_body="${KEY_PREFIX}-$(IFS='-'; echo "${segments[*]}")"
    
    # Calculate checksum for the 4th segment
    local checksum
    checksum=$(calculate_checksum "$key_body")
    segments+=("$checksum")
    
    # Construct final key
    echo "${KEY_PREFIX}-$(IFS='-'; echo "${segments[*]}")"
}

# Validate an alpha access key
validate_key() {
    local key="$1"
    local expected_format="^${KEY_PREFIX}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$"
    
    # Check format
    if [[ ! $key =~ $expected_format ]]; then
        return 1
    fi
    
    # Extract parts
    IFS='-' read -ra parts <<< "$key"
    local prefix="${parts[0]}"
    local segment1="${parts[1]}"
    local segment2="${parts[2]}"
    local segment3="${parts[3]}"
    local checksum="${parts[4]}"
    
    # Verify prefix
    if [[ "$prefix" != "$KEY_PREFIX" ]]; then
        return 1
    fi
    
    # Calculate expected checksum
    local key_body="${KEY_PREFIX}-${segment1}-${segment2}-${segment3}"
    local expected_checksum
    expected_checksum=$(calculate_checksum "$key_body")
    
    # Verify checksum
    if [[ "$checksum" != "$expected_checksum" ]]; then
        return 1
    fi
    
    return 0
}

# Generate keys and output in text format
generate_keys_text() {
    local count=$1
    local output_file=$2
    local keys=()
    
    log INFO "Generating $count alpha access keys..."
    
    for ((i=0; i<count; i++)); do
        keys+=("$(generate_key)")
        
        # Progress indicator for large batches
        if (( (i+1) % 10 == 0 )); then
            log DEBUG "Generated $((i+1))/$count keys..."
        fi
    done
    
    # Check for duplicates (shouldn't happen but safety check)
    local unique_keys=($(printf '%s\n' "${keys[@]}" | sort -u))
    if [[ ${#unique_keys[@]} -ne ${#keys[@]} ]]; then
        log WARN "Duplicate keys detected! Regenerating..."
        # Simple retry (in practice, you'd want a more sophisticated approach)
        keys=($(printf '%s\n' "${keys[@]}" | sort -u))
        while [[ ${#keys[@]} -lt $count ]]; do
            keys+=("$(generate_key)")
        done
    fi
    
    # Output to file or stdout
    if [[ -n "$output_file" ]]; then
        {
            echo "# Armored Archer Alpha Access Keys"
            echo "# Generated: $(date)"
            echo "# Count: ${#keys[@]}"
            echo "# Format: ALPHA-XXXX-XXXX-XXXX-XXXX"
            echo "# =========================================="
            echo ""
            printf '%s\n' "${keys[@]}"
        } > "$output_file"
        log INFO "Keys saved to: $output_file"
    else
        printf '%s\n' "${keys[@]}"
    fi
    
    log INFO "Successfully generated ${#keys[@]} unique keys"
}

# Generate keys and output in CSV format
generate_keys_csv() {
    local count=$1
    local output_file=$2
    
    log INFO "Generating $count alpha access keys in CSV format..."
    
    {
        echo "key,generated_at,status,tier,discord_id,email,notes"
        for ((i=0; i<count; i++)); do
            local key
            key=$(generate_key)
            echo "$key,$(date -Iseconds),available,,,,"
            
            if (( (i+1) % 10 == 0 )); then
                log DEBUG "Generated $((i+1))/$count keys..."
            fi
        done
    } > "${output_file:-alpha_keys_${TIMESTAMP}.csv}"
    
    log INFO "CSV keys saved to: ${output_file:-alpha_keys_${TIMESTAMP}.csv}"
}

# Generate keys and output in JSON format
generate_keys_json() {
    local count=$1
    local output_file=$2
    
    log INFO "Generating $count alpha access keys in JSON format..."
    
    {
        echo "{"
        echo "  \"metadata\": {"
        echo "    \"generated_at\": \"$(date -Iseconds)\","
        echo "    \"count\": $count,"
        echo "    \"version\": \"1.0\","
        echo "    \"program\": \"Armored Archer v2.1.0 Alpha\""
        echo "  },"
        echo "  \"keys\": ["
        
        for ((i=0; i<count; i++)); do
            local key
            key=$(generate_key)
            local comma=","
            if (( i == count-1 )); then
                comma=""
            fi
            echo "    {"
            echo "      \"key\": \"$key\","
            echo "      \"generated_at\": \"$(date -Iseconds)\","
            echo "      \"status\": \"available\","
            echo "      \"tier\": null,"
            echo "      \"discord_id\": null,"
            echo "      \"email\": null,"
            echo "      \"notes\": null"
            echo "    }$comma"
            
            if (( (i+1) % 10 == 0 )); then
                log DEBUG "Generated $((i+1))/$count keys..."
            fi
        done
        
        echo "  ]"
        echo "}"
    } > "${output_file:-alpha_keys_${TIMESTAMP}.json}"
    
    log INFO "JSON keys saved to: ${output_file:-alpha_keys_${TIMESTAMP}.json}"
}

# Validate keys from a file
validate_keys_file() {
    local input_file=$1
    local valid=0
    local invalid=0
    local total=0
    
    log INFO "Validating keys from: $input_file"
    
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^key, ]] && continue # Skip CSV header
        
        # Extract key (handle CSV format)
        local key
        key=$(echo "$line" | cut -d',' -f1)
        
        ((total++))
        
        if validate_key "$key"; then
            ((valid++))
            log DEBUG "✓ Valid: $key"
        else
            ((invalid++))
            log WARN "✗ Invalid: $key"
        fi
    done < "$input_file"
    
    echo ""
    log INFO "Validation Results:"
    echo "  Total keys:   $total"
    echo -e "  ${GREEN}Valid keys:   $valid${NC}"
    echo -e "  ${RED}Invalid keys: $invalid${NC}"
    
    if [[ $invalid -gt 0 ]]; then
        return 1
    fi
    return 0
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    local count=$DEFAULT_COUNT
    local output_file=""
    local format="text"
    local verbose=false
    local validate=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -c|--csv)
                format="csv"
                shift
                ;;
            -j|--json)
                format="json"
                shift
                ;;
            --validate)
                validate=true
                shift
                ;;
            [0-9]*)
                count=$1
                shift
                ;;
            *)
                if [[ -z "$output_file" ]]; then
                    output_file=$1
                else
                    log ERROR "Unknown argument: $1"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate count
    if [[ $count -lt 1 ]]; then
        log ERROR "Count must be at least 1"
        exit 1
    fi
    
    if [[ $count -gt 10000 ]]; then
        log WARN "Generating $count keys may take a while..."
    fi
    
    # Set default output file if not specified
    if [[ -z "$output_file" ]]; then
        case "$format" in
            csv)  output_file="alpha_keys_${TIMESTAMP}.csv" ;;
            json) output_file="alpha_keys_${TIMESTAMP}.json" ;;
            *)    output_file="alpha_keys_${TIMESTAMP}.txt" ;;
        esac
    fi
    
    # Print header
    echo ""
    echo "=============================================="
    echo "  Armored Archer Alpha Access Key Generator"
    echo "  Version 1.0 - v2.1.0 Alpha Testing Program"
    echo "=============================================="
    echo ""
    
    # Validate existing keys
    if [[ "$validate" == true ]]; then
        if [[ -z "$output_file" ]]; then
            log ERROR "Please specify a file to validate"
            usage
            exit 1
        fi
        validate_keys_file "$output_file"
        exit $?
    fi
    
    # Generate keys based on format
    case "$format" in
        text)
            generate_keys_text "$count" "$output_file"
            ;;
        csv)
            generate_keys_csv "$count" "$output_file"
            ;;
        json)
            generate_keys_json "$count" "$output_file"
            ;;
        *)
            log ERROR "Unknown format: $format"
            exit 1
            ;;
    esac
    
    # Print summary
    echo ""
    echo "=============================================="
    echo "  Generation Complete!"
    echo "=============================================="
    echo ""
    echo "Output file: $output_file"
    echo "Format: $format"
    echo "Keys generated: $count"
    echo ""
    echo "Next steps:"
    echo "  1. Store keys securely (e.g., password manager)"
    echo "  2. Import into database: backend/scripts/import-alpha-keys.sql"
    echo "  3. Distribute to selected alpha users"
    echo "  4. Track redemption status"
    echo ""
    echo "Security reminders:"
    echo "  - Do not commit keys to version control"
    echo "  - Do not share keys publicly"
    echo "  - Revoke compromised keys immediately"
    echo ""
}

# Run main function
main "$@"
