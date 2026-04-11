# Custom Nakama image configured for PostgreSQL
FROM heroiclabs/nakama:3.21.1

# Create a wrapper script that waits for PostgreSQL, runs migrations, then starts Nakama
RUN echo '#!/bin/sh\n\
# Wait for PostgreSQL to be ready\n\
echo "Waiting for PostgreSQL to be ready..."\n\
for i in $(seq 1 60); do\n\
  if /nakama/nakama migrate up --database.address=postgres:changeme@postgres:5432/nakama 2>/dev/null; then\n\
    echo "PostgreSQL is ready and migrations applied"\n\
    break\n\
  fi\n\
  echo "Waiting for PostgreSQL... ($i/60)"\n\
  sleep 2\n\
done\n\
\n\
# Start Nakama with PostgreSQL configuration\n\
exec /nakama/nakama --name=nakama --database.address=postgres:changeme@postgres:5432/nakama\n\
' > /usr/local/bin/nakama-entrypoint.sh && chmod +x /usr/local/bin/nakama-entrypoint.sh

# Override the entrypoint to use the wrapper script
ENTRYPOINT ["/usr/local/bin/nakama-entrypoint.sh"]

