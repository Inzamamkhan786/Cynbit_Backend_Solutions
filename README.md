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

## 1. Project Objective & Discovery Overview

### Objective
Inspect Cynbit's publicly accessible web application from a Senior Backend Developer and Security Reviewer perspective, audit observable network requests, response headers, form validation models, and caching mechanics, and deliver an enterprise-grade backend reference implementation that demonstrates how these backend engineering challenges should be solved in production.

### Core Discovery: Next.js Server Actions & Edge Architecture
* **Framework & Hosting:** The application is built with **Next.js (App Router)** hosted on **Vercel** serverless edge infrastructure (`Server: Vercel`, `X-Powered-By: Next.js`).
* **Navigation Architecture:** Route transitions issue React Server Component (`_rsc`) requests (e.g. `GET /[route]?_rsc=[hash]`) hitting Vercel Edge CDN caches (`X-Vercel-Cache: HIT`, `Age: >60,000s`).
* **Form Mutations:** Client forms execute via Next.js **Server Actions** using `POST` requests bearing cryptographic Action IDs:
  * Contact Form: `submitInquiry` (`40247ba4465344b3386595bab4303317cdcce907df`)
  * Newsletter Form: `subscribeToNewsletter` (`40cfc00a772b56a9f2cf23e0d2c13695fd6b5755e3`)
  * Careers Application Form: `submitCandidateApplication` (`40645a00e04f6854903cf3a65fda4c75ddd7691de9`)

---

## 2. Identified Errors, Root Causes & Respective Actions (Solutions)

Below is an exhaustive catalog of all 13 errors, vulnerabilities, and usability failures identified during the technical audit of Cynbit Technologies' public website, together with our respective engineering actions and solutions.

### Master Errors & Solutions Summary Table

| Issue ID | Identified Error / Defect | Severity | Observed Production Evidence | Respective Action Taken / Solution | Core Engineering Approach |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ERR-01** | Unprotected write endpoints (Rate Limiting) | **High** | Server Actions lack `RateLimit-*` & `Retry-After` headers | Redis-backed distributed sliding-window rate limiter | Atomic Redis Lua script with in-memory degraded fallback |
| **ERR-02** | Client-centric email validation & dirty data | **Medium** | Raw email string passed without normalization | Zod schema with trimming, lowercase & 255-char cap | Schema-level sanitization & `.strict()` parameter defense |
| **ERR-03** | Monolithic error feedback & URL validation | **High** | Decompiled chunk shows single top banner shake | RFC 9457 Problem Details (`errors: [{ field, msg }]`) | Strict URL scheme validation + error transformation middleware |
| **ERR-04** | False delivery guarantees & duplicate submits | **Medium** | Synchronous claim; double-click duplicates | Transactional Outbox (`outbox_emails`) + 202 Accepted | Decoupled background queue worker + SHA-256 Idempotency keys |
| **ERR-05** | Newsletter duplicate mishandling | **Medium** | Risk of unhandled DB unique constraint crash | Idempotent upsert returning friendly 200/201 | PostgreSQL `ON CONFLICT` upsert + double-opt-in tokens |
| **ERR-06** | Missing Content-Security-Policy (CSP) | **High** | Header omitted across all production routes | Helmet CSP configuration | Restrictive script/connect/frame-ancestors directives |
| **ERR-07** | Missing Clickjacking protection | **Medium** | Missing `X-Frame-Options` header | Enforced `X-Frame-Options: DENY` | Helmet frameguard blocking unauthorized iframe embedding |
| **ERR-08** | Missing MIME sniffing defense | **Medium** | Missing `X-Content-Type-Options` header | Enforced `X-Content-Type-Options: nosniff` | Strict MIME type enforcement to prevent script confusion |
| **ERR-09** | Server software information leakage | **Low** | `X-Powered-By: Next.js` exposed on multiple routes | Header stripped from all responses | Helmet `hidePoweredBy` to prevent framework fingerprinting |
| **ERR-10** | Overly permissive wildcard CORS | **Medium** | Wildcard `Access-Control-Allow-Origin: *` on documents | Strict CORS origin allowlist | Domain-level allowlist filtering unauthorized web origins |
| **ERR-11** | Absence of request correlation tracing | **Medium** | Missing `X-Request-Id` correlation header | UUID correlation middleware & JSON logger | Distributed tracing correlation propagated to RFC 9457 errors |
| **ERR-12** | Missing system health / readiness probe | **Low** | Probing `/health` yields 404 Not Found | Deep health probe inspecting DB & Redis latency | Readiness check assessing connection pool and memory metrics |
| **ERR-13** | Unbounded payload size / memory bloat risk | **Medium** | No explicit request size ceilings | Strict 100kb payload ceiling on body parsers | Memory exhaustion defense on JSON body parsing |

---

### Deep-Dive: Specific Errors & Respective Actions Taken

#### ERR-01: Public Write Endpoints Lack Origin Distributed Rate Limiting
* **The Error:** Navigating pages ~100 times in 1 minute showed no rate-limiting warnings. Read navigations are edge-cached by Vercel CDN (`Age: 62338`, `304 Not Modified`), but **public form actions (Contact, Newsletter, Careers) lack origin-level distributed rate limiting**, leaving the system vulnerable to bot flooding, database starvation, and email relay exhaustion.
* **Respective Action (Solution):** Engineered a distributed sliding-window rate limiter powered by Redis:
  * Implemented an atomic Redis Lua script executing `ZREMRANGEBYSCORE`, `ZCARD`, and `ZADD` on sorted sets in a single atomic round-trip to prevent Time-of-Check to Time-of-Use (TOCTOU) race conditions in multi-instance clusters.
  * Emits standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`.
  * Returns `HTTP 429 Too Many Requests` with an exact `Retry-After: <seconds>` header and RFC 9457 payload when limits are exceeded.
  * Configured differentiated tiers: Global (300/60s), Contact (5/15m), Newsletter (5/1h), and Careers (10/30m).
  * Built an automatic in-memory sliding window fallback that activates if Redis suffers network disruption.

#### ERR-02: Client-Centric Email Validation & Dirty Data Persistence
* **The Error:** Relying on browser HTML5 `<input type="email">` without server-side string normalization allows whitespace-padded emails (e.g., `" alex@domain.com "`), case variations (`"User@Domain.com"`), or oversized strings to enter database records.
* **Respective Action (Solution):** Created strict Zod schemas with `.trim().toLowerCase().email().max(255)`:
  * Cleans and normalizes email strings at the schema gateway layer before reaching domain services or repositories.
  * Bounded string lengths to 255 characters to protect PostgreSQL B-Tree indexes and memory allocations.
  * Applied `.strict()` across schemas to reject unrecognized fields, defeating parameter pollution attacks.

#### ERR-03: Monolithic Error Feedback & Broken Careers Form URL Validation (Candidate Issue 3)
* **The Error:** In the 15-field Careers application form, an invalid URL triggers a generic top banner (`"Application Submission Error: Something went wrong. Please check all required fields and try again."`) with **zero field-level identification**, forcing candidates to manually scrutinize every field.
* **Empirical Code Evidence:** Decompiled from production bundle `page-082725dddd6cb4ac.js`:
  ```javascript
  let s = await o(r);
  s.success
    ? (m(!0), scrollIntoView())
    : (b(s.error || "Something went wrong. Please check all required fields and try again."),
       document.getElementById("application-form")?.scrollIntoView({ behavior: "smooth" }));
  ```
  The Server Action returns an untyped primitive `{ success: boolean, error?: string }` without field error breakdown.
* **Respective Action (Solution):** Adopted the **IETF RFC 9457 Problem Details** standard, returning structured field arrays:
  ```json
  {
    "type": "https://api.cynbit.in/errors/validation-error",
    "title": "Validation Error",
    "status": 400,
    "detail": "Request validation failed. Please check field-level errors.",
    "instance": "/api/v1/careers/applications",
    "requestId": "req_8a9b2c3d4e5f",
    "errors": [
      {
        "field": "portfolioUrl",
        "message": "Please enter a valid URL, such as https://drive.google.com/file/d/... or https://alex.dev"
      }
    ]
  }
  ```
  * Custom Zod schemas distinguish mandatory URLs (`portfolioUrl`, `linkedinUrl`) from optional URLs (`professionalProfileUrl`).
  * Enforces valid HTTP/HTTPS protocol validation (rejecting `javascript:` or `ftp:` schemes).
  * Central validation middleware maps `ZodError` issues into standard RFC 9457 JSON payloads that any frontend can bind directly to individual form inputs.

#### ERR-04: False Delivery Guarantees & Duplicate Ingestion in Contact Flow
* **The Error:** Contact submissions synchronously assert: `"INQUIRY RECEIVED. The team has been notified and will contact the user via email."` Synchronously promising email delivery is vulnerable to network timeouts or SMTP relay outages, and double-clicking the submit button creates duplicate entries.
* **Respective Action (Solution):** Returns `HTTP 202 Accepted` after durable persistence in PostgreSQL, coupled with an **Asynchronous Transactional Outbox Pattern** and `Idempotency-Key` replay verification:
  * Atomically writes the notification job to an `outbox_emails` table with `status = 'QUEUED'`.
  * An asynchronous background worker executes delivery with exponential backoff retries (up to 3 attempts), decoupling HTTP ingestion from SMTP availability.
  * Validates client `Idempotency-Key` headers using SHA-256 payload hashing: replaying identical requests returns cached responses with `isIdempotentReplay: true`, while conflicting payloads sharing the same key are rejected with `HTTP 409 Conflict`.

#### ERR-05: Newsletter Subscription Duplicate Mishandling
* **The Error:** Submitting an existing email address risks throwing raw PostgreSQL unique constraint violations (`23505 unique_violation`) or leaking internal database table names.
* **Respective Action (Solution):** Built an idempotent subscription handler:
  * Uses PostgreSQL upsert patterns (`ON CONFLICT (email) DO UPDATE SET updated_at = NOW()`).
  * If the email is already subscribed and active, returns friendly `HTTP 200 OK` ("You are already subscribed to the Cynbit Technical Briefing").
  * If the email is new, persists the subscriber, creates a cryptographically secure confirmation token (`crypto.randomBytes(24).toString('hex')`), and returns `HTTP 201 Created`.

#### ERR-06 to ERR-10: Critical Security Headers, Fingerprinting & CORS Gaps
* **The Errors:** Missing CSP (ERR-06), missing `X-Frame-Options` (ERR-07), missing `X-Content-Type-Options: nosniff` (ERR-08), `X-Powered-By: Next.js` exposed (ERR-09), and wildcard `Access-Control-Allow-Origin: *` on documents (ERR-10).
* **Respective Actions (Solutions):**
  * Configured **Helmet 8** middleware enforcing `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a strict CSP (`default-src 'self'; frame-ancestors 'none';`).
  * Stripped `X-Powered-By` from all responses to prevent framework fingerprinting.
  * Replaced wildcard CORS with a strict origin allowlist (`CORS_ORIGIN`).
  * Enforced 2-year HSTS with preload (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).

#### ERR-11 to ERR-13: Observability, Tracing & System Health Deficiencies
* **The Errors:** Missing request correlation IDs (ERR-11), `/health` returning 404 (ERR-12), and unbounded JSON payload sizes (ERR-13).
* **Respective Actions (Solutions):**
  * Built `requestId.ts` middleware injecting `X-Request-Id` UUIDs on every request/response, structured JSON log, and RFC 9457 error instance.
  * Implemented deep `/health` readiness route reporting PostgreSQL connection pool latency (`SELECT 1`), Redis ping latency, process uptime, and memory usage (RSS MB).
  * Enforced a strict 100kb payload cap (`express.json({ limit: '100kb' })`) to protect against memory exhaustion attacks.

---

## 3. Technology Stack

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

## 4. Architecture & Clean Layering

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

The repository includes a comprehensive automated test suite with **32 tests across 8 test suites** (100% passing):

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
* **[Errors, Solutions & Engineering Approaches Guide (`docs/ERRORS_AND_SOLUTIONS_GUIDE.md`)](./docs/ERRORS_AND_SOLUTIONS_GUIDE.md)**: Dedicated plain-text reference guide detailing every defect, empirical root cause, solution contract, and design pattern.
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
