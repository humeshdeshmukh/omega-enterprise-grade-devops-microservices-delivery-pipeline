.PHONY: help up down cluster-setup cluster-teardown test

help:
	@echo "Omega Enterprise DevOps Project Makefile"
	@echo "Usage:"
	@echo "  make up               - Spin up LocalStack, Jenkins, SonarQube, and Nexus"
	@echo "  make down             - Tear down the local infrastructure"
	@echo "  make cluster-setup    - Initialize Minikube and install all Helm charts (Istio, Vault, etc.)"
	@echo "  make cluster-teardown - Stop and delete the Minikube cluster"
	@echo "  make test             - Run pre-commit checks locally"

up:
	@echo "Starting Local Infrastructure..."
	docker-compose -f docker-compose-local-env.yml up -d

down:
	@echo "Stopping Local Infrastructure..."
	docker-compose -f docker-compose-local-env.yml down

cluster-setup:
	@echo "Running Ansible Playbook to setup cluster..."
	ansible-playbook ansible/setup-env.yml

cluster-teardown:
	@echo "Destroying Minikube Cluster..."
	minikube delete

test:
	@echo "Running Pre-Commit Hooks..."
	pre-commit run --all-files
