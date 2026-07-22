# Makefile for Django REST + DRF Starter Project
# Usage: make <command>

# Default environment
ENV ?= dev

# Docker Compose configuration
COMPOSE_FILES = -f compose.yml -f compose.$(ENV).yml
ENV_FILE = --env-file .env

.PHONY: help build up down logs restart clean migrate makemigrations createsuperuser create-db collectstatic shell test lint format install-dev

help: ## Show this help message
	@echo 'Usage: make [command]'
	@echo ''
	@echo 'Commands:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Docker commands
build: ## Build Docker images
	docker compose $(ENV_FILE) $(COMPOSE_FILES) build

up: ## Start all services
	docker compose $(ENV_FILE) $(COMPOSE_FILES) up -d

up-logs: ## Start all services and follow logs
	docker compose $(ENV_FILE) $(COMPOSE_FILES) up

down: ## Stop all services
	docker compose $(ENV_FILE) $(COMPOSE_FILES) down

logs: ## Show logs for all services
	docker compose $(ENV_FILE) $(COMPOSE_FILES) logs -f

logs-web: ## Show logs for web service only
	docker compose $(ENV_FILE) $(COMPOSE_FILES) logs -f web

logs-celery: ## Show logs for celery services
	docker compose $(ENV_FILE) $(COMPOSE_FILES) logs -f celery celery-beat

restart: ## Restart all services
	docker compose $(ENV_FILE) $(COMPOSE_FILES) restart

restart-web: ## Restart web service only
	docker compose $(ENV_FILE) $(COMPOSE_FILES) restart web

clean: ## Remove all containers, volumes, and images
	docker compose $(ENV_FILE) $(COMPOSE_FILES) down -v --remove-orphans
	docker system prune -f

# Django management commands
migrate: ## Run database migrations
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py migrate

makemigrations: ## Create new database migrations
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py makemigrations

createsuperuser: ## Create Django superuser
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py createsuperuser

collectstatic: ## Collect static files
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py collectstatic --noinput

shell: ## Open Django shell
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py shell

dbshell: ## Open database shell
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py dbshell

# Development commands
test: ## Run tests
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py test

test-coverage: ## Run tests with coverage
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web coverage run --source='.' manage.py test
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web coverage report

# API Documentation commands
schema: ## Generate OpenAPI schema
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web python manage.py spectacular --color --file schema.yml

schema-local: ## Generate OpenAPI schema locally
	python manage.py spectacular --color --file schema.yml

docs: ## Open API documentation in browser (requires running server)
	@echo "API documentation available at:"
	@echo "  Swagger UI: http://localhost:8000/api/docs/"
	@echo "  ReDoc:      http://localhost:8000/api/redoc/"
	@echo "  Schema:     http://localhost:8000/api/schema/"

# Local development (without Docker)
install-local: ## Install dependencies locally
	pip install -r requirements.txt

migrate-local: ## Run migrations locally
	python manage.py migrate

runserver-local: ## Run development server locally
	python manage.py runserver

celery-local: ## Run Celery worker locally
	celery -A core worker -l info

celery-beat-local: ## Run Celery beat locally
	celery -A core beat -l info

# Environment-specific commands
dev: ## Start development environment
	$(MAKE) ENV=dev up

uat: ## Start UAT environment
	$(MAKE) ENV=uat up

prod: ## Start production environment
	$(MAKE) ENV=prod up

# Health checks
health: ## Check service health
	docker compose $(ENV_FILE) $(COMPOSE_FILES) ps
	@echo "Checking web service health..."
	curl -f http://localhost:8000/api/health/ || echo "Web service not responding"

# Database operations
create-db: ## Create backend_dev database if missing (fix: database "backend_dev" does not exist)
	@echo "Creating database backend_dev if it does not exist..."
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec db psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'backend_dev'" | grep -q 1 || \
	  docker compose $(ENV_FILE) $(COMPOSE_FILES) exec db psql -U postgres -c "CREATE DATABASE backend_dev;"
	@echo "Done."

backup-db: ## Backup database
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec db pg_dump -U postgres -d backend_$(ENV) > backup_$(ENV)_$(shell date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database (usage: make restore-db BACKUP_FILE=backup.sql)
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Please specify BACKUP_FILE=<file>"; exit 1; fi
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec -T db psql -U postgres -d backend_$(ENV) < $(BACKUP_FILE)

# Utility commands
ps: ## Show running containers
	docker compose $(ENV_FILE) $(COMPOSE_FILES) ps

images: ## Show Docker images
	docker compose $(ENV_FILE) $(COMPOSE_FILES) images

exec-web: ## Execute command in web container (usage: make exec-web CMD="command")
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec web $(CMD)

exec-db: ## Execute command in database container
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec db bash

exec-redis: ## Execute redis-cli in Redis container
	docker compose $(ENV_FILE) $(COMPOSE_FILES) exec redis redis-cli

# Environment setup helpers
setup-env: ## Copy environment file from example
	@echo "Copying environment file..."
	@if [ ! -f .env ]; then \
		cp env.example .env; \
		echo "Created .env file from env.example"; \
		echo "Don't forget to update the values in .env!"; \
		echo "Generate a new SECRET_KEY with: python -c \"import secrets; print(secrets.token_urlsafe(50))\""; \
	else \
		echo ".env file already exists"; \
	fi

# Quick start command
quickstart: setup-env build dev ## Setup environment files, build, and start development

# Production deployment helpers
deploy-prod: ## Deploy to production (build and start)
	$(MAKE) ENV=prod build
	$(MAKE) ENV=prod up

# Monitoring commands (when monitoring profile is enabled)
monitoring: ## Start with monitoring tools
	docker compose $(ENV_FILE) $(COMPOSE_FILES) --profile monitoring up -d
