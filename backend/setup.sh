#!/bin/bash

# Armored Archer Backend Setup Script

echo "Setting up Armored Archer backend..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "docker-compose is not installed. Please install it first:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install docker-compose-plugin"
    echo ""
    exit 1
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Start Nakama and PostgreSQL
echo "Starting Nakama and PostgreSQL..."
docker-compose up -d

# Wait for Nakama to be healthy
echo "Waiting for Nakama to start..."
sleep 10

# Check Nakama health
echo "Checking Nakama health..."
curl -s http://localhost:7350/

echo ""
echo "Setup complete!"
echo "Nakama API: http://localhost:7350"
echo "Nakama Admin Console: http://localhost:7351 (admin/password)"
echo ""
echo "To stop the server: docker-compose down"
echo "To view logs: docker-compose logs -f"
