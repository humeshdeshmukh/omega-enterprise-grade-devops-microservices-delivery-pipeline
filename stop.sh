#!/bin/bash

echo "🛑 Stopping Omega DevOps Environment..."

# 1. Stop Docker Compose services
echo "Stopping Docker containers..."
docker-compose -f docker-compose-local-env.yml down
docker-compose down

# 2. Stop Minikube Cluster
if minikube status >/dev/null 2>&1; then
    echo "Stopping Minikube..."
    minikube stop
fi

echo "✅ Environment stopped successfully."
