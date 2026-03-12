# Stage 1: Build frontend
FROM node:22-alpine AS frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# Stage 2: Build backend
FROM golang:1-alpine AS backend
RUN apk add --no-cache gcc musl-dev
WORKDIR /build
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -o /app/blog-server ./cmd/server
COPY --from=frontend /build/dist /app/static

# Stage 3: Runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend /app/blog-server .
COPY --from=backend /app/static ./static
COPY server/config.yaml .
COPY server/migrations ./migrations

EXPOSE 8082
ENTRYPOINT ["./blog-server"]
