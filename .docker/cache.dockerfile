# Docker Cache Configuration for CI
#
# This Dockerfile sets up a cached environment for faster CI runs.
# Build once, reuse for multiple CI runs.
#
# Usage:
#   docker build -t armored-archer/ci-cache:latest -f .docker/cache.dockerfile .
#   docker run --rm -v $(pwd):/workspace armored-archer/ci-cache:latest npm install

FROM node:20-slim

# Set working directory
WORKDIR /workspace

# Install common build tools (minimal set)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create npm cache directory
RUN mkdir -p /root/.npm && \
    chown -R node:node /root/.npm

# Set npm config for faster installs
RUN npm config set fund false && \
    npm config set audit false && \
    npm config set loglevel warn

# Pre-install common dev dependencies (speeds up subsequent installs)
RUN npm install -g \
    typescript \
    @types/node \
    eslint \
    prettier \
    jest

# Create cache volume mount point
VOLUME ["/root/.npm"]

# Default command
CMD ["/bin/bash"]
