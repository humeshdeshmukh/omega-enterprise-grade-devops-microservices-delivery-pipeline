#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Omega Local Cluster Setup..."

# 1. Start Minikube
echo "📦 Starting Minikube cluster..."
minikube start --cpus=4 --memory=8192

# Load .env variables to create K8s Secret for Gemini AIOps
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
fi

if [ ! -z "$GEMINI_API_KEY" ]; then
  echo "🔑 Creating Kubernetes Secret for Gemini API..."
  kubectl create secret generic omega-gemini-secret \
    --from-literal=GEMINI_API_KEY="$GEMINI_API_KEY" \
    --from-literal=GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.1-flash-lite}" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

# 2. Install ArgoCD
echo "🐙 Installing ArgoCD..."
kubectl create namespace argocd || true
kubectl apply --server-side --force-conflicts -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Apply ArgoCD Application Manifest
echo "📄 Applying ArgoCD Application (GitOps Sync)..."
kubectl apply -f "$SCRIPT_DIR/../k8s/argocd-application.yaml"

# 4. Install Monitoring Stack (Prometheus & Grafana)
echo "📊 Installing Prometheus and Grafana..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || true
helm repo update
kubectl create namespace monitoring || true
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --timeout 15m0s

# 5. Apply Custom Grafana Dashboard ConfigMap
echo "📉 Injecting Custom Grafana Dashboard..."
kubectl apply -f "$SCRIPT_DIR/../k8s/grafana-dashboard-configmap.yaml"

# 6. Install Istio Service Mesh
echo "🕸️ Installing Istio Service Mesh..."
helm repo add istio https://istio-release.storage.googleapis.com/charts || true
helm repo update
kubectl create namespace istio-system || true
helm upgrade --install istio-base istio/base -n istio-system --wait --timeout 15m0s
helm upgrade --install istiod istio/istiod -n istio-system --wait --timeout 15m0s
kubectl label namespace default istio-injection=enabled --overwrite

# 7. Install HashiCorp Vault
echo "🔐 Installing HashiCorp Vault..."
helm repo add hashicorp https://helm.releases.hashicorp.com || true
helm repo update
helm upgrade --install vault hashicorp/vault --set "server.dev.enabled=true" --namespace default --timeout 15m0s

# 8. Install Logging Stack (Loki & Promtail)
echo "📝 Installing Loki and Promtail..."
helm repo add grafana https://grafana.github.io/helm-charts || true
helm repo update
helm upgrade --install loki grafana/loki-stack --namespace monitoring --timeout 15m0s

# 9. Install OPA Gatekeeper
echo "🛡️ Installing OPA Gatekeeper..."
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts || true
helm repo update
helm upgrade --install gatekeeper gatekeeper/gatekeeper --namespace gatekeeper-system --create-namespace --timeout 15m0s

# 10. Install KEDA
echo "📈 Installing KEDA..."
helm repo add kedacore https://kedacore.github.io/charts || true
helm repo update
helm upgrade --install keda kedacore/keda --namespace keda --create-namespace --timeout 15m0s

# 11. Install Jaeger
echo "🔍 Installing Jaeger Distributed Tracing..."
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts || true
helm repo update
helm upgrade --install jaeger jaegertracing/jaeger --namespace observability --create-namespace --timeout 15m0s

echo "✅ Setup Complete! Local cluster is running with all DevOps tools installed."
echo "Access Grafana: kubectl port-forward svc/monitoring-grafana 8080:80 -n monitoring"
echo "Access ArgoCD: kubectl port-forward svc/argocd-server -n argocd 8081:443"
