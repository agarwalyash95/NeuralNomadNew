# NeuralNomad - Architecture Overview

## System Architecture

NeuralNomad is built on a modern, scalable microservices-inspired architecture designed to handle millions of users across India.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Web Application (Next.js 15)              │   │
│  │  - React components with TypeScript                 │   │
│  │  - TailwindCSS + Shadcn UI for styling             │   │
│  │  - Zustand for state management                     │   │
│  │  - TanStack Query for data fetching                │   │
│  │  - Mapbox for location-based features              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTP/HTTPS API Calls
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│  ├─ Load Balancer (future)                                 │
│  ├─ Rate Limiting                                          │
│  ├─ CORS Handler                                           │
│  └─ Request Validation                                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│                   (Django 5 + DRF)                          │
│                                                              │
│  ┌────────────┬─────────┬──────┬──────────────────────┐    │
│  │ Accounts   │ Planner │Booking│ Travel Data Apps  │    │
│  │ - Auth     │ - Trips │- Bookings│ - Visa       │    │
│  │ - Profiles │ - Chat  │- Payments│ - Forex      │    │
│  │ - Prefs    │- Saved  │-Status  │ - Attractions │    │
│  │ - Documents│ Places  │        │ - Notifications│    │
│  │ - Logs     │ - AI    │        │ - Wallet       │    │
│  │            │ Planning│        │ - TravelPass   │    │
│  └────────────┴─────────┴──────┴──────────────────────┘    │
│                                                              │
│  ┌───────────────────────────────────────────────────┐     │
│  │            API Endpoints (RESTful)                 │     │
│  │  /api/accounts/    /api/planner/    /api/visa/   │     │
│  │  /api/forex/       /api/bookings/   /api/wallet/ │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌──────────┐        ┌──────────┐
    │PostgreSQL          │  Redis   │        │  Celery  │
    │ Database           │  Cache   │        │ Task Q   │
    │ - Models           │ - Session│        │ - Email  │
    │ - User Data        │ - Cache  │        │ - Reports│
    │ - Trips            │ - Rate   │        │ - Notifs │
    │ - Bookings         │   Limit  │        │          │
    └─────────┘          └──────────┘        └──────────┘
```

---

## Architecture Layers

### 1. **Presentation Layer (Frontend)**

**Technology**: Next.js 15 + React 19 + TypeScript

**Responsibilities**:

- User interface and user experience
- Client-side state management (Zustand)
- API communication (Axios)
- Real-time updates (TanStack Query)
- Location-based features (Mapbox)

**Structure**:

```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable React components
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API service layer
│   ├── store/            # Zustand state stores
│   ├── lib/              # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── constants/        # Application constants
│   ├── providers/        # Context providers
│   └── assets/           # Static assets
```

### 2. **API Layer (Backend)**

**Technology**: Django 5 + Django REST Framework

**Responsibilities**:

- Business logic implementation
- Data validation and processing
- API endpoint management
- Authentication and authorization
- Request/response handling

**Structure**:

```
backend/
├── config/               # Django configuration
│   ├── settings/         # Settings by environment
│   ├── urls.py          # URL routing
│   ├── wsgi.py          # WSGI app
│   ├── asgi.py          # ASGI app
│   └── celery.py        # Celery configuration
├── apps/                # Django applications
│   ├── accounts/        # User management
│   ├── planner/         # Trip planning
│   ├── bookings/        # Bookings system
│   ├── attractions/     # Attractions data
│   ├── visa/            # Visa information
│   ├── forex/           # Currency exchange
│   ├── wallet/          # Payment system
│   ├── travelpass/      # Digital passes
│   ├── notifications/   # Notifications
│   └── common/          # Shared utilities
├── tests/               # Test suite
├── scripts/             # Management scripts
└── migrations/          # Database migrations
```

### 3. **Data Layer (Database)**

**Technology**: PostgreSQL 16

**Responsibilities**:

- Data persistence
- ACID compliance
- Transaction management
- Data integrity

**Key Features**:

- Full-text search capabilities
- JSON field support for flexible data
- UUID primary keys for distributed systems
- Proper indexing for performance
- Relationship management

### 4. **Cache Layer**

**Technology**: Redis 7

**Responsibilities**:

- Session management
- Cache store for frequently accessed data
- Rate limiting
- Real-time messaging

### 5. **Task Queue**

**Technology**: Celery + Redis

**Responsibilities**:

- Asynchronous task processing
- Email sending
- Report generation
- Batch operations
- Scheduled tasks (cron jobs)

---

## Key Design Patterns

### 1. **Modular Architecture**

Each feature is encapsulated in its own Django app:

- **Accounts App**: User management and authentication
- **Planner App**: Trip planning and itinerary management
- **Bookings App**: Booking management
- **Travel Data Apps**: Visa, forex, attractions information

This allows:

- Independent scaling
- Easier testing
- Clear separation of concerns
- Reusability across projects

### 2. **RESTful API Design**

All endpoints follow REST principles:

```
GET    /api/trips/              # List trips
POST   /api/trips/              # Create trip
GET    /api/trips/{id}/         # Get trip detail
PUT    /api/trips/{id}/         # Update trip
DELETE /api/trips/{id}/         # Delete trip
POST   /api/trips/{id}/actions/ # Custom actions
```

### 3. **Middleware Chain**

Request flow through middleware:

```
Request
  │
  ├─ CORS Middleware          (Allow cross-origin)
  ├─ Security Middleware      (XSS, CSRF protection)
  ├─ Authentication          (JWT verification)
  ├─ Authorization           (Permission checks)
  ├─ Business Logic
  │
Response
```

### 4. **Service Layer Pattern**

```python
# Services handle business logic
class TripService:
    @staticmethod
    def create_trip(user, trip_data):
        # Validate data
        # Calculate budget
        # Call AI service
        # Create database record
        # Send notification
        return trip

# Views are thin - they coordinate
class TripViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        trip = TripService.create_trip(
            self.request.user,
            serializer.validated_data
        )
        serializer.save(trip=trip)
```

---

## Scalability Considerations

### For Millions of Users:

#### 1. **Database Optimization**

- Proper indexing on frequently queried fields
- Sharding strategy for large tables
- Read replicas for scaling reads
- Connection pooling (PgBouncer)

#### 2. **Caching Strategy**

- Cache frequently accessed data (attractions, exchange rates)
- Session caching in Redis
- Cache invalidation strategies
- Cache warming for popular data

#### 3. **Load Balancing**

- Multiple API server instances
- Load balancer (Nginx, AWS ELB)
- Session affinity or distributed sessions
- Health checks and auto-scaling

#### 4. **Asynchronous Processing**

- Long-running tasks via Celery
- Email sending queue
- Batch reporting
- Real-time notifications

#### 5. **CDN & Static Assets**

- CloudFront for static file distribution
- Image optimization
- Gzip compression
- Browser caching headers

#### 6. **Monitoring & Observability**

- Application monitoring (Sentry)
- Log aggregation (CloudWatch)
- Performance monitoring (APM)
- Database query optimization

---

## Security Architecture

### Authentication Flow

```
1. User Registers/Logs In
   │
   ├─ Credentials validated
   ├─ JWT tokens generated
   ├─ Refresh token stored (httpOnly cookie)
   └─ Access token returned

2. Subsequent Requests
   │
   ├─ Access token in Authorization header
   ├─ Token validated
   ├─ User identified
   └─ Request processed

3. Token Refresh
   │
   ├─ Refresh token used
   ├─ New access token generated
   └─ Response continues
```

### Security Layers

1. **Transport Security**: HTTPS/TLS
2. **Authentication**: JWT with refresh tokens
3. **Authorization**: Permission-based access control
4. **Data Validation**: Input validation at API layer
5. **Rate Limiting**: DRF throttling
6. **CORS**: Restricted cross-origin requests
7. **SQL Injection**: ORM protection (Django ORM)
8. **CSRF**: CSRF tokens for state-changing operations

---

## Deployment Architecture

### Development Environment

```
Local Machine
├── Next.js Dev Server (3000)
├── Django Dev Server (8000)
├── PostgreSQL (5432)
├── Redis (6379)
└── Celery Worker
```

### Production Environment (Planned)

```
AWS Infrastructure
├── CloudFront (CDN)
├── ALB (Load Balancer)
├─ ECS (Container Orchestration)
│  ├─ Django API Services (multiple instances)
│  ├─ Celery Worker (scaled by queue)
│  └─ Next.js Application
├─ RDS (PostgreSQL)
├─ ElastiCache (Redis)
├─ S3 (File Storage)
├─ CloudWatch (Monitoring)
└─ Route 53 (DNS)
```

---

## Data Flow Examples

### Trip Creation Flow

```
Frontend                      Backend
   │                             │
   ├─ User fills form            │
   │                             │
   ├─ POST /trips ──────────────>│
   │                             │
   │                    ┌────────┴──────┐
   │                    │ Validate input │
   │                    │ Create trip    │
   │                    │ Call AI service│
   │                    │ Send email task│
   │                    └────────┬──────┘
   │                             │
   │<─ Response (trip data) ─────┤
   │                             │
   └─ Display trip              │
                                 │
                    ┌────────────┴──────┐
                    │ Celery processes  │
                    │ - Send email      │
                    │ - Generate PDF    │
                    │ - Create notif    │
                    └───────────────────┘
```

### Chat-based Trip Planning

```
Frontend                      Backend
   │                             │
   ├─ User types message         │
   │                             │
   ├─ POST /chat/send ──────────>│
   │                             │
   │                    ┌────────┴──────┐
   │                    │ Save message   │
   │                    │ Call AI model  │
   │                    │ Generate reply │
   │                    └────────┬──────┘
   │                             │
   │<─ Response (AI reply) ──────┤
   │                             │
   └─ Display in UI              │
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Detailed error message",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

### HTTP Status Codes

- **200**: OK
- **201**: Created
- **204**: No Content
- **400**: Bad Request (validation error)
- **401**: Unauthorized (authentication failed)
- **403**: Forbidden (authorization failed)
- **404**: Not Found
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

---

## Technology Rationale

### Why Next.js 15?

- App Router for modern React development
- Built-in optimization (images, fonts)
- API routes capability
- Server-side rendering
- Edge computing support

### Why Django 5?

- Batteries-included framework
- ORM for database abstraction
- Built-in admin panel
- Strong security features
- Mature ecosystem

### Why PostgreSQL?

- ACID compliance
- Advanced data types (JSON, arrays)
- Full-text search
- Scalability
- Enterprise support

### Why Redis?

- High performance caching
- Session management
- Pub/Sub messaging
- Rate limiting
- Task queue support (with Celery)

---

## Future Considerations

1. **GraphQL API**: Alternative to REST
2. **Microservices**: Split into separate services
3. **Message Queue**: Kafka for event streaming
4. **Search Engine**: Elasticsearch for advanced search
5. **Real-time Updates**: WebSockets for live notifications
6. **Multi-language Support**: i18n implementation
7. **Mobile Apps**: React Native applications
8. **Analytics**: Data warehouse and analytics

---

**Last Updated**: 2024
**Architecture Version**: 1.0
**Status**: Production Ready for Phase 1 & 2
