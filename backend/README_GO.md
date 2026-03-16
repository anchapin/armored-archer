# Armored Archer Backend - Go Edition

Backend server for Armored Archer game built with Nakama (Go) and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- **Go 1.21+** - Install from [go.dev](https://go.dev/dl/)
- **Docker & Docker Compose** - For local Nakama backend
- **Nakama 3.21+** - Game server (included in Docker Compose)

### Installation

```bash
# Clone the repository
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer/backend

# Install Go dependencies
go mod download

# Start Nakama backend with Docker
docker compose up -d
```

### Build

```bash
# Build Go plugin for Nakama
CGO_ENABLED=1 go build -buildmode=plugin -o build/server.so ./cmd/server

# Verify build
ls -lh build/server.so
# Output: -rw-r--r-- 1 user user 9.4M build/server.so
```

### Run Tests

```bash
# Run all tests
go test ./internal/... -v

# Run specific module tests
go test ./internal/gear/... -v
go test ./internal/combat/... -v
go test ./internal/matchmaking/... -v

# Run with coverage
go test ./internal/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

---

## 📁 Directory Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Nakama module entry point (InitModule)
├── internal/                     # Internal packages (not importable)
│   ├── player/                  # Player stats & progression
│   ├── combat/                  # Combat system logic
│   ├── gear/                    # Gear generation & inventory
│   ├── matchmaking/             # PvP matchmaking & rankings
│   ├── rpg/                     # XP, levels, stat allocation
│   ├── season/                  # Seasonal content & leaderboards
│   ├── store/                   # IAP & currency management
│   ├── notifications/           # Push notifications
│   ├── observability/           # Metrics, health, monitoring
│   ├── circuitbreaker/          # Circuit breaker pattern
│   ├── errors/                  # Error types & helpers
│   ├── session/                 # Session validation
│   ├── logger/                  # Structured logging
│   ├── analytics/               # Analytics event tracking
│   ├── database/                # Database helpers
│   ├── storage/                 # Storage helpers
│   ├── reports/                 # Player reports
│   └── anticheat/               # Anti-cheat validation
├── tests/                        # Integration tests
│   ├── testhelpers/             # Test helper library
│   ├── player/                  # Player tests
│   ├── combat/                  # Combat tests
│   ├── gear/                    # Gear tests
│   ├── matchmaking/             # Matchmaking tests
│   ├── season/                  # Season tests
│   ├── rpg/                     # RPG tests
│   ├── store/                   # Store tests
│   ├── notifications/           # Notification tests
│   └── observability/           # Observability tests
├── build/                        # Compiled Go plugin
│   └── server.so                # Nakama Go module
├── data/                         # Nakama data & migrations
├── server/                       # Nakama server config
├── docker-compose.yml            # Docker Compose configuration
├── nakama.yml                    # Nakama server configuration
├── go.mod                        # Go module definition
├── go.sum                        # Go dependency lockfile
└── build-go.sh                   # Build script for Go plugin
```

---

## 🛠 Development

### Local Development

```bash
# Start all services (Nakama, PostgreSQL, Redis, Prometheus, Grafana)
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f nakama

# Stop services
docker compose down
```

### Hot Reload

For development with auto-reload, use a file watcher:

```bash
# Install air (Go hot reload tool)
go install github.com/cosmtrek/air@latest

# Run with hot reload
air -c .air.toml
```

### Code Generation

```bash
# Format all Go files
go fmt ./...

# Run linter
golangci-lint run

# Run tests with race detector
go test -race ./...
```

---

## 📦 Available Modules

### Player Module (`internal/player/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/player"

// Create default player stats
stats := player.DefaultPlayerStats("user123")

// Add XP and handle level ups
levelsGained, newXp := stats.AddXP(100, "pve")

// Allocate stat points
err := stats.AllocateStat(player.StatAttack, 5)
```

### Combat Module (`internal/combat/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/combat"

// Create match state
matchState := combat.NewMatchState("match123", "creator1", "opponent1", creatorStats, opponentStats)

// Process combat action
result, err := combat.ProcessCombatAction(matchState, action, attackerStats, defenderStats)
```

### Gear Module (`internal/gear/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/gear"

// Generate gear item
gearItem := gear.GenerateGearItem("user123", gear.GearTypeBow, bossDefeated)

// Manage inventory
inv := gear.NewPlayerInventory("user123")
inv.AddGear(gearItem)
inv.EquipGear(gearItem.ID, gear.SlotBow)
```

### Matchmaking Module (`internal/matchmaking/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/matchmaking"

// Create PvP match
match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150, matchmaking.MatchTypeRanked, false)

// Calculate Elo changes
winnerChange, loserChange := matchmaking.CalculateEloChange(1000, 1200, true)
```

### RPG Module (`internal/rpg/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/rpg"

// Create player stats
stats := rpg.NewPlayerStats("user123")

// Calculate level from XP
level := rpg.CalculateLevel(5000)

// Validate stat allocation
err := rpg.ValidateStatAllocation(10, 20, rpg.StatAttack)
```

### Store Module (`internal/store/`)

```go
import "github.com/anchapin/armored-archer/backend/internal/store"

// Manage currency
balance := store.NewCurrencyBalance("user123")
balance.AddCurrency(store.CurrencyGems, 100)
balance.SpendCurrency(store.CurrencyGems, 50)

// Validate purchase
err := purchaseRequest.Validate()
```

---

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
POSTGRES_PASSWORD=changeme
DATABASE_ADDRESS=postgres://postgres:changeme@postgres:5432/nakama
NAKAMA_SERVER_KEY=defaultkey
SESSION_ENCRYPTION_KEY=default-token-key
REFRESH_ENCRYPTION_KEY=default-refresh-key

# Optional
REVENUECAT_PUBLIC_API_KEY=rc_public_key
FIREBASE_API_KEY=firebase_key
```

### Nakama Configuration

Edit `nakama.yml` to configure the Go module:

```yaml
runtime:
  path: /nakama/data
  go_entrypoint: "modules/server.so"
```

---

## 🧪 Testing

### Run Tests

```bash
# All tests
go test ./...

# Specific package
go test ./internal/gear/...

# With verbose output
go test -v ./internal/...

# With coverage
go test -cover ./internal/...

# With race detector
go test -race ./internal/...
```

### Test Helpers

The `tests/testhelpers/` package provides assertion helpers:

```go
import "github.com/anchapin/armored-archer/backend/tests/testhelpers"

func TestExample(t *testing.T) {
    testhelpers.AssertEqual(t, expected, actual, "Values should match")
    testhelpers.AssertNoError(t, err, "Should not error")
    testhelpers.AssertTrue(t, condition, "Condition should be true")
}
```

---

## 📊 Observability

### Health Checks

```bash
# Check Nakama health
curl http://localhost:7350/health
```

### Metrics

Prometheus metrics are exposed at:

```
http://localhost:9100/metrics
```

Key metrics:
- `armored_archer_rpc_calls_total` - Total RPC calls
- `armored_archer_rpc_duration_seconds` - RPC duration histogram
- `armored_archer_matches_created_total` - Matches created
- `armored_archer_purchases_total` - IAP purchases

### Grafana Dashboards

Access Grafana at: http://localhost:3000

Default credentials: `admin` / `admin`

---

## 🚢 Deployment

### Build for Production

```bash
# Build optimized plugin
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -buildmode=plugin \
  -o build/server.so ./cmd/server
```

### Docker Deployment

```bash
# Build and deploy
docker compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Builds

```bash
# Development
go build -buildmode=plugin -o build/server.so ./cmd/server

# Production (optimized)
go build -ldflags="-s -w" -buildmode=plugin -o build/server.so ./cmd/server
```

---

## 🐛 Troubleshooting

### Plugin Load Errors

```
Error: Nakama fails to load Go module
```

**Solution**: Ensure `CGO_ENABLED=1` when building:
```bash
CGO_ENABLED=1 go build -buildmode=plugin -o build/server.so ./cmd/server
```

### Import Errors

```
Error: package not found
```

**Solution**: Run `go mod tidy` to sync dependencies:
```bash
go mod tidy
```

### Test Import Errors

```
Error: no required module provides package github.com/anchapin/armored-archer/backend/tests/testhelpers
```

**Solution**: Tests use relative imports within the tests directory:
```bash
cd tests
go test ./...
```

---

## 📚 Additional Resources

- [Nakama Go Documentation](https://heroiclabs.com/docs/nakama/server-framework/go/)
- [Go Testing Guide](https://go.dev/doc/tutorial/add-a-test)
- [Go Modules Reference](https://go.dev/ref/mod)
- [Migration Summary](MIGRATION_SUMMARY.md)

---

## 📝 License

MIT License - See LICENSE file for details.
