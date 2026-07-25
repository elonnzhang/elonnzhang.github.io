SHELL := /bin/sh

RUBY_IMAGE ?= ruby:3.3-bookworm
BUNDLE_VOLUME ?= elonnzhang_blog_bundle
CONTAINER_NAME ?= elonnzhang-blog-dev
CONTAINER_LABEL ?= io.github.elonnzhang.blog.dev
PORT ?= 4173
LIVERELOAD_PORT ?= 35729

DOCKER_RUN = docker run --rm \
	-e BUNDLE_PATH=/bundle \
	-v "$(CURDIR):/srv/jekyll" \
	-v "$(BUNDLE_VOLUME):/bundle" \
	-w /srv/jekyll \
	$(RUBY_IMAGE)

.DEFAULT_GOAL := help

.PHONY: help doctor check-ports setup serve serve-drafts build check clean shell stop \
	native-setup native-serve native-build

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

doctor: ## Check local development prerequisites
	@command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "docker daemon is not running"; exit 1; }
	@command -v make >/dev/null 2>&1 || { echo "make is required"; exit 1; }
	@test -f Gemfile || { echo "Gemfile not found"; exit 1; }
	@echo "development environment: ok"

check-ports:
	@for port in "$(PORT)" "$(LIVERELOAD_PORT)"; do \
		container_ids=$$(docker ps -q --filter "publish=$$port"); \
		if [ -n "$$container_ids" ]; then \
			echo "port $$port is already published by Docker container(s):"; \
			docker ps --filter "publish=$$port" --format '  {{.ID}}  {{.Names}}  {{.Ports}}'; \
			echo "stop the listed container with 'docker rm -f <container-id>', or use PORT=4174 LIVERELOAD_PORT=35730"; \
			exit 1; \
		fi; \
		if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$$port" -sTCP:LISTEN >/dev/null 2>&1; then \
			echo "port $$port is already in use by a local process"; \
			echo "stop that process, or use PORT=4174 LIVERELOAD_PORT=35730"; \
			exit 1; \
		fi; \
	done

setup: doctor ## Install gems into the Docker volume
	@docker volume create "$(BUNDLE_VOLUME)" >/dev/null
	@$(DOCKER_RUN) sh -lc 'bundle check || bundle install'

serve: check-ports setup ## Start Jekyll with live reload
	@echo "site:       http://127.0.0.1:$(PORT)"
	@echo "livereload: http://127.0.0.1:$(LIVERELOAD_PORT)"
	@docker run --rm \
		--name "$(CONTAINER_NAME)" \
		--label "$(CONTAINER_LABEL)=true" \
		-e BUNDLE_PATH=/bundle \
		-p "127.0.0.1:$(PORT):4000" \
		-p "127.0.0.1:$(LIVERELOAD_PORT):35729" \
		-v "$(CURDIR):/srv/jekyll" \
		-v "$(BUNDLE_VOLUME):/bundle" \
		-w /srv/jekyll \
		$(RUBY_IMAGE) \
		sh -lc 'bundle exec jekyll serve --host 0.0.0.0 --port 4000 --livereload --livereload-port 35729 --strict_front_matter'

serve-drafts: check-ports setup ## Start Jekyll with drafts and unpublished content
	@echo "site: http://127.0.0.1:$(PORT)"
	@docker run --rm \
		--name "$(CONTAINER_NAME)" \
		--label "$(CONTAINER_LABEL)=true" \
		-e BUNDLE_PATH=/bundle \
		-p "127.0.0.1:$(PORT):4000" \
		-p "127.0.0.1:$(LIVERELOAD_PORT):35729" \
		-v "$(CURDIR):/srv/jekyll" \
		-v "$(BUNDLE_VOLUME):/bundle" \
		-w /srv/jekyll \
		$(RUBY_IMAGE) \
		sh -lc 'bundle exec jekyll serve --host 0.0.0.0 --port 4000 --livereload --livereload-port 35729 --drafts --unpublished --strict_front_matter'

build: setup ## Build the site with GitHub Pages safe mode
	@$(DOCKER_RUN) sh -lc 'bundle exec jekyll build --safe --strict_front_matter'

check: build ## Run the production build and whitespace checks
	@git diff --check
	@test -f _site/index.html
	@test -f _site/code-space/index.html
	@echo "checks: ok"

clean: ## Remove generated Jekyll files
	@rm -rf _site .jekyll-cache .jekyll-metadata
	@echo "generated files removed"

shell: setup ## Open a shell in the development container
	@$(DOCKER_RUN) sh

stop: ## Stop the named development container
	@container_ids=$$(docker ps -aq --filter "label=$(CONTAINER_LABEL)=true"); \
	if [ -n "$$container_ids" ]; then \
		docker rm -f $$container_ids >/dev/null; \
		echo "development container stopped"; \
	else \
		docker rm -f "$(CONTAINER_NAME)" >/dev/null 2>&1 || true; \
		echo "no labeled development container is running"; \
	fi

native-setup: ## Install gems with the local Ruby toolchain
	bundle install

native-serve: ## Start Jekyll with the local Ruby toolchain
	bundle exec jekyll serve --host 127.0.0.1 --port "$(PORT)" --livereload --strict_front_matter

native-build: ## Build with the local Ruby toolchain
	bundle exec jekyll build --safe --strict_front_matter
