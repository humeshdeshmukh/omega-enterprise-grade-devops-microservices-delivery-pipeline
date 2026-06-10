# Omega Enterprise Grade DevOps Microservices Delivery Pipeline

This is a comprehensive, end-to-end DevOps portfolio project showcasing a modern microservices architecture managed through industry-standard infrastructure and CI/CD tools.

## Architecture & Tools Used
*   **Application**: Python (FastAPI) Backend, React (Vite) Frontend, PostgreSQL Database.
*   **Containerization**: Docker & Docker Compose.
*   **Infrastructure as Code (IaC)**: Terraform targeting AWS via LocalStack.
*   **Continuous Integration (CI)**: GitHub Actions (Linting) & Jenkins (Build, Scan, Push).
*   **Continuous Deployment (CD)**: ArgoCD (GitOps).
*   **Orchestration**: Kubernetes (Minikube).
*   **Observability**: Prometheus, Grafana (Dashboard-as-Code), Loki.

## Getting Started

### Prerequisites
*   Docker & Docker Compose
*   Minikube & kubectl
*   Helm
*   Terraform

### Running the Project

To spin up the entire environment (Jenkins, LocalStack, Kubernetes Cluster, ArgoCD, Monitoring), run the startup script:

```bash
./start.sh
```

To tear down the environment:

```bash
./stop.sh
```

## Repository Structure
*   `app/`: Contains the frontend and backend source code and `Dockerfile`s.
*   `jenkins/`: Contains the fully executable CI/CD `Jenkinsfile`.
*   `k8s/`: Contains the Kubernetes manifests for the application and ArgoCD config.
*   `monitoring/`: Contains custom Grafana dashboards.
*   `scripts/`: Contains automation scripts for bootstrapping the cluster.
*   `terraform/`: Contains the IaC definitions for LocalStack mock AWS resources.

## Phase 11: AIOps (AI Log & Config Analysis)

The pipeline includes an AIOps feature powered by the Google Gemini API (`gemini-3.1-flash-lite`), which analyzes logs, Kubernetes manifests, and Terraform configuration files to identify root causes and suggest immediate DevOps remedies.

### Configuring Gemini AI
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and replace `GEMINI_API_KEY` with your actual Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
3. Run the environment:
   ```bash
   ./start.sh
   ```
   *If no key is configured, the dashboard will run in a warning-enabled **Mock Demo Mode** to allow visual and interface exploration.*
