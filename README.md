# Trello Clone

A modern, full-stack Trello-like project management application built with React, Node.js, Express, and PostgreSQL.

[![Watch the video](https://img.youtube.com/vi/qgaDZsS-stc/0.jpg)](https://www.youtube.com/watch?v=qgaDZsS-stc)

## Features

- **Board Management**: Create and organize teams and boards
- **Card System**: Add rich cards with titles, descriptions, and assignments
- **Columns & Swimlanes**: Organize cards with flexible column and swimlane layouts
- **Real-time Collaboration**: Live updates via Socket.io
- **Activity Tracking**: Complete activity feed for all board changes
- **Comments**: Add and manage comments on cards
- **Labels & Assignments**: Tag cards and assign to team members
- **OAuth Authentication**: Sign in with Google or Microsoft accounts
- **Responsive UI**: Modern React-based interface with Tailwind CSS

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite 6** - Build tool and dev server
- **TypeScript 5.7** - Type safety
- **Tailwind CSS 4** - Styling
- **Zustand** - State management
- **React Router 7** - Navigation
- **React Hook Form** - Form handling with Zod validation
- **Axios** - HTTP client
- **Socket.io Client** - Real-time updates
- **dnd-kit** - Drag and drop

### Backend
- **Node.js 22** - Runtime
- **Express 5** - Web framework
- **TypeScript 5.7** - Type safety
- **Drizzle ORM 0.38** - Database ORM
- **PostgreSQL 17** - Database
- **Socket.io 4.8** - Real-time WebSocket communication
- **Passport.js** - Authentication
- **Pino** - Logging

### Development & Tooling
- **pnpm** - Package manager (workspace monorepo)
- **Vitest** - Unit testing
- **Drizzle Kit** - Database migrations
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker & Docker Compose** - Containerization

## Project Structure

```
.
├── apps/
│   ├── api/                    # Express backend
│   │   ├── src/
│   │   │   ├── config/         # Configuration (env, database)
│   │   │   ├── db/             # Database schema and migrations
│   │   │   ├── middleware/     # Express middleware
│   │   │   ├── modules/        # Feature modules (teams, boards, cards, etc.)
│   │   │   ├── utils/          # Utilities
│   │   │   ├── ws/             # WebSocket setup
│   │   │   └── index.ts        # Entry point
│   │   ├── drizzle.config.ts   # Drizzle ORM config
│   │   └── package.json
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # Reusable React components
│       │   ├── features/       # Feature-specific components
│       │   ├── stores/         # Zustand stores
│       │   ├── hooks/          # Custom React hooks
│       │   ├── api/            # API client functions
│       │   ├── utils/          # Utilities
│       │   ├── App.tsx
│       │   └── main.tsx        # Entry point
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── shared/                 # Shared types and validation schemas
│       ├── types/              # TypeScript types
│       └── validation/         # Zod schemas
├── docs/
│   └── plans/                  # Development roadmap
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Root Dockerfile (if needed)
└── package.json
```

## Prerequisites

- **Node.js** 22+ or Docker
- **pnpm** (install via `npm install -g pnpm`)
- **PostgreSQL** 17+ (or use Docker)
- **.env file** with required environment variables

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd trello-clone
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://trello:trello_secret@localhost:5432/trello_clone

# API secrets (generate secure values for production)
JWT_SECRET=your_jwt_secret_min_10_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_10_chars

# Server URLs
API_PORT=3001
WEB_URL=http://localhost:5173
API_URL=http://localhost:3001

# OAuth (optional - leave empty to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Environment
NODE_ENV=development
```

### 4. Set Up Database

#### Option A: Using Docker Compose (Recommended)
```bash
# Start PostgreSQL container
docker-compose up postgres

# In another terminal, run migrations
pnpm db:migrate
```

#### Option B: Local PostgreSQL
```bash
# Make sure PostgreSQL is running locally, then
pnpm db:migrate
```

### 5. Generate Database Types
```bash
pnpm db:generate
```

## Running the Application

### Development Mode

Start all services in parallel:
```bash
pnpm dev
```

This will run:
- **API**: http://localhost:3001
- **Web**: http://localhost:5173

The web app will proxy API calls and WebSocket connections to the backend.

### Individual Services

**Frontend only:**
```bash
cd apps/web
pnpm dev
```

**Backend only:**
```bash
cd apps/api
pnpm dev
```

## Building the Application

### Build All Packages
```bash
pnpm build
```

### Build Specific App
```bash
# Frontend
cd apps/web && pnpm build

# Backend
cd apps/api && pnpm build
```

### Build Output
- **Frontend**: `apps/web/dist/` - Static HTML/CSS/JS files
- **Backend**: `apps/api/dist/` - Compiled JavaScript modules

## Docker Deployment

### Development

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# - Web: http://localhost:3000
# - API: http://localhost:3001
# - Database: localhost:5432
```

### Production Build

```bash
# Build individual images
docker build -f apps/api/Dockerfile -t trello-clone-api .
docker build -f apps/web/Dockerfile -t trello-clone-web .

# Or use docker-compose
docker-compose build
```

For detailed Docker information, see [DOCKER.md](DOCKER.md).

## Database Management

### Generate Database Schema Types
```bash
pnpm db:generate
```

### Run Migrations
```bash
pnpm db:migrate
```

### Seed Database (if available)
```bash
pnpm db:seed
```

### Reset Database
```bash
# Remove all data
dropdb trello_clone
createdb trello_clone

# Rerun migrations
pnpm db:migrate
```

## Testing

### Run All Tests
```bash
pnpm test
```

### Run Tests for Specific App
```bash
cd apps/api && pnpm test
cd apps/web && pnpm test
```

### Watch Mode
```bash
pnpm test:watch  # if configured
```

## Linting & Formatting

### Check Code Quality
```bash
pnpm lint
```

### Format Code
```bash
pnpm format  # if configured
```

## API Documentation

### Base URL
- **Development**: `http://localhost:3001/api/v1`
- **Production**: Configure via `API_URL` environment variable

### Main Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/google` - Google OAuth flow
- `GET /auth/microsoft` - Microsoft OAuth flow

#### Teams
- `GET /teams` - List user's teams
- `POST /teams` - Create new team
- `GET /teams/:teamId` - Get team details
- `PUT /teams/:teamId` - Update team
- `DELETE /teams/:teamId` - Delete team

#### Boards
- `GET /teams/:teamId/boards` - List team's boards
- `POST /teams/:teamId/boards` - Create board
- `GET /teams/:teamId/boards/:boardId` - Get board
- `PUT /teams/:teamId/boards/:boardId` - Update board
- `DELETE /teams/:teamId/boards/:boardId` - Delete board

#### Cards
- `GET /boards/:boardId/cards` - List cards
- `POST /boards/:boardId/cards` - Create card
- `PUT /boards/:boardId/cards/:cardId` - Update card
- `DELETE /boards/:boardId/cards/:cardId` - Delete card

#### Real-time Updates
- Uses Socket.io for real-time board, card, and activity updates
- Connect to `http://localhost:3001` with Socket.io client

For detailed API routes, see the route files in `apps/api/src/modules/`.

## Development Workflow

### Adding a New Feature

1. **Create types** in `packages/shared/src/types/`
2. **Create validation schemas** in `packages/shared/src/validation/`
3. **Create backend module** in `apps/api/src/modules/`
   - `*.controller.ts` - Request handlers
   - `*.service.ts` - Business logic
   - `*.routes.ts` - Route definitions
4. **Create API client** in `apps/web/src/api/`
5. **Create React components** in `apps/web/src/features/` or `components/`
6. **Add stores** in `apps/web/src/stores/` if needed

### Code Standards

- **TypeScript**: All code must be type-safe
- **ESLint**: Run `pnpm lint` before committing
- **Prettier**: Code is auto-formatted on save
- **Testing**: Write tests for critical business logic

## Environment Variables Reference

### Required for Development
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret

### Optional for Development
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` - Microsoft OAuth

### Production
For production deployment, ensure:
- All required variables are set
- Secrets are stored securely (use secrets manager)
- `NODE_ENV=production`
- Database has proper backups
- CORS origin matches actual deployment URL

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running. Use `docker-compose up postgres` or start your local PostgreSQL service.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Solution**: Change the port via environment variable or kill the process using the port:
```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9

# Or change port
API_PORT=3002 pnpm dev
```

### pnpm Command Not Found
```bash
npm install -g pnpm
```

### Build Fails with TypeScript Errors
```bash
# Clear and reinstall dependencies
rm -rf node_modules
pnpm install

# Regenerate database types
pnpm db:generate
```

## Performance Optimization

### Frontend
- **Code Splitting**: Routes are automatically code-split with React Router
- **Image Optimization**: Use appropriate formats and sizes
- **Caching**: Static assets are cached in browser
- **Compression**: Gzip enabled in production

### Backend
- **Database Indexing**: Indexes configured in schema
- **Connection Pooling**: PostgreSQL connection pool configured
- **Caching**: Implement caching where appropriate
- **Pagination**: API endpoints support pagination

## Security Considerations

- **CORS**: Configured to specific origins
- **Helmet**: Security headers enabled
- **JWT**: Token-based authentication
- **SQL Injection**: Protected via Drizzle ORM parameterized queries
- **Input Validation**: Zod schema validation on all inputs
- **HTTPS**: Use in production

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and test them
3. Run linting: `pnpm lint`
4. Commit with clear messages
5. Push and create a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright © 2026 Trello Clone Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Support

For issues and questions:
- Check existing documentation
- Review the [DOCKER.md](DOCKER.md) for containerization info
- Check database migrations in `apps/api/src/db/migrations/`
- Review sample implementations in existing modules

## Roadmap

See [docs/plans/](docs/plans/) for planned features and development roadmap.
