---
keywords:
  - godot
  - nakama
  - backend
  - multiplayer
  - game-server
description: Guidelines for working with Godot backend and Nakama server integration
---

# Godot Backend Skill

This skill provides guidance for working with the Godot game engine backend and Nakama server integration.

## Project Structure

- `backend/` - Nakama server implementation (Go)
- `godot/` - Godot game client

## Backend API

The Nakama server provides the following main features:
- Authentication (email/password, device)
- Real-time multiplayer matches
- Leaderboards
- Storage (persistent key-value)

## Common Tasks

### Running the Backend

```bash
cd backend && go run main.go
```

### Environment Variables

Required environment variables:
- `NAKAMA_HOST` - Server hostname
- `NAKAMA_PORT` - Server port (default: 7349)
- `NAKAMA_SERVER_KEY` - Server key for authentication

### Testing the API

Use the OpenAPI documentation at `backend/docs/openapi.yaml` to understand available endpoints.
