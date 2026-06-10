#!/bin/bash
set -e

echo "🚀 Starting Omega DevOps Environment..."

# Check if offline/local flag is passed
OFFLINE_MODE=false
for arg in "$@"; do
  if [ "$arg" = "--local" ] || [ "$arg" = "--offline" ]; then
    OFFLINE_MODE=true
  fi
done

# If not explicitly set, auto-detect connectivity
if [ "$OFFLINE_MODE" = "false" ]; then
  echo "Checking network connectivity..."
  if ! curl -s --connect-timeout 4 https://github.com > /dev/null; then
    echo "⚠️  Internet connection is unreachable."
    OFFLINE_MODE=true
  fi
fi

if [ "$OFFLINE_MODE" = "true" ]; then
  echo "📴 Running in OFFLINE/LOCAL mode."
  echo "👉 Skipping Kubernetes cluster setup and external tool installations."
else
  echo "📶 Running in ONLINE mode. Proceeding with full cluster setup."
fi

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
if [ "$OFFLINE_MODE" = "false" ]; then
  echo "Initializing Kubernetes Cluster and tools..."
  ./scripts/setup-cluster.sh
else
  echo "⏭️  Skipped Kubernetes cluster setup (offline/local mode)."
fi

echo "✅ Environment is running!"
echo "--------------------------------------------------"
echo "Vite Frontend: http://localhost:80"
echo "FastAPI Backend: http://localhost:8000"
echo "Jenkins CI/CD: http://localhost:8080"
echo "SonarQube Quality Gate: http://localhost:9000"
echo "Nexus Artifact Repository: http://localhost:8081"
echo "LocalStack AWS Mock: http://localhost:4566"
echo "--------------------------------------------------"
