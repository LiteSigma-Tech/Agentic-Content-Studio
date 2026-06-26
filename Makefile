.DEFAULT_GOAL := help
PY ?= python

.PHONY: help install test demo up down build rebuild logs ps clean \
        run-gateway run-studio run-leads run-agents run-platform

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install Python deps (ffmpeg must be on PATH separately)
	$(PY) -m pip install -r requirements.txt

test: ## Run all offline test suites (41 tests)
	bash run_all_tests.sh

demo: ## Run the end-to-end demo across every slice
	$(PY) demo_e2e.py

run-gateway: ## Run the model gateway API on :8001
	uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

run-studio: ## Run the studio (video+audio) API on :8002
	uvicorn audio_studio.api:app --host 0.0.0.0 --port 8002 --reload

run-leads: ## Run the lead-gen API on :8003
	uvicorn lead_gen.api:app --host 0.0.0.0 --port 8003 --reload

run-agents: ## Run the agent-runtime API on :8004
	uvicorn agent_runtime.api:app --host 0.0.0.0 --port 8004 --reload

run-platform: ## Run the platform API on :8005
	uvicorn platform_core.app:app --host 0.0.0.0 --port 8005 --reload

up: ## Build + start all services with docker compose
	docker compose up --build

down: ## Stop all services
	docker compose down

build: ## Build the docker image
	docker compose build

rebuild: ## Rebuild the image without cache
	docker compose build --no-cache

logs: ## Tail service logs
	docker compose logs -f

ps: ## Show running services
	docker compose ps

clean: ## Remove __pycache__ and test caches
	@find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "cleaned"
