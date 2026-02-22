# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# VITE_API_URL must be a build arg — Vite bakes import.meta.env.VITE_* at build time
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

# Build the web app
WORKDIR /app/apps/web
RUN pnpm build

# Runtime stage - serve static files with nginx
FROM nginx:alpine

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
