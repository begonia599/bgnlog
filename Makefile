.PHONY: dev dev-server dev-web build build-server build-web migrate clean

# Development
dev: dev-server dev-web

dev-server:
	cd server && go run ./cmd/server/

dev-web:
	cd web && pnpm dev

# Build
build: build-web build-server

build-web:
	cd web && pnpm build

build-server: build-web
	mkdir -p server/static
	cp -r web/dist/* server/static/
	cd server && go build -o blog-server ./cmd/server/

# Database
migrate:
	psql -h localhost -U postgres -d blog -f server/migrations/001_init.sql

# Clean
clean:
	rm -rf server/static server/blog-server web/dist
