.PHONY: help install dev test lint format typecheck run docker-up docker-down clean

# Default target
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development setup
install: ## Install dependencies
	uv sync

dev: ## Install with dev dependencies
	uv sync --all-extras

install-ocr: ## Install with OCR dependencies
	uv sync --extra ocr

# Code quality
lint: ## Run linter
	uv run ruff check src/ tests/

format: ## Format code
	uv run ruff format src/ tests/
	uv run ruff check --fix src/ tests/

typecheck: ## Run type checker
	uv run mypy src/

check: lint typecheck ## Run all checks

# Testing
test: ## Run tests
	uv run pytest

test-unit: ## Run unit tests only
	uv run pytest tests/unit/

test-integration: ## Run integration tests only
	uv run pytest tests/integration/

test-cov: ## Run tests with coverage
	uv run pytest --cov=brf_scraper --cov-report=html

test-verbose: ## Run tests with verbose output
	uv run pytest -v --tb=long

# Application
run: ## Run the application
	uv run brf-scraper

run-dev: ## Run in development mode
	uv run brf-scraper --debug

serve: ## Start the server
	uv run brf-scraper serve

crawl: ## Run a crawl (usage: make crawl URL=https://example.com)
	uv run brf-scraper crawl $(URL)

# Database
db-init: ## Initialize database
	uv run brf-scraper db init

db-migrate: ## Run migrations
	uv run brf-scraper db migrate

db-upgrade: ## Upgrade database
	uv run brf-scraper db upgrade

# Docker
docker-build: ## Build Docker image
	docker-compose build

docker-up: ## Start Docker services
	docker-compose up -d

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-restart: ## Restart Docker services
	docker-compose restart

# Cleanup
clean: ## Clean build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .mypy_cache .pytest_cache .ruff_cache htmlcov .coverage coverage.xml

clean-data: ## Clean data directories (WARNING: deletes all data)
	rm -rf data/pdfs/* data/exports/*

# Utilities
logs: ## View application logs
	tail -f logs/brf-scraper.log

shell: ## Open Python shell with app context
	uv run python -c "from brf_scraper import *; import IPython; IPython.start_ipython()"

# Pre-commit
pre-commit-install: ## Install pre-commit hooks
	uv run pre-commit install

pre-commit-run: ## Run pre-commit on all files
	uv run pre-commit run --all-files
