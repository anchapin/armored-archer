# Custom Nakama PostgreSQL Image (Retired — reference only)

> **Status (post-issue #858, post-PR #889): retired.** The `armored-archer/nakama-postgres:3.21.1` tag referenced in this directory was never published to a registry and broke job setup for both `act` and GitHub-hosted runners ("pull access denied"). CI now uses the standard upstream images directly via `.github/docker-compose.yml`:
>
> - Postgres: `postgres:14-alpine`
> - Nakama: `heroiclabs/nakama:3.21.1` (with an inline entrypoint that runs `nakama migrate up` then serves, with the PostgreSQL DSN).
>
> No custom image build is required. The Dockerfile and instructions below are kept **for historical reference only** — do not rebuild or push this image for current CI.

This directory historically contained a Dockerfile for a custom Nakama game server image configured for PostgreSQL.

## Why This Image Existed

The standard `heroiclabs/nakama` image defaults to CockroachDB for its database. The Armored Archer project uses PostgreSQL, and GitHub Actions service containers don't support passing custom command-line arguments to configure Nakama. This custom image solved that problem by baking the PostgreSQL configuration into the image.

The same configuration is now expressed as an inline entrypoint in `.github/docker-compose.yml`, removing the need for a published custom image.

## Image Details (historical)

- **Base Image**: `heroiclabs/nakama:3.21.1` (still used; see `Dockerfile` line 1)
- **Image Name (retired)**: `armored-archer/nakama-postgres:3.21.1`
- **Purpose**: Nakama server with pre-configured PostgreSQL support

## Features

1. **PostgreSQL Configuration**: Pre-configured to connect to PostgreSQL instead of CockroachDB
2. **Automatic Migrations**: Runs Nakama database migrations automatically on startup
3. **Dependency Waiting**: Waits for PostgreSQL to be ready before starting Nakama
4. **Health Check Compatible**: Includes standard Nakama health check endpoint

## Current Replacement (PR #889)

The custom image is superseded by `.github/docker-compose.yml`, which declares:

```yaml
postgres:
  image: postgres:14-alpine
  # ...

nakama:
  image: heroiclabs/nakama:3.21.1
  entrypoint:
    - "/bin/sh"
    - "-ecx"
    - >
      /nakama/nakama migrate up --database.address "postgres://postgres:changeme@postgres:5432/nakama" &&
      exec /nakama/nakama --database.address "postgres://postgres:changeme@postgres:5432/nakama"
```

Local `act` users no longer need to build a custom image; just `docker compose -f .github/docker-compose.yml up -d` (or rely on the on-demand service containers in the workflow itself).

## Using with Act (Local CI)

When running GitHub Actions workflows locally with `act`, point it at `.github/docker-compose.yml`:

```bash
ACT_SERVICES_FILE=.github/docker-compose.yml act -j backend-test --container-architecture linux/amd64
```

(`--pull=false` is no longer needed; the upstream `postgres:14-alpine` and `heroiclabs/nakama:3.21.1` images are pulled directly from Docker Hub.)

## Entrypoint Script (historical reference)

The custom image historically included an entrypoint script (`/usr/local/bin/nakama-entrypoint.sh`) that:

1. **Waits for PostgreSQL**: Checks for PostgreSQL availability (up to 60 retries, 2 seconds each)
2. **Runs Migrations**: Executes `nakama migrate up` to set up database schema
3. **Starts Nakama**: Launches Nakama with PostgreSQL configuration

The same behaviour is now expressed inline in `.github/docker-compose.yml` (see above).

### Configuration (historical)

The Nakama server was started with these arguments:

```bash
/nakama/nakama \
  --name=nakama \
  --database.address=postgres:changeme@postgres:5432/nakama
```

### Environment Variables

The image expected PostgreSQL to be available at:
- **Host**: `postgres`
- **Port**: `5432`
- **Database**: `nakama`
- **User**: `postgres`
- **Password**: `changeme`

These match the PostgreSQL service container configuration in the CI workflows.

## Troubleshooting

### Container Won't Start

If the Nakama container fails to start, check the logs:

```bash
docker logs <container-id>
```

Common issues:
- **PostgreSQL not ready**: The entrypoint waits up to 120 seconds (60 retries × 2 seconds)
- **Migration failures**: Check if the database schema conflicts with existing migrations

### Health Check Failures

If health checks fail:
1. Ensure PostgreSQL is running and accepting connections
2. Check that the Nakama migrations completed successfully
3. Verify the database credentials match the configuration

### Connection Issues

If the job container can't connect to Nakama:
1. Verify the service container is running: `docker ps`
2. Check network connectivity within the act-managed network
3. Ensure the port mapping is correct (`7350:7350`)

## Updating the Image

This image is retired. To change the Nakama configuration, edit `.github/docker-compose.yml` instead of rebuilding `.docker/nakama-postgres/`.

## See Also

- [Nakama Documentation](https://heroiclabs.com/docs/nakama/)
- [Nakama GitHub](https://github.com/heroiclabs/nakama)
- [Act Documentation](https://nektosact.com/)
- [`.github/docker-compose.yml`](../docker-compose.yml) — the current source of truth for CI service images
- [`docs/ACT_CI_SUMMARY.md`](../docs/ACT_CI_SUMMARY.md) — Full CI testing documentation
