# Local Services Setup

This guide covers how to set up local services for development, including the Nakama game server and PostgreSQL database.

## Overview

Armored Archer requires the following local services for development:

| Service | Purpose | Default Port |
|---------|---------|---------------|
| Nakama | Game server (multiplayer, authentication, leaderboards) | 7350 (API), 7351 (Console) |
| PostgreSQL | Database for user data, leaderboards, inventory | 5432 |

Both services are provided via Docker Compose in the `backend/` directory.

## Prerequisites

### Required Software

- **Docker** - Install from [docker.com](https://www.docker.com/get-started)
- **Docker Compose** - Usually included with Docker Desktop
- **Node.js 18+** - For backend development ([nodejs.org](https://nodejs.org/))
- **npm** - Comes with Node.js

### Verify Installation

```bash
# Check Docker
docker --version

# Check Docker Compose
docker-compose --version

# Check Node.js
node --version
```

## Quick Start

### 1. Clone and Navigate

```bash
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings. The default values work for local development:

```env
# Database
POSTGRES_PASSWORD=changeme
DATABASE_ADDRESS=postgres:changeme@postgres:5432/nakama

# Nakama Server
NAKAMA_SERVER_KEY=defaultkey
SESSION_ENCRYPTION_KEY=default-token-key
REFRESH_ENCRYPTION_KEY=default-refresh-key
```

### 4. Start Services

#### Option A: Using Make (Recommended)

```bash
# From project root
make backend-start
```

#### Option B: Using Docker Compose Directly

```bash
cd backend
docker-compose up -d
```

#### Option C: Using the Setup Script

```bash
cd backend
./start.sh
```

### 5. Verify Services are Running

```bash
# Check container status
docker ps

# Test Nakama API
curl http://localhost:7350/

# View logs
docker-compose logs -f
```

## Service URLs

Once running, services are available at:

| Service | URL | Credentials |
|---------|-----|-------------|
| Nakama API | http://localhost:7350 | Use `NAKAMA_SERVER_KEY` from `.env` |
| Nakama Console | http://localhost:7351 | admin / password |
| PostgreSQL | localhost:5432 | postgres / changeme |

## Development Workflow

### Running the Game

1. Start backend: `make backend-start`
2. Open project in Godot 4.x
3. Press F5 to run

### Backend Development

```bash
# Start with auto-reload
make backend-dev

# Run tests
make backend-test

# Build TypeScript
make backend-build
```

### Stopping Services

```bash
# Stop containers
make backend-stop

# Or directly
cd backend
docker-compose down
```

## Database Management

### Running Migrations

```bash
make backend-migrate
```

### Viewing Schema

```bash
make backend-db-schema
```

### Creating New Migrations

```bash
make backend-migrate-new
```

## Troubleshooting

### Containers Won't Start

1. Check Docker is running:
   ```bash
   docker ps
   ```

2. Check port availability:
   ```bash
   lsof -i :7350 -i :7351 -i :5432
   ```

3. View container logs:
   ```bash
   docker-compose logs
   ```

### Database Connection Issues

1. Ensure PostgreSQL is healthy:
   ```bash
   docker-compose ps
   ```

2. Check environment variables in `.env`

3. Verify DATABASE_ADDRESS format:
   ```
   postgres:<password>@postgres:5432/nakama
   ```

### Nakama Console Access

- URL: http://localhost:7351
- Default credentials: admin / password
- Change password in production!

### Reset Development Environment

To reset everything:

```bash
# Stop and remove containers
cd backend
docker-compose down -v

# Remove node_modules
rm -rf node_modules

# Reinstall and start
npm install
docker-compose up -d
```

## Security Notes

- **Never commit** `.env` files to version control
- Use **different credentials** for development, staging, and production
- Change default passwords before deploying to production
- Keep Docker images updated

## Additional Resources

- [Backend README](../backend/README.md) - Detailed backend documentation
- [Environment Configuration](../backend/ENVIRONMENTS.md) - Environment-specific setup
- [Nakama Documentation](https://heroiclabs.com/docs/nakama/) - Server reference
- [Docker Compose Documentation](https://docs.docker.com/compose/) - Container orchestration
