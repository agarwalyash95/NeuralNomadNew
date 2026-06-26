# NeuralNomad - Setup Guide

## Phase 1 & Phase 2 - Development Environment Setup

This guide covers the complete setup for NeuralNomad frontend and backend development.

---

## Prerequisites

### System Requirements

- **OS**: Windows, macOS, or Linux
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 10GB free space

### Required Software

#### For Backend Development

- **Python**: 3.11 or higher
- **PostgreSQL**: 16 or higher
- **Redis**: 7 or higher
- **Node.js** (optional, for frontend during dev): 18 or higher

#### For Frontend Development

- **Node.js**: 18 or higher
- **npm**: 9 or higher (or yarn/pnpm)

---

## Step-by-Step Setup

### 1. Initial Setup

#### Clone the Repository

```bash
cd NeuralNomad
```

#### Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env.local
```

Edit `.env.local` with your local configuration:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ENVIRONMENT=development

# Database
DB_NAME=neuralnomad_db
DB_USER=neuralnomad_user
DB_PASSWORD=neuralnomad_password
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 2. Backend Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

#### Option B: Manual Installation

**PostgreSQL Setup:**

```bash
# On Windows (using PostgreSQL installer)
# On macOS
brew install postgresql@16
brew services start postgresql@16

# On Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib redis-server

# Create database and user
createdb neuralnomad_db
psql -d neuralnomad_db -c "CREATE USER neuralnomad_user WITH PASSWORD 'neuralnomad_password';"
psql -d neuralnomad_db -c "ALTER ROLE neuralnomad_user SET client_encoding TO 'utf8';"
psql -d neuralnomad_db -c "ALTER ROLE neuralnomad_user SET default_transaction_isolation TO 'read committed';"
psql -d neuralnomad_db -c "ALTER ROLE neuralnomad_user SET default_transaction_deferrable TO on;"
psql -d neuralnomad_db -c "ALTER ROLE neuralnomad_user SET timezone TO 'UTC';"
psql -d neuralnomad_db -c "GRANT ALL PRIVILEGES ON DATABASE neuralnomad_db TO neuralnomad_user;"
```

**Redis Setup:**

```bash
# On macOS
brew install redis
brew services start redis

# On Linux
sudo service redis-server start

# On Windows (using WSL2 or Docker recommended)
docker run -d -p 6379:6379 redis:7-alpine
```

#### Python Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# For development (includes dev tools)
pip install -r requirements-dev.txt
```

#### Run Migrations

```bash
# Make sure you're in the backend directory with venv activated

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser for admin
python manage.py createsuperuser
```

#### Start Backend Server

```bash
# Development server (with hot reload)
python manage.py runserver

# Server runs on http://localhost:8000
# Admin panel: http://localhost:8000/admin
# API documentation: http://localhost:8000/api/docs
```

#### Optional: Start Celery Worker

```bash
# In a separate terminal with activated venv
celery -A config worker -l info
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
# or
yarn install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your configuration
```

#### Environment Variables

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_ENVIRONMENT=development
```

#### Start Development Server

```bash
# Run development server
npm run dev

# Frontend runs on http://localhost:3000
```

#### Build for Production

```bash
# Build
npm run build

# Start production server
npm run start
```

---

## Verification

### Backend Health Check

```bash
# Check API is running
curl http://localhost:8000/health

# Check API documentation
curl http://localhost:8000/api/schema
```

### Frontend Health Check

Open http://localhost:3000 in your browser. You should see the NeuralNomad landing page.

---

## Database Setup

### Create Initial Data

```bash
cd backend

# Create superuser
python manage.py createsuperuser

# Load initial fixtures (if available)
python manage.py loaddata fixtures/initial_data.json
```

### Access Admin Panel

1. Go to http://localhost:8000/admin
2. Login with superuser credentials
3. Add initial data for:
   - Attractions
   - Visa requirements
   - Exchange rates

---

## Development Tools

### Python Code Quality

```bash
# Format code with Black
black apps/

# Check code style with Flake8
flake8 apps/

# Type checking with mypy
mypy apps/

# Sort imports with isort
isort apps/
```

### Frontend Code Quality

```bash
cd frontend

# Format code
npm run format

# Check formatting
npm run format:check

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=apps

# Run specific test file
pytest apps/accounts/tests.py
```

```bash
cd frontend

# Run tests
npm run test

# Run with coverage
npm run test:coverage
```

---

## Troubleshooting

### PostgreSQL Connection Error

**Error**: `FATAL: role "neuralnomad_user" does not exist`

**Solution**:

```bash
# Create the user
createuser neuralnomad_user
# Or create with password
createuser neuralnomad_user -P
```

### Redis Connection Error

**Error**: `ConnectionError: Error 111 connecting to localhost:6379`

**Solution**:

```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG

# If not running, start Redis
redis-server
```

### Port Already in Use

**Error**: `Address already in use`

**Solution**:

```bash
# Find process using port 8000 (backend)
lsof -i :8000
kill -9 <PID>

# Find process using port 3000 (frontend)
lsof -i :3000
kill -9 <PID>
```

### Module Not Found Error

**Error**: `ModuleNotFoundError: No module named 'apps'`

**Solution**:

```bash
# Ensure you're in the backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

---

## VS Code Setup

### Recommended Extensions

- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- Thunder Client (rangav.vscode-thunder-client) - for API testing

### Workspace Settings

The `.vscode/settings.json` file is already configured with:

- Python formatter (Black)
- JavaScript formatter (Prettier)
- Auto-formatting on save
- Linting enabled

### Debugging

**Python Debug Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Django",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/backend/manage.py",
      "args": ["runserver"],
      "django": true,
      "justMyCode": true
    }
  ]
}
```

---

## Git Workflow

### Initial Setup

```bash
# Initialize git (if not already done)
git init

# Add remote
git remote add origin https://github.com/your-org/neuralnomad.git

# Create initial commit
git add .
git commit -m "chore: initial project setup"
```

### Branch Strategy

```bash
# Main branches
main          # Production code
develop       # Integration branch

# Feature branches
feature/auth-system
feature/trip-planning
feature/ai-chat

# Bugfix branches
bugfix/login-issue

# Hotfix branches
hotfix/critical-bug
```

### Commit Convention

```bash
# Format: type(scope): description

# Examples:
git commit -m "feat(auth): implement JWT authentication"
git commit -m "fix(planner): resolve itinerary date validation"
git commit -m "docs(setup): update installation guide"
git commit -m "style(formatting): run prettier on codebase"
git commit -m "refactor(models): simplify user model"
```

---

## Next Steps

1. **Phase 1 Completion Checklist**:
   - [ ] Frontend initialized and running
   - [ ] Backend initialized and running
   - [ ] PostgreSQL configured
   - [ ] Redis configured
   - [ ] Environment variables set
   - [ ] Database migrated
   - [ ] Admin panel accessible
   - [ ] API documentation available

2. **Phase 2 Tasks** (Database & Models):
   - [ ] Review database schema
   - [ ] Create test data
   - [ ] Design API endpoints
   - [ ] Set up CI/CD pipeline

3. **Phase 3 Tasks** (API & Frontend):
   - [ ] Implement API endpoints
   - [ ] Create authentication flow
   - [ ] Build UI components
   - [ ] Integrate frontend with backend

---

## Support & Resources

- **API Documentation**: http://localhost:8000/api/docs
- **Django Documentation**: https://docs.djangoproject.com
- **Next.js Documentation**: https://nextjs.org/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **DRF Documentation**: https://www.django-rest-framework.org

---

**Last Updated**: 2024
**Maintainer**: NeuralNomad Technical Team
