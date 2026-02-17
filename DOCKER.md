# Docker Build & Deployment Guide

## Build Artifacts

### Web Application
- **Source**: `apps/web/`
- **Build Process**: 
  - TypeScript compilation: `tsc -b`
  - Vite bundling: `vite build`
- **Output Directory**: `apps/web/dist/`
- **Build Output**: Static HTML, CSS, and JavaScript files
- **Runtime**: Nginx web server serving static files
- **Port**: 80 (exposed as 3000 in docker-compose)

### API Service
- **Source**: `apps/api/`
- **Build Process**: TypeScript compilation with `tsc`
- **Output Directory**: `apps/api/dist/`
- **Build Output**: Compiled JavaScript files
- **Runtime**: Node.js with Express.js
- **Port**: 3001
- **Dependencies**: 
  - Express.js web framework
  - Drizzle ORM for database access
  - Socket.io for real-time updates
  - Passport.js for OAuth authentication

### Database
- **Service**: PostgreSQL 17 Alpine
- **Default Port**: 5432
- **Credentials**: (configured in docker-compose.yml)

## Docker Images

### API Dockerfile (`apps/api/Dockerfile`)
Multi-stage build:
1. **Builder stage**: Installs all dependencies and compiles TypeScript
2. **Runtime stage**: Copies only production dependencies and built artifacts

### Web Dockerfile (`apps/web/Dockerfile`)
Multi-stage build:
1. **Builder stage**: Installs all dependencies and runs Vite build
2. **Runtime stage**: Uses Nginx Alpine to serve static files

### Nginx Configuration (`apps/web/nginx.conf`)
- Enables gzip compression
- Configures SPA routing (all requests → index.html)
- Sets up cache headers for static assets
- Blocks access to hidden files
- Includes health check endpoint

## Building & Running

### Using Docker Compose
```bash
# Build and start all services
docker-compose up --build

# Build only (without starting)
docker-compose build

# Start services (using existing images)
docker-compose up

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]
```

### Individual Services
```bash
# Build API image
docker build -f apps/api/Dockerfile -t trello-clone-api .

# Build Web image
docker build -f apps/web/Dockerfile -t trello-clone-web .

# Run API
docker run -p 3001:3001 --env-file .env trello-clone-api

# Run Web
docker run -p 3000:80 trello-clone-web
```

## Environment Variables

### API Service
Set these in your `.env` file or as docker-compose environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for signing JWT tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `API_PORT`: Port to run API on (default: 3001)
- `WEB_URL`: URL of the web application for CORS
- `API_URL`: Public URL of the API
- `NODE_ENV`: Environment (development/production)
- `GOOGLE_CLIENT_ID`: Optional Google OAuth credentials
- `GOOGLE_CLIENT_SECRET`: Optional Google OAuth credentials
- `MICROSOFT_CLIENT_ID`: Optional Microsoft OAuth credentials
- `MICROSOFT_CLIENT_SECRET`: Optional Microsoft OAuth credentials

### Web Service
- `VITE_API_URL`: URL of the API backend

## Production Deployment

### Optimization Notes
- **API**: Multi-stage build reduces image size by ~70% (dev deps excluded from runtime)
- **Web**: Nginx Alpine image is ~40MB, perfect for production
- **Caching**: Static assets with content hashes are cached for 30 days
- **Compression**: Gzip enabled for text-based assets
- **Health Checks**: Both services include health check endpoints

### Docker Networking
When using docker-compose:
- Services can communicate via service names (e.g., `postgres:5432`, `api:3001`)
- Database connection string in API should use `postgres://` when running in Docker

### Volume Management
- **PostgreSQL data**: Persisted in `pgdata` volume
- Other services are stateless

## Troubleshooting

### Database Connection Issues
```bash
# Check if postgres is healthy
docker-compose ps

# View postgres logs
docker-compose logs postgres
```

### API Not Starting
```bash
# Check API logs
docker-compose logs api

# Common issues:
# - Database not ready (check healthcheck)
# - Environment variables not set
# - Port already in use
```

### Build Failures
```bash
# Clean rebuild without cache
docker-compose build --no-cache

# Check .dockerignore to ensure correct files are included
```
