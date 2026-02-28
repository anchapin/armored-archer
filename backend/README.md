# Armored Archer Backend

Backend server for Armored Archer game built with Nakama and PostgreSQL.

## Directory Structure

```
backend/
├── server/          # Nakama server configuration
├── modules/         # Custom Nakama modules
├── data/            # Server data and migrations
├── src/             # TypeScript source files
├── build/           # Compiled JavaScript output
├── docker-compose.yml  # Docker Compose configuration
├── nakama.yml       # Nakama server configuration
├── package.json     # Node.js dependencies
└── tsconfig.json    # TypeScript configuration
```

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start Nakama and PostgreSQL:
```bash
docker-compose up -d
```

3. Verify Nakama is running:
- API: http://localhost:7350
- Admin Console: http://localhost:7351 (username: admin, password: password)

4. Build TypeScript modules:
```bash
npm run build
```

## Development

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run build:watch` - Build in watch mode
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type check without building

## Nakama Configuration

The Nakama server is configured in `nakama.yml`:
- Server runs on port 7350
- Admin console on port 7351
- PostgreSQL connection on port 5432
- Session expiry: 2 hours

## Database

PostgreSQL is managed via Docker Compose. Connection string:
```
postgres://postgres:localdbpassword@localhost:5432/nakama
```

Run migrations:
```bash
docker exec -it armored_archer_server /nakama/nakama migrate up
```
