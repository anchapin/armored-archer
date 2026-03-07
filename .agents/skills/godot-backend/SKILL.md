---
keywords:
  - backend
  - nakama
  - server
  - api
  - rpc
  - database
description: Guidelines for working with the Nakama backend server and client-server communication
---

# Godot Backend Integration Skill

This skill provides guidance for working with the Nakama backend server in the Armored Archer project.

## Overview

The Armored Archer game uses Heroic Labs' Nakama as its authoritative multiplayer backend. All game logic, player data, and matchmaking are handled server-side for security.

## Backend Structure

```
/backend/
├── src/                  # TypeScript source files
├── build/                # Compiled JavaScript output
├── server/               # Nakama server configuration
├── modules/              # Custom Nakama modules
├── data/                 # Server data and migrations
├── tests/                # TypeScript test files
└── docker-compose.yml   # Docker Compose configuration
```

## Client-Server Communication

### Connecting to Nakama

The Godot client connects to Nakama using `@heroiclabs/nakama-js`. All connection logic is handled in `autoloads/NetworkManager.gd`.

### RPC Calls

Custom game logic is implemented via Nakama RPCs:
- Client sends actions (e.g., `{"action": "shoot", "angle": 0.78}`)
- Server validates and calculates results (damage, loot, etc.)
- Server sends authoritative state back to client

### Important RPC Principles

1. **Never trust client input** - Validate all data on server
2. **Server-authoritative combat** - Calculate combat results server-side based on stored player stats
3. **Server-generated loot** - Generate loot drops server-side to prevent manipulation

## Common Tasks

### Starting the Backend

```bash
cd backend && ./start.sh
```

### Accessing Nakama Console

- URL: http://localhost:7351
- Credentials: admin:password

### Running Migrations

```bash
docker exec -it armored_archer_server /nakama/nakama migrate up
```

### Running Tests

```bash
cd backend
npm test                 # Run all tests
npm run test:coverage    # Run with coverage
npm run test:integration # Run integration tests
```

### Building TypeScript

```bash
cd backend
npm run build            # Build TypeScript
npm run build:watch      # Build in watch mode
```

## Environment Configuration

- Backend uses `.env` files for configuration (never commit to version control)
- Copy `.env.example` to `.env` and configure before starting
- Use `./start.sh` script to validate environment and start services

## Error Handling

- Use async/await for Nakama API calls
- Wrap database operations in try-catch blocks
- Log errors but don't expose sensitive data to clients

## Key Dependencies

- `@heroiclabs/nakama-js` - Nakama client
- `zod` - Schema validation
- `@sentry/node` - Error tracking
- `winston` - Logging
- `prom-client` - Metrics
