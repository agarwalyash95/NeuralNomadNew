# NeuralNomad 🚀

**AI-Powered Travel Planning Platform for Indian Users**

> **Coding agents:** Start with [`AGENTS.md`](AGENTS.md), then read [`docs/agent/CURRENT_STATE.md`](docs/agent/CURRENT_STATE.md) and [`docs/agent/HANDOFF.md`](docs/agent/HANDOFF.md) before changing code. Run `python scripts/agent_context.py` for a read-only context summary.

A modern, scalable platform that uses artificial intelligence to help Indian travelers plan their trips, discover attractions, manage bookings, and navigate travel-related challenges.

> **Status**: 🚧 **Active development** — see the [current project state](docs/agent/CURRENT_STATE.md) for the verified checkpoint
> **Last Updated**: 2026-07-18
> **Version**: 1.0.0

---

## 🎯 Overview

NeuralNomad is an enterprise-grade travel platform built to revolutionize travel planning for Indian users by combining:

- **🤖 AI-Powered Itinerary Planning**: Smart trip planning based on preferences
- **💬 AI Chat Assistant**: Real-time travel advice and support
- **🏨 Integrated Bookings**: Flights, hotels, activities in one place
- **🗽 Comprehensive Travel Data**: Visa requirements, exchange rates, attractions
- **🎫 Digital Travel Pass**: Centralized document management
- **💳 Smart Wallet System**: Budget tracking and rewards
- **📍 Location-Based Discovery**: Find attractions near you
- **🔔 Smart Notifications**: Trip reminders and updates
- **📱 Responsive Design**: Mobile-friendly interface

---

## 🏗️ Technology Stack

### Frontend

- **Next.js 15** - Modern React framework
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS
- **Zustand** - State management
- **TanStack Query** - Data fetching
- **Mapbox GL** - Interactive maps
- **React Hook Form + Zod** - Form validation
- **Framer Motion** - Animations
- **Jest** - Testing

### Backend

- **Django 5** - Python web framework
- **Django REST Framework** - RESTful API
- **PostgreSQL 16** - Relational database
- **Redis 7** - Caching and sessions
- **Celery** - Async task processing
- **JWT Authentication** - Secure auth
- **drf-spectacular** - API documentation

### Infrastructure

- **Docker** - Containerization
- **docker-compose** - Local development

## 📋 Project Structure

```
NeuralNomad/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # Reusable React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API service layer
│   │   ├── store/           # Zustand state management
│   │   ├── lib/             # Utility functions
│   │   ├── types/           # TypeScript types
│   │   ├── constants/       # App constants
│   │   ├── providers/       # Context/Provider components
│   │   └── assets/          # Images, fonts, etc.
│   ├── public/              # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── .env.example
│   └── .env.local           # Local development
│
├── backend/                  # Django application
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   ├── .env.local           # Local development
│   ├── config/              # Django settings
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   ├── production.py
│   │   │   └── testing.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   ├── asgi.py
│   │   └── celery.py
│   ├── apps/                # Django apps
│   │   ├── accounts/        # User management
│   │   ├── planner/         # Trip planning
│   │   ├── bookings/        # Booking system
│   │   ├── attractions/     # Attractions data
│   │   ├── visa/            # Visa information
│   │   ├── forex/           # Currency exchange
│   │   ├── travelpass/      # Travel passes
│   │   ├── wallet/          # Wallet system
│   │   ├── notifications/   # Notifications
│   │   └── common/          # Shared utilities
│   ├── tests/               # Test suite
│   ├── scripts/             # Management scripts
│   └── migrations/          # Database migrations
│
├── docs/                     # Documentation
│   ├── SETUP.md             # Setup instructions
│   ├── ARCHITECTURE.md      # Architecture overview
│   ├── DATABASE.md          # Database schema
│   ├── API.md               # API documentation
│   └── DEPLOYMENT.md        # Deployment guide
│
├── .vscode/                  # VS Code settings
│   ├── extensions.json
│   └── settings.json
│
├── .gitignore               # Git ignore rules
├── .env.example             # Environment template
└── docker-compose.yml       # Local development services
```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18+ (for frontend)
- **Python**: 3.11+ (for backend)
- **PostgreSQL**: 16+
- **Redis**: 7+ (for caching and Celery)
- **Docker**: Optional (for containerized setup)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# Backend runs on http://localhost:8000
```

### Database Setup

```bash
# PostgreSQL should be running
createdb neuralnomad_db
# Migrations are applied in Django setup
```

## 📚 Documentation

- **[Current Project State](docs/agent/CURRENT_STATE.md)** - Verified checkpoint, active gate, and known risks
- **[Cross-Agent Workflow](docs/agent/WORKFLOW.md)** - Start, implement, verify, and handoff protocol
- **[Latest Handoff](docs/agent/HANDOFF.md)** - Exact continuation point for the next session
- **[Planner Audit and Repair Plan](docs/planner-complete-current-audit-and-repair-plan.md)** - Detailed current planner investigation
- **[Setup Notes](docs/SETUP.md)** - Environment setup notes (currently incomplete)

## 🏗️ Architecture Highlights

### Scalability for Millions of Users

- **Stateless Backend** - Horizontally scalable Django services
- **Database Optimization** - Indexed PostgreSQL with proper sharding strategy
- **Caching Layer** - Redis for session, cache, and rate limiting
- **Async Processing** - Celery for long-running tasks
- **CDN Ready** - Static assets served via CloudFront

### Security

- **JWT Authentication** - Secure token-based auth
- **CORS Configuration** - Restricted cross-origin requests
- **Environment Variables** - Sensitive data management
- **HTTPS Only** - Production deployment requirement
- **Rate Limiting** - DRF throttling for API protection

### Development Standards

- **TypeScript** - Type safety across frontend
- **Django Best Practices** - Modular app architecture
- **Code Quality** - ESLint, Prettier, Black formatting
- **Testing** - Unit and integration tests
- **Git Workflow** - Feature branches, PRs, code review

## 🔄 Development Workflow

### Git Branches

- `main` - Production code
- `develop` - Integration branch
- `feature/*` - Feature development
- `bugfix/*` - Bug fixes
- `hotfix/*` - Production hotfixes

### Commit Convention

```
type(scope): description

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## 📋 Phase 1 Tasks

- [x] Project structure setup
- [x] Frontend initialization (Next.js 15)
- [x] Backend initialization (Django 5)
- [x] PostgreSQL configuration
- [x] Environment variables setup
- [x] Documentation
- [ ] CI/CD pipeline (future)

## 📋 Phase 2 Tasks

- [x] Database model design
- [x] User authentication schema
- [ ] API endpoints (next phase)
- [ ] Frontend pages (next phase)
- [ ] Testing setup (next phase)

## 👥 Development Team

- **Senior Staff Software Engineer** - Architecture & Core
- **Solution Architect** - System Design
- **DevOps Engineer** - Infrastructure
- **Database Architect** - Data Layer
- **Technical Lead** - Project Oversight

## 📞 Support

For questions or issues:

1. Read `AGENTS.md` and `docs/agent/CURRENT_STATE.md`.
2. Resume from `docs/agent/HANDOFF.md`.
3. Verify documentation claims against the current code, runtime behavior, and Git diff.

## 📄 License

Proprietary - NeuralNomad, 2026

---

**Built with ❤️ for Indian travelers**
