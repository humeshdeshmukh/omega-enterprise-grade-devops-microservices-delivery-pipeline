# Monitoring & Logging Setup

This project uses the `kube-prometheus-stack` for monitoring and `loki-stack` for centralized logging. 
Since these stacks consist of dozens of complex Kubernetes resources, we manage them via Helm.

## Prerequisites
Ensure Helm is installed:
```bash
helm version
```

## 1. Install Prometheus & Grafana (kube-prometheus-stack)
This stack installs Prometheus, Alertmanager, Grafana, and node-exporter.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
```

## 2. Install Loki & Promtail (Logging)
This stack aggregates logs from all your pods and makes them queryable in Grafana.

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install loki grafana/loki-stack --namespace monitoring
```

## Accessing Grafana
Once the pods are running, you can port-forward to access the Grafana dashboard:

```bash
kubectl port-forward svc/monitoring-grafana 8080:80 -n monitoring
```
Then navigate to `http://localhost:8080` in your browser. Default credentials are `admin` / `prom-operator`.
