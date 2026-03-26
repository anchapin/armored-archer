---
keywords:
  - godot
  - nakama
  - backend
  - multiplayer
  - typescript
  - postgresql
description: Guidelines for working with Godot client and Nakama TypeScript server integration
---

# Godot Backend Skill

Guidelines for working with the Godot game client and Nakama server integration.

## Project Structure

- `backend/` - Nakama TypeScript server implementation
- Godot client in root directory (scenes/, scripts/, autoloads/)

## Architecture

- **Client:** Godot 4.x with GDScript
- **Server:** Nakama (Go-based) with TypeScript runtime
- **Database:** PostgreSQL
- **Communication:** WebSocket (Nakama socket) + HTTP REST

## Backend Commands

```bash
# Start backend services (Docker Compose)
cd backend && ./start.sh

# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Key Services

- **Nakama Server:** `localhost:7350` (game traffic)
- **Nakama Console:** `localhost:7351` (admin:password)
- **PostgreSQL:** `localhost:5432`

## Godot-Nakama Integration

### NetworkManager (autoloads/NetworkManager.gd)

Handles connection to Nakama server:
- `connect_to_server()` - Establish connection
- `authenticate()` - Login/register
- `get_socket()` - Get WebSocket for real-time comms

### Common RPC Calls

Use `NetworkManager.rpc()` to call server functions:
```gdscript
var result = await NetworkManager.rpc("get_player_stats", {})
```

### Client-Server Authority

- Server is authoritative for: player stats, inventory, combat results, loot drops
- Client handles: input processing, local prediction, visual effects
- Never trust client-sent damage numbers - server calculates

## Common Tasks

### Adding New RPC

1. Create function in `backend/src/rpc/` 
2. Register in `backend/src/index.ts`
3. Test with: `await NetworkManager.rpc("rpc_name", {param: value})`

### Database Changes

1. Create migration in `backend/data/migrations/`
2. Run: `docker exec -it armored_archer_server /nakama/nakama migrate up`
3. Verify with: `docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'`

### Testing Multiplayer

1. Start backend: `cd backend && ./start.sh`
2. Run game in two Godot instances
3. Create/join match via UI

## Environment Variables

Create `backend/.env` from `.env.example`:
- `NAKAMA_SERVER_KEY` - Server authentication
- `POSTGRES_PASSWORD` - Database password
- `NAKAMA_PORT` - Server port (default: 7350)

## Troubleshooting

### Connection Issues

- Check backend is running: `docker ps`
- Check ports not blocked: `localhost:7350` reachable
- Check server key matches in client and server

### RPC Failures

- Check function exists in backend
- Check parameters match expected types
- Check server logs: `docker logs armored_archer_server`

### Database Issues

- Check PostgreSQL running: `docker ps | grep postgres`
- Check migrations applied: `docker exec armored_archer_server /nakama/nakama migrate list`