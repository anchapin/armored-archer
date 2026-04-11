# Custom Nakama PostgreSQL Image

This directory contains the Dockerfile for a custom Nakama game server image configured for PostgreSQL.

## Why This Image Exists

The standard `heroiclabs/nakama` image defaults to CockroachDB for its database. The Armored Archer project uses PostgreSQL, and GitHub Actions service containers don't support passing custom command-line arguments to configure Nakama. This custom image solves that problem by baking the PostgreSQL configuration into the image.

## Image Details

- **Base Image**: `heroiclabs/nakama:3.21.1`
- **Image Name**: `armored-archer/nakama-postgres:3.21.1`
- **Purpose**: Nakama server with pre-configured PostgreSQL support

## Features

1. **PostgreSQL Configuration**: Pre-configured to connect to PostgreSQL instead of CockroachDB
2. **Automatic Migrations**: Runs Nakama database migrations automatically on startup
3. **Dependency Waiting**: Waits for PostgreSQL to be ready before starting Nakama
4. **Health Check Compatible**: Includes standard Nakama health check endpoint

## Building the Image

```bash
docker build -t armored-archer/nakama-postgres:3.21.1 -f .docker/nakama-postgres/Dockerfile .
```

## Using with Act (Local CI)

When running GitHub Actions workflows locally with `act`, use the `--pull=false` flag to use the locally built image:

```bash
act -j backend-test --container-architecture linux/amd64 --pull=false
```

## Using with GitHub Actions

For GitHub Actions CI, the image must be available in a container registry. The recommended approach is GitHub Container Registry (GHCR):

### Build and Push to GHCR

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag for GHCR
docker tag armored-archer/nakama-postgres:3.21.1 ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1

# Push to GHCR
docker push ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1
```

### Update Workflow Files

Update `.github/workflows/ci.yml` and `.github/workflows/test.yml`:

```yaml
services:
  nakama:
    image: ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1
    ports:
      - 7350:7350
    options: >-
      --health-cmd "/nakama/nakama healthcheck"
      --health-interval 10s
      --health-timeout 10s
      --health-retries 60
      --health-start-period 60s
```

## Entrypoint Script

The custom image includes an entrypoint script (`/usr/local/bin/nakama-entrypoint.sh`) that:

1. **Waits for PostgreSQL**: Checks for PostgreSQL availability (up to 60 retries, 2 seconds each)
2. **Runs Migrations**: Executes `nakama migrate up` to set up database schema
3. **Starts Nakama**: Launches Nakama with PostgreSQL configuration

### Configuration

The Nakama server is started with these arguments:

```bash
/nakama/nakama \
  --name=nakama \
  --database.address=postgres:changeme@postgres:5432/nakama
```

### Environment Variables

The image expects PostgreSQL to be available at:
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

If you need to change the Nakama configuration:

1. Edit `.docker/nakama-postgres/Dockerfile`
2. Rebuild the image:
   ```bash
   docker build -t armored-archer/nakama-postgres:3.21.1 -f .docker/nakama-postgres/Dockerfile .
   ```
3. For local testing, run act with `--pull=false`
4. For GitHub Actions, push the updated image to your registry

## See Also

- [Nakama Documentation](https://heroiclabs.com/docs/nakama/)
- [Nakama GitHub](https://github.com/heroiclabs/nakama)
- [Act Documentation](https://nektosact.com/)
- [docs/ACT_CI_SUMMARY.md](../docs/ACT_CI_SUMMARY.md) - Full CI testing documentation
