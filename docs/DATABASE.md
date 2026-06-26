# NeuralNomad - Database Schema Documentation

## Database Overview

NeuralNomad uses **PostgreSQL 16** for data persistence. The database schema is designed for scalability, supporting millions of users while maintaining data integrity.

---

## Database Models & Relationships

### Core Model Structure

All models inherit from a `BaseModel` that provides:

- **id** (UUID): Unique identifier
- **created_at** (DateTime): Record creation timestamp
- **updated_at** (DateTime): Last modification timestamp

---

## 1. Accounts App Models

### User Model

**Purpose**: Custom user model replacing Django's default User

| Field              | Type        | Constraints     | Description        |
| ------------------ | ----------- | --------------- | ------------------ |
| id                 | UUID        | Primary Key     | Unique identifier  |
| email              | Email       | Unique, Indexed | User email (login) |
| name               | String(255) | Not Null        | Full name          |
| phone              | String(20)  | Not Null        | Phone number       |
| avatar             | Image       | Nullable        | Profile picture    |
| preferred_currency | String(3)   | Default='INR'   | User's currency    |
| home_airport       | String(10)  | Nullable        | Preferred airport  |
| is_active          | Boolean     | Default=True    | Account status     |
| is_staff           | Boolean     | Default=False   | Admin flag         |
| is_superuser       | Boolean     | Default=False   | Superuser flag     |
| created_at         | DateTime    | Auto            | Creation timestamp |
| updated_at         | DateTime    | Auto            | Update timestamp   |
| last_login         | DateTime    | Nullable        | Last login         |

**Indexes**:

- email (for login lookups)
- created_at (for sorting)

**Relationships**:

- OneToOne: UserPreference
- OneToOne: Wallet
- OneToMany: Trip, ChatSession, SavedPlace, UploadedDocument, ActivityLog, Booking, Notification

---

### UserPreference Model

**Purpose**: Store user's travel preferences and settings

| Field                 | Type       | Constraints              | Description                       |
| --------------------- | ---------- | ------------------------ | --------------------------------- |
| id                    | UUID       | Primary Key              | Unique identifier                 |
| user                  | FK(User)   | Unique, OnDelete=CASCADE | User reference                    |
| budget_range_min      | Decimal    | Nullable                 | Minimum budget                    |
| budget_range_max      | Decimal    | Nullable                 | Maximum budget                    |
| favorite_destinations | JSON       | Default=list             | List of favorite countries        |
| travel_style          | String(20) | Choices                  | luxury/budget/mid-range/adventure |
| seat_preference       | String(10) | Choices                  | aisle/window/any                  |
| created_at            | DateTime   | Auto                     | Creation timestamp                |
| updated_at            | DateTime   | Auto                     | Update timestamp                  |

---

### UploadedDocument Model

**Purpose**: Store user-uploaded documents (passports, visas, tickets)

| Field         | Type       | Constraints      | Description                                |
| ------------- | ---------- | ---------------- | ------------------------------------------ |
| id            | UUID       | Primary Key      | Unique identifier                          |
| user          | FK(User)   | OnDelete=CASCADE | Document owner                             |
| document_type | String(50) | Choices          | passport/visa/ticket/hotel/insurance/other |
| file_path     | File       | Not Null         | Document file                              |
| uploaded_at   | DateTime   | Auto             | Upload timestamp                           |
| created_at    | DateTime   | Auto             | Creation timestamp                         |
| updated_at    | DateTime   | Auto             | Update timestamp                           |

**Indexes**:

- (user, document_type)

---

### ActivityLog Model

**Purpose**: Track user actions for audit trail

| Field       | Type        | Constraints      | Description               |
| ----------- | ----------- | ---------------- | ------------------------- |
| id          | UUID        | Primary Key      | Unique identifier         |
| user        | FK(User)    | OnDelete=CASCADE | User who performed action |
| action      | String(100) | Choices          | Type of action            |
| description | Text        | Nullable         | Action details            |
| ip_address  | IP          | Nullable         | User's IP address         |
| user_agent  | Text        | Nullable         | Browser info              |
| created_at  | DateTime    | Auto             | Action timestamp          |
| updated_at  | DateTime    | Auto             | Update timestamp          |

**Indexes**:

- (user, created_at)

---

## 2. Planner App Models

### Trip Model

**Purpose**: Main trip records

| Field       | Type          | Constraints      | Description                                 |
| ----------- | ------------- | ---------------- | ------------------------------------------- |
| id          | UUID          | Primary Key      | Unique identifier                           |
| user        | FK(User)      | OnDelete=CASCADE | Trip owner                                  |
| destination | String(255)   | Not Null         | Destination city/country                    |
| start_date  | Date          | Not Null         | Trip start                                  |
| end_date    | Date          | Not Null         | Trip end                                    |
| budget      | Decimal(10,2) | Not Null         | Total budget                                |
| status      | String(20)    | Choices          | planning/booked/ongoing/completed/cancelled |
| trip_type   | String(20)    | Choices          | leisure/business/adventure/cultural         |
| description | Text          | Nullable         | Trip description                            |
| cover_image | Image         | Nullable         | Trip cover photo                            |
| created_at  | DateTime      | Auto             | Creation timestamp                          |
| updated_at  | DateTime      | Auto             | Update timestamp                            |

**Indexes**:

- (user, status)
- start_date

---

### Itinerary Model

**Purpose**: Daily itinerary items for trips

| Field          | Type          | Constraints      | Description                      |
| -------------- | ------------- | ---------------- | -------------------------------- |
| id             | UUID          | Primary Key      | Unique identifier                |
| trip           | FK(Trip)      | OnDelete=CASCADE | Parent trip                      |
| day_number     | Int           | Not Null         | Day number in trip               |
| title          | String(255)   | Not Null         | Activity title                   |
| description    | Text          | Not Null         | Activity description             |
| location       | String(255)   | Not Null         | Location name                    |
| latitude       | Float         | Nullable         | Geographic latitude              |
| longitude      | Float         | Nullable         | Geographic longitude             |
| start_time     | Time          | Nullable         | Activity start time              |
| end_time       | Time          | Nullable         | Activity end time                |
| estimated_cost | Decimal(10,2) | Default=0        | Estimated cost                   |
| category       | String(100)   | Nullable         | sightseeing/dining/transport/etc |
| created_at     | DateTime      | Auto             | Creation timestamp               |
| updated_at     | DateTime      | Auto             | Update timestamp                 |

**Indexes**:

- (trip, day_number)

---

### ChatSession Model

**Purpose**: AI chat sessions for trip planning

| Field      | Type        | Constraints                | Description        |
| ---------- | ----------- | -------------------------- | ------------------ |
| id         | UUID        | Primary Key                | Unique identifier  |
| user       | FK(User)    | OnDelete=CASCADE           | Session owner      |
| trip       | FK(Trip)    | Nullable, OnDelete=CASCADE | Associated trip    |
| title      | String(255) | Default='New Chat'         | Session title      |
| created_at | DateTime    | Auto                       | Creation timestamp |
| updated_at | DateTime    | Auto                       | Update timestamp   |

**Indexes**:

- (user, created_at)

---

### ChatMessage Model

**Purpose**: Individual messages in chat sessions

| Field      | Type            | Constraints      | Description        |
| ---------- | --------------- | ---------------- | ------------------ |
| id         | UUID            | Primary Key      | Unique identifier  |
| session    | FK(ChatSession) | OnDelete=CASCADE | Parent session     |
| role       | String(20)      | Choices          | user/assistant     |
| content    | Text            | Not Null         | Message content    |
| created_at | DateTime        | Auto             | Creation timestamp |
| updated_at | DateTime        | Auto             | Update timestamp   |

**Indexes**:

- (session, created_at)

---

### SavedPlace Model

**Purpose**: User bookmarks for places they want to visit

| Field       | Type        | Constraints      | Description           |
| ----------- | ----------- | ---------------- | --------------------- |
| id          | UUID        | Primary Key      | Unique identifier     |
| user        | FK(User)    | OnDelete=CASCADE | User who saved        |
| place_id    | String(255) | Not Null         | External API place ID |
| name        | String(255) | Not Null         | Place name            |
| description | Text        | Nullable         | Place description     |
| country     | String(100) | Not Null         | Country name          |
| city        | String(100) | Nullable         | City name             |
| latitude    | Float       | Nullable         | Geographic latitude   |
| longitude   | Float       | Nullable         | Geographic longitude  |
| rating      | Float       | Nullable         | Place rating          |
| image_url   | URL         | Nullable         | Place image           |
| created_at  | DateTime    | Auto             | Creation timestamp    |
| updated_at  | DateTime    | Auto             | Update timestamp      |

**Unique Constraint**: (user, place_id)
**Indexes**:

- (user, country)

---

## 3. Attractions App Models

### Attraction Model

**Purpose**: Database of attractions and places of interest

| Field         | Type          | Constraints | Description                                                               |
| ------------- | ------------- | ----------- | ------------------------------------------------------------------------- |
| id            | UUID          | Primary Key | Unique identifier                                                         |
| place_id      | String(255)   | Unique      | External API ID                                                           |
| name          | String(255)   | Indexed     | Attraction name                                                           |
| description   | Text          | Nullable    | Detailed description                                                      |
| category      | String(50)    | Choices     | museum/temple/monument/restaurant/park/beach/shopping/entertainment/other |
| city          | String(100)   | Indexed     | City location                                                             |
| country       | String(100)   | Indexed     | Country location                                                          |
| address       | Text          | Nullable    | Full address                                                              |
| latitude      | Float         | Not Null    | Geographic latitude                                                       |
| longitude     | Float         | Not Null    | Geographic longitude                                                      |
| rating        | Float         | Nullable    | User rating (1-5)                                                         |
| review_count  | Int           | Default=0   | Number of reviews                                                         |
| image_url     | URL           | Nullable    | Attraction image                                                          |
| opening_hours | JSON          | Nullable    | Operating hours                                                           |
| entry_fee     | Decimal(10,2) | Nullable    | Ticket price                                                              |
| phone         | String(20)    | Nullable    | Contact phone                                                             |
| website       | URL           | Nullable    | Official website                                                          |
| created_at    | DateTime      | Auto        | Creation timestamp                                                        |
| updated_at    | DateTime      | Auto        | Update timestamp                                                          |

**Indexes**:

- (city, country)
- category
- rating (descending)

---

## 4. Visa App Models

### VisaData Model

**Purpose**: Visa requirements for different countries

| Field                | Type          | Constraints     | Description                |
| -------------------- | ------------- | --------------- | -------------------------- |
| id                   | UUID          | Primary Key     | Unique identifier          |
| country              | String(100)   | Unique, Indexed | Destination country        |
| visa_required        | Boolean       | Default=False   | If visa needed             |
| visa_type            | String(100)   | Nullable        | Type of visa available     |
| processing_time      | String(100)   | Nullable        | Human-readable duration    |
| processing_time_days | Int           | Nullable        | Processing days            |
| fees                 | Decimal(10,2) | Nullable        | Visa fee amount            |
| currency             | String(3)     | Default='USD'   | Fee currency               |
| validity             | String(100)   | Nullable        | Visa validity period       |
| required_documents   | JSON          | Default=list    | Required documents list    |
| exemptions           | JSON          | Default=list    | Exempted countries/regions |
| official_link        | URL           | Nullable        | Official visa website      |
| notes                | Text          | Nullable        | Additional notes           |
| created_at           | DateTime      | Auto            | Creation timestamp         |
| updated_at           | DateTime      | Auto            | Update timestamp           |

**Indexes**:

- country
- visa_required

---

## 5. Forex App Models

### ForexData Model

**Purpose**: Exchange rate information

| Field         | Type          | Constraints     | Description              |
| ------------- | ------------- | --------------- | ------------------------ |
| id            | UUID          | Primary Key     | Unique identifier        |
| currency      | String(3)     | Unique, Indexed | Currency code (ISO 4217) |
| exchange_rate | Decimal(15,6) | Not Null        | Rate vs base currency    |
| base_currency | String(3)     | Default='INR'   | Base currency for rates  |
| source        | String(100)   | Nullable        | Data source              |
| last_updated  | DateTime      | Auto            | Last update timestamp    |
| created_at    | DateTime      | Auto            | Creation timestamp       |
| updated_at    | DateTime      | Auto            | Update timestamp         |

**Indexes**:

- currency

---

## 6. Bookings App Models

### Booking Model

**Purpose**: User travel bookings (flights, hotels, activities)

| Field             | Type          | Constraints      | Description                           |
| ----------------- | ------------- | ---------------- | ------------------------------------- |
| id                | UUID          | Primary Key      | Unique identifier                     |
| user              | FK(User)      | OnDelete=CASCADE | Booking owner                         |
| booking_type      | String(20)    | Choices          | flight/hotel/activity/transport       |
| reference_number  | String(100)   | Unique           | Booking reference                     |
| status            | String(20)    | Choices          | pending/confirmed/cancelled/completed |
| amount            | Decimal(10,2) | Not Null         | Booking cost                          |
| currency          | String(3)     | Default='INR'    | Currency                              |
| booking_date      | DateTime      | Auto             | When booked                           |
| start_date        | Date          | Not Null         | Booking start                         |
| end_date          | Date          | Nullable         | Booking end                           |
| details           | JSON          | Not Null         | Flexible booking details              |
| payment_confirmed | Boolean       | Default=False    | Payment status                        |
| payment_method    | String(50)    | Nullable         | How paid                              |
| created_at        | DateTime      | Auto             | Creation timestamp                    |
| updated_at        | DateTime      | Auto             | Update timestamp                      |

**Indexes**:

- (user, status)
- reference_number

---

## 7. TravelPass App Models

### TravelPass Model

**Purpose**: Digital travel documents and passes

| Field            | Type        | Constraints                 | Description                |
| ---------------- | ----------- | --------------------------- | -------------------------- |
| id               | UUID        | Primary Key                 | Unique identifier          |
| user             | FK(User)    | OnDelete=CASCADE            | Document owner             |
| trip             | FK(Trip)    | Nullable, OnDelete=SET_NULL | Associated trip            |
| title            | String(255) | Not Null                    | Document title             |
| description      | Text        | Nullable                    | Document description       |
| document_path    | File        | Not Null                    | Document file              |
| pdf_path         | File        | Nullable                    | PDF version                |
| document_type    | String(100) | Nullable                    | visa/ticket/insurance/pass |
| valid_from       | Date        | Nullable                    | Validity start             |
| valid_until      | Date        | Nullable                    | Validity end               |
| reference_number | String(100) | Unique                      | Document reference         |
| created_at       | DateTime    | Auto                        | Creation timestamp         |
| updated_at       | DateTime    | Auto                        | Update timestamp           |

**Indexes**:

- (user, trip)

---

## 8. Wallet App Models

### Wallet Model

**Purpose**: User payment wallet

| Field         | Type          | Constraints                | Description        |
| ------------- | ------------- | -------------------------- | ------------------ |
| id            | UUID          | Primary Key                | Unique identifier  |
| user          | FK(User)      | OneToOne, OnDelete=CASCADE | Wallet owner       |
| balance       | Decimal(10,2) | Default=0                  | Current balance    |
| reward_points | Int           | Default=0                  | Accumulated points |
| total_spent   | Decimal(12,2) | Default=0                  | Lifetime spending  |
| total_earned  | Decimal(12,2) | Default=0                  | Total earned/added |
| created_at    | DateTime      | Auto                       | Creation timestamp |
| updated_at    | DateTime      | Auto                       | Update timestamp   |

---

### WalletTransaction Model

**Purpose**: Wallet transaction history

| Field            | Type          | Constraints      | Description               |
| ---------------- | ------------- | ---------------- | ------------------------- |
| id               | UUID          | Primary Key      | Unique identifier         |
| wallet           | FK(Wallet)    | OnDelete=CASCADE | Parent wallet             |
| transaction_type | String(20)    | Choices          | debit/credit              |
| amount           | Decimal(10,2) | Not Null         | Transaction amount        |
| description      | Text          | Not Null         | Transaction reason        |
| reference_id     | String(100)   | Nullable         | Booking/transfer ID       |
| balance_after    | Decimal(10,2) | Not Null         | Balance after transaction |
| created_at       | DateTime      | Auto             | Creation timestamp        |
| updated_at       | DateTime      | Auto             | Update timestamp          |

**Indexes**:

- (wallet, created_at)

---

## 9. Notifications App Models

### Notification Model

**Purpose**: User notifications

| Field             | Type        | Constraints      | Description                                                           |
| ----------------- | ----------- | ---------------- | --------------------------------------------------------------------- |
| id                | UUID        | Primary Key      | Unique identifier                                                     |
| user              | FK(User)    | OnDelete=CASCADE | Notification recipient                                                |
| notification_type | String(50)  | Choices          | trip_reminder/booking_update/visa_alert/price_drop/offer/system/other |
| title             | String(255) | Not Null         | Notification title                                                    |
| message           | Text        | Not Null         | Notification content                                                  |
| icon_url          | URL         | Nullable         | Icon image                                                            |
| action_url        | URL         | Nullable         | Action URL                                                            |
| is_read           | Boolean     | Default=False    | Read status                                                           |
| read_at           | DateTime    | Nullable         | When read                                                             |
| created_at        | DateTime    | Auto             | Creation timestamp                                                    |
| updated_at        | DateTime    | Auto             | Update timestamp                                                      |

**Indexes**:

- (user, is_read)
- created_at

---

## Entity-Relationship Diagram

```
┌─────────────┐
│    User     │
├─────────────┤
│ id (PK)     │
│ email       │
│ name        │
│ phone       │
│ avatar      │
│ currency    │
└─────────────┘
      │
      ├──1:1──> UserPreference
      ├──1:1──> Wallet
      ├──1:M──> Trip
      ├──1:M──> ChatSession
      ├──1:M──> SavedPlace
      ├──1:M──> UploadedDocument
      ├──1:M──> ActivityLog
      ├──1:M──> Booking
      ├──1:M──> TravelPass
      └──1:M──> Notification

┌─────────────┐          ┌──────────────┐
│    Trip     │◄─────────│  Itinerary   │
├─────────────┤ 1:M      ├──────────────┤
│ id (PK)     │          │ id (PK)      │
│ user_id (FK)│          │ trip_id (FK) │
│ destination │          │ day_number   │
│ dates       │          │ title        │
│ budget      │          │ location     │
│ status      │          │ cost         │
└─────────────┘          └──────────────┘
      │
      ├──1:M──> ChatSession
      └──1:M──> TravelPass

┌──────────────┐          ┌─────────────┐
│ ChatSession  │◄─────────│ ChatMessage │
├──────────────┤ 1:M      ├─────────────┤
│ id (PK)      │          │ id (PK)     │
│ user_id (FK) │          │ session (FK)│
│ trip_id (FK) │          │ role        │
│ title        │          │ content     │
└──────────────┘          └─────────────┘

┌──────────────┐          ┌─────────────┐
│   Wallet     │◄─────────│ Transaction │
├──────────────┤ 1:M      ├─────────────┤
│ id (PK)      │          │ id (PK)     │
│ user_id (FK) │          │ wallet (FK) │
│ balance      │          │ type        │
│ points       │          │ amount      │
└──────────────┘          └─────────────┘
```

---

## Data Constraints & Validation

### At Database Level

- Foreign key constraints (referential integrity)
- Unique constraints (email, place_id combinations)
- NOT NULL constraints (required fields)
- Check constraints (valid status values)

### At Application Level

- Django model validation
- Serializer validation
- Custom validators (email format, phone format)
- Business logic validation

---

## Indexing Strategy

### High-Frequency Queries

- User lookups: `User.email`
- Trip retrieval: `Trip(user, status)`
- Messages: `ChatMessage(session, created_at)`
- Transactions: `WalletTransaction(wallet, created_at)`

### Search Queries

- Attractions by location: `Attraction(city, country)`
- Attractions by category: `Attraction.category`
- Attractions by rating: `Attraction.rating DESC`

---

## Backup & Recovery

### Backup Strategy

- Daily automated backups
- Point-in-time recovery capability
- Cross-region replication (future)
- RTO: 1 hour, RPO: 1 day

### Disaster Recovery

- Database replication
- Failover mechanisms
- Data validation checks

---

## Performance Optimization

### Query Optimization

- Selective field selection (`only()`, `defer()`)
- Prefetch related data (`prefetch_related()`)
- Select related for foreign keys (`select_related()`)
- Pagination for large datasets

### Caching Strategy

- Cache popular attractions (Redis)
- Cache exchange rates (Redis with TTL)
- Session caching
- Query result caching

---

## Migration Strategy

### Creating Migrations

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Check migration status
python manage.py showmigrations
```

### Data Migrations

```bash
# Create empty migration
python manage.py makemigrations --empty <app_name> --name <migration_name>

# Write custom migration logic
# Run migration
python manage.py migrate
```

---

**Last Updated**: 2024
**Database Version**: PostgreSQL 16
**Status**: Schema finalized for Phase 1 & 2
