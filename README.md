# Cynbit Technologies: Technical Audit & Backend Reference Implementation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Tests](https://img.shields.io/badge/Vitest-32%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Security](https://img.shields.io/badge/Helmet-Hardened-purple.svg)](https://helmetjs.github.io/)

This repository contains a **Senior Backend Technical Audit** of Cynbit Technologies' public website ([https://www.cynbit.in/](https://www.cynbit.in/)) and a **Production-Grade Backend Reference Implementation** engineered in Node.js, Express, TypeScript, PostgreSQL, and Redis.

---

## 1. Project Objective & Problem Statement

### Objective
Inspect Cynbit's publicly accessible web application from a Senior Backend Developer and Security Reviewer perspective, audit observable network requests, response headers, form validation models, and caching mechanics, and deliver an enterprise-grade backend reference implementation that demonstrates how these backend engineering challenges should be solved in production.

### Key Problems Identified on Production Website
1. **Monolithic Error Feedback & Broken Usability (Issue 3)**:
   Careers application form submissions return a monolithic, untyped error contract `{ success: false, error?: string }`. When server validation fails (e.g. malformed `portfolioUrl`), the client renders a generic top banner without field-level identification, forcing candidates to manually hunt for errors across 15 input fields.
2. **Missing Essential Security Headers**:
   Production omits `Content-Security-Policy` (CSP), `X-Frame-Options` (Clickjacking exposure), `X-Content-Type-Options: nosniff` (MIME sniffing exposure), `Referrer-Policy`, and exposes `X-Powered-By: Next.js`. Top-level document routes serve wildcard CORS (`Access-Control-Allow-Origin: *`).
3. **Unprotected Write Actions (Issue 1)**:
   While page navigations are cached at the Vercel edge (`HIT`), publicly accessible write endpoints lack distributed rate limiting (Token Bucket / Sliding Window) with standard `RateLimit-*` and `Retry-After` headers.
4. **False Delivery Guarantees & Duplicate Ingestion (Issue 4 & 5)**:
   Contact submissions synchronously assert email delivery without an asynchronous transactional outbox or retry queue, and lack `Idempotency-Key` headers to protect against duplicate form submissions.

---

## 2. Technology Stack

* **Runtime:** Node.js v22 (ECMAScript Modules)
* **Language:** TypeScript 5.7 (Strict type-checking)
* **Web Framework:** Express.js 4.21
* **Data Persistence:** PostgreSQL 16 (Connection pooling with `pg.Pool`, parameterized queries, migrations)
* **Distributed State & Rate Limiting:** Redis 7 (Atomic sliding window via Lua scripting in `ioredis`)
* **Validation & Data Integrity:** Zod 3.24 (RFC-compliant emails, strict URL validation, parameter pollution defense)
* **Security & Defense:** Helmet 8 (Strict CSP, Frameguard, MIME nosniff, HSTS with preloading) + CORS allowlisting
* **API Error Standards:** IETF RFC 9457 (Problem Details for HTTP APIs, formerly RFC 7807)
* **Automated Testing:** Vitest 3.0 + Supertest (32 automated unit and integration tests)

---

## 3. Architecture & Clean Layering

```
src/
├── config/             # Environment, PostgreSQL connection pool, Redis client
│   ├── env.ts          # Zod-validated environment configuration
│   ├── database.ts     # PostgreSQL connection pool with in-memory fallback
│   └── redis.ts        # Redis client with distributed Lua and fallback
├── database/           # Database migration runner and DDL schemas
│   └── migrate.ts      # Automated PostgreSQL table and index creation
├── middleware/         # Security and request lifecycle pipeline
│   ├── securityHeaders.ts # Helmet, CSP, Frameguard, and CORS allowlist
│   ├── rateLimiter.ts     # Distributed sliding-window rate limiter via Redis Lua
│   ├── validateSchema.ts  # Zod schema validation mapping to RFC 9457 field errors
│   ├── errorHandler.ts    # Centralized RFC 9457 problem details error handler
│   ├── requestId.ts       # Correlation ID injection (X-Request-Id)
│   └── requestLogger.ts   # Structured JSON request completion logger
├── modules/            # Modular domain modules (Controller -> Service -> Repository)
│   ├── contact/        # Contact form ingestion, idempotency, and outbox trigger
│   ├── newsletter/     # Newsletter subscriptions with duplicate handling
│   └── careers/        # Job opening listings and 15-field candidate blueprint submission
├── services/           # Cross-cutting domain services
│   └── email.service.ts   # Transactional outbox pattern with asynchronous worker
├── utils/              # Shared utilities
│   ├── apiResponse.ts  # Standardized API response envelopes (200, 201, 202, RFC 9457)
│   ├── appError.ts     # Custom error hierarchy (ValidationError, ConflictError, etc.)
│   └── logger.ts       # Structured JSON logger with sensitive data sanitization
├── routes/             # Versioned API routes (/api/v1)
│   └── index.ts        # Aggregator mounting contact, newsletter, careers, health
├── app.ts              # Express application bootstrap
└── server.ts           # HTTP listener with graceful SIGTERM/SIGINT shutdown
```

---

## 4. Key Architectural Features

### 4.1 Distributed Sliding-Window Rate Limiter
Implemented via an atomic Redis Lua script executing in sorted sets (`ZSET`):
* Evicts timestamps older than current window: `ZREMRANGEBYSCORE key -inf clearBefore`.
* Evaluates current active requests against policy maximums.
* If quota breached, calculates exact remaining seconds and returns `HTTP 429 Too Many Requests` with `Retry-After: <sec>` and RFC 9457 problem details.
* Degrades gracefully to local in-memory sliding window if Redis experiences network failure.

### 4.2 RFC 9457 Structured Field-Level Validation
When request validation fails, the response is structured so a frontend can highlight exact offending fields:
```json
{
  "type": "https://api.cynbit.in/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed. Please check field-level errors.",
  "instance": "/api/v1/careers/applications",
  "requestId": "req_f8e7d6c5",
  "timestamp": "2026-10-30T06:55:00.000Z",
  "errors": [
    {
      "field": "portfolioUrl",
      "message": "Please enter a valid URL, such as https://drive.google.com/file/d/... or https://alex.dev"
    }
  ]
}
```

### 4.3 Idempotency Key Replay Protection
Prevents duplicate form submissions:
* Supported via `Idempotency-Key: <UUID>` header.
* Replays original `202 Accepted` response with `meta.isIdempotentReplay: true` if payload matches.
* Rejects conflicting payloads reusing an existing key with `HTTP 409 Conflict`.

### 4.4 Transactional Email Outbox Pattern
Avoids false delivery guarantees by persisting email notifications to `outbox_emails` table before returning `HTTP 202 Accepted`. A decoupled background worker processes jobs with automatic exponential backoff retries.

---

## 5. Local Setup & Execution Guide

### Prerequisites
* Node.js v20+ or v22+
* npm v10+
* Docker & Docker Compose (optional, for running local PostgreSQL & Redis)

### Installation
```bash
# Clone the repository
git clone https://github.com/cynbit-assessment/backend-reference.git
cd Cynbit_Backend_Assignment

# Install dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment settings:
```ini
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=https://www.cynbit.in,http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cynbit_db
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cynbit_db

# Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting Policies
RATE_LIMIT_ENABLED=true
RATE_LIMIT_GLOBAL_MAX=300
RATE_LIMIT_GLOBAL_WINDOW_SEC=60
RATE_LIMIT_CONTACT_MAX=5
RATE_LIMIT_CONTACT_WINDOW_SEC=900
RATE_LIMIT_NEWSLETTER_MAX=5
RATE_LIMIT_NEWSLETTER_WINDOW_SEC=3600
RATE_LIMIT_CAREERS_MAX=10
RATE_LIMIT_CAREERS_WINDOW_SEC=1800
```

### Spin up PostgreSQL & Redis (Docker)
```bash
docker compose up -d
```
*Note: The implementation includes an intelligent in-memory store and ioredis-mock fallback so that automated tests and local development can run seamlessly even without Docker installed!*

### Run Database Migrations
```bash
npm run migrate
```

### Start Development Server
```bash
npm run dev
```
Server starts on `http://localhost:4000`.

### Production Build & Execution
```bash
npm run build
npm start
```

---

## 6. Automated Testing

The repository includes a comprehensive automated test suite with **32 tests across 8 test suites**:

```bash
# Run complete test suite
npm test
```

### Test Coverage Highlights
* **Unit Tests (`tests/unit/validation.test.ts`)**:
  * Email whitespace trimming, lowercase normalization, and maximum length capping.
  * URL syntax validation for portfolio, LinkedIn, and GitHub links.
  * Rejection of non-HTTP protocols (`javascript:`, `ftp:`).
  * Strict rejection of unexpected/unrecognized fields to defeat parameter pollution.
* **Rate Limiter Tests (`tests/unit/rateLimiter.test.ts`)**:
  * Sliding window quota enforcement, HTTP 429 emission, and `Retry-After` calculation.
* **Distributed Multi-Instance Tests (`tests/integration/distributedRateLimiter.test.ts`)**:
  * Multiple isolated Express app server instances sharing a single rate-limiting state pool in Redis.
* **Domain Integration Tests**:
  * `tests/integration/contact.test.ts`: 202 Accepted, idempotency replay, conflicting payload rejection (409).
  * `tests/integration/newsletter.test.ts`: 201 Created, duplicate email graceful handling (200).
  * `tests/integration/careers.test.ts`: Job listings, 15-field application submission, and field-level URL error feedback.
  * `tests/integration/securityHeaders.test.ts`: Removal of `X-Powered-By`, verification of CSP, nosniff, frameguard, and HSTS.
  * `tests/integration/health.test.ts`: Readiness and telemetry checks.

---

## 7. API Reference Summary

Full OpenAPI 3.1.0 specifications and payload contracts are available in [`docs/api-documentation.md`](./docs/api-documentation.md).

### Quick Curl Examples

#### 1. Check System Health
```bash
curl -i http://localhost:4000/health
```

#### 2. Submit Contact Inquiry (with Idempotency Key)
```bash
curl -i -X POST http://localhost:4000/api/v1/contact \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 11111111-2222-3333-4444-555555555555" \
  -d '{
    "fullName": "Alex Rivera",
    "email": "alex.rivera@example.com",
    "company": "Fintech Solutions",
    "industry": "Finance",
    "message": "We need custom AI agents integrated into our backend infrastructure."
  }'
```

#### 3. Subscribe to Newsletter
```bash
curl -i -X POST http://localhost:4000/api/v1/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.rivera@example.com"}'
```

#### 4. List Open Jobs
```bash
curl -i http://localhost:4000/api/v1/careers/jobs
```

#### 5. Submit Careers Blueprint
```bash
curl -i -X POST http://localhost:4000/api/v1/careers/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "business-development-intern",
    "fullName": "Alex Rivera",
    "email": "alex.rivera@domain.com",
    "phone": "+919876543210",
    "whatsapp": "+919876543210",
    "dob": "2001-05-15",
    "education": {
      "qualificationLevel": "Bachelor’s Degree",
      "degree": "B.Tech / B.E.",
      "university": "State University",
      "graduationYear": "2025",
      "scoreType": "CGPA",
      "scoreValue": "8.8"
    },
    "noticePeriod": "Immediate",
    "skills": "Node.js, TypeScript, PostgreSQL",
    "currentCity": "Jaipur",
    "portfolioUrl": "https://drive.google.com/file/d/alex-blueprint",
    "linkedinUrl": "https://linkedin.com/in/alexrivera",
    "professionalProfileUrl": "https://github.com/alexrivera",
    "agreedToTerms": true
  }'
```

---

## 8. Documentation Index

The repository includes extensive technical reports in the `docs/` folder:
* **[Technical Audit Report (`docs/technical-audit.md`)](./docs/technical-audit.md)**: In-depth technical audit of Cynbit Technologies' public website, inspecting network requests, headers, Server Actions, edge caching, and security exposures.
* **[Findings Matrix (`docs/findings-matrix.md`)](./docs/findings-matrix.md)**: Structured matrix mapping all 13 audit findings with evidence, severity, status, impact, and verification methods.
* **[Architecture Document (`docs/architecture.md`)](./docs/architecture.md)**: Clean architecture diagrams, Redis Lua rate limiting formulas, RFC 9457 error contracts, and database relational models.
* **[API Documentation (`docs/api-documentation.md`)](./docs/api-documentation.md)**: Complete OpenAPI 3.1.0 specification with request/response schemas, status codes, and rate limiting policies.

---

## 9. Known Limitations

* **Passive Audit Boundary**: In strict compliance with security ethics, no penetration testing, automated fuzzing, or fake form spam was executed against Cynbit's production website. Findings were established through passive network inspection and verified locally.
* **Email Provider**: Local development utilizes the mock email provider (`EMAIL_PROVIDER=mock`) with durable database queueing. Production deployment simply requires plugging in SMTP or SendGrid credentials in `src/services/email.service.ts`.

---

## License

This project is licensed under the MIT License.
