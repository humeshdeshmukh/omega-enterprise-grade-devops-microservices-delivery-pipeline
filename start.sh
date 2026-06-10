#!/bin/bash
set -e

echo "🚀 Starting Omega DevOps Environment..."

# Verify .env configuration
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    echo "GEMINI_API_KEY=AIzaSyAYSreABfIwQUG-jpABThGqUfddVj5TPWI" > .env
    echo "GEMINI_MODEL=gemini-3.1-flash-lite" >> .env
  fi
fi

# Load .env variables
export $(grep -v '^#' .env | xargs)

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "AIzaSyAYSreABfIwQUG-jpABThGqUfddVj5TPWI" ]; then
  echo "⚠️  WARNING: GEMINI_API_KEY is not set or using mock placeholder."
  echo "👉 AIOps diagnostics features will run in Mock Demo Mode."
  echo "👉 Set a valid Google Gemini API Key in .env to enable live AIOps analysis."
else
  echo "✅ Gemini API Key detected. Live AIOps diagnostics enabled."
fi

# 1. Start Local Infrastructure (Jenkins, LocalStack, SonarQube, Nexus)
echo "Spinning up Docker Compose services..."
docker-compose -f docker-compose-local-env.yml up -d
docker-compose up -d

# 2. Setup Kubernetes Cluster
echo "Initializing Kubernetes Cluster and tools..."
./scripts/setup-cluster.sh

echo "✅ Environment is running!"
echo "Jenkins is available at: http://localhost:8080"
echo "LocalStack is available at: http://localhost:4566"
