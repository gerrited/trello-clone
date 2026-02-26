# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first (API depends on it at runtime)
WORKDIR /app/packages/shared
RUN pnpm build

# Build the API
WORKDIR /app/apps/api
RUN pnpm build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Add build tools required for bcrypt native addon compilation
RUN apk add --no-cache python3 make g++

# Copy workspace config + API package.json
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY tsconfig.base.json ./

# Install only production dependencies (will compile bcrypt with build tools above)
RUN pnpm install --frozen-lockfile --prod

# Copy compiled shared package from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy built API from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy migrations (needed by migrate.js at runtime, resolved relative to dist/)
COPY apps/api/src/db/migrations ./apps/api/dist/migrations

# Copy entrypoint script
COPY apps/api/docker-entrypoint.sh ./apps/api/
RUN chmod +x ./apps/api/docker-entrypoint.sh

WORKDIR /app/apps/api

EXPOSE 3001

ENV NODE_ENV=production

CMD ["./docker-entrypoint.sh"]
