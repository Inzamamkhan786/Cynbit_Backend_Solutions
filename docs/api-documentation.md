# Cynbit Backend Reference API Specification

**Version:** 1.0.0  
**Base URL:** `http://localhost:4000` (or configured host)  
**Specification Standard:** OpenAPI 3.1.0 Compatible  
**Content-Type:** `application/json`  
**Error Standard:** RFC 9457 (`application/problem+json`)  

---

## Endpoint Summary

| Method | Path | Purpose | Rate Limit Policy | Response Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Deep health & readiness inspection | Global (300 / 60s) | `200`, `207` |
| `POST` | `/api/v1/contact` | Submit architectural contact inquiry | Contact (5 / 15m) | `202`, `400`, `409`, `429` |
| `POST` | `/api/v1/newsletter/subscribe`| Subscribe to Technical Briefing | Newsletter (5 / 1h) | `200`, `201`, `400`, `429` |
| `GET` | `/api/v1/careers/jobs` | Retrieve open career openings | Global (300 / 60s) | `200` |
| `GET` | `/api/v1/careers/jobs/:id` | Retrieve single job opening details | Global (300 / 60s) | `200`, `404` |
| `POST` | `/api/v1/careers/applications`| Submit candidate blueprint/application| Careers (10 / 30m) | `201`, `400`, `409`, `429` |

---

## 1. Health & Readiness Probe

### `GET /health`
Returns system health, PostgreSQL pool latency, Redis connectivity status, memory usage, and process uptime.

#### Headers
None required.

#### Responses
* **200 OK**: All services fully operational.
* **207 Multi-Status**: Database or Redis is temporarily degraded.

```json
{
  "success": true,
  "status": 200,
  "message": "All services operational",
  "data": {
    "status": "healthy",
    "timestamp": "2026-10-30T06:55:00.000Z",
    "uptimeSeconds": 1420,
    "services": {
      "database": {
        "status": "healthy",
        "latencyMs": 4
      },
      "redis": {
        "status": "healthy",
        "latencyMs": 1
      }
    },
    "system": {
      "nodeVersion": "v22.13.1",
      "memoryUsageMb": 54,
      "environment": "production"
    }
  },
  "meta": {
    "requestId": "req_health_01",
    "timestamp": "2026-10-30T06:55:00.000Z"
  }
}
```

---

## 2. Contact Inquiry Ingestion

### `POST /api/v1/contact`
Accepts a business inquiry. Validates input, checks for optional idempotency keys, persists to PostgreSQL, and queues an asynchronous email notification job.

#### Rate Limit Policy
* **Tier:** Contact
* **Max Requests:** 5
* **Window:** 900 seconds (15 minutes)

#### Request Headers
* `Content-Type: application/json` (Required)
* `Idempotency-Key: <UUID>` (Optional, protects against duplicate clicks)
* `X-Request-Id: <UUID>` (Optional, auto-generated if omitted)

#### Request Body
```json
{
  "fullName": "Alex Rivera",
  "email": "alex.rivera@example.com",
  "company": "Fintech Global",
  "industry": "Financial Technology",
  "message": "We would like to discuss implementing custom autonomous AI agents for our operations."
}
```

#### Validation Rules
* `fullName`: String, 2–100 chars, trimmed.
* `email`: String, valid email format, max 255 chars, trimmed, lowercased.
* `company`: String, max 120 chars (optional).
* `industry`: String, max 120 chars (optional).
* `message`: String, 10–3000 chars, trimmed.
* Unknown properties: Strictly rejected.

#### Success Response (`HTTP 202 Accepted`)
```json
{
  "success": true,
  "status": 202,
  "message": "Inquiry received and queued for review. A confirmation email has been scheduled.",
  "data": {
    "inquiryId": "b1a37c89-22a4-4f8e-8a24-9dfc12e8471a",
    "status": "PENDING",
    "message": "Inquiry received and queued for review. A confirmation email has been scheduled.",
    "notificationJobId": " job_9f8e7d6c-5b4a-3210-9876-fedcba098765",
    "createdAt": "2026-10-30T06:55:00.000Z"
  },
  "meta": {
    "requestId": "req_contact_01",
    "timestamp": "2026-10-30T06:55:00.000Z",
    "idempotencyKey": "idem_12345",
    "isIdempotentReplay": false
  }
}
```

---

## 3. Newsletter Subscription

### `POST /api/v1/newsletter/subscribe`
Registers an email address for the Cynbit Technical Briefing. Performs server-side email normalization and prevents duplicate registration crashes.

#### Rate Limit Policy
* **Tier:** Newsletter
* **Max Requests:** 5
* **Window:** 3600 seconds (1 hour)

#### Request Body
```json
{
  "email": "alex.rivera@company.com"
}
```

#### Validation Rules
* `email`: String, valid email address, max 255 chars, whitespace trimmed, converted to lowercase.

#### Success Response (`HTTP 201 Created` for new subscriber)
```json
{
  "success": true,
  "status": 201,
  "message": "Successfully subscribed to the Cynbit Technical Briefing.",
  "data": {
    "subscriberId": "d8e3b1c7-4567-4890-a123-ef4567890abc",
    "email": "alex.rivera@company.com",
    "status": "ACTIVE",
    "isExistingSubscriber": false,
    "message": "Successfully subscribed to the Cynbit Technical Briefing."
  },
  "meta": {
    "requestId": "req_sub_01",
    "timestamp": "2026-10-30T06:55:00.000Z"
  }
}
```

#### Idempotent Response (`HTTP 200 OK` for existing subscriber)
```json
{
  "success": true,
  "status": 200,
  "message": "You are already subscribed to the Cynbit Technical Briefing.",
  "data": {
    "subscriberId": "d8e3b1c7-4567-4890-a123-ef4567890abc",
    "email": "alex.rivera@company.com",
    "status": "ACTIVE",
    "isExistingSubscriber": true,
    "message": "You are already subscribed to the Cynbit Technical Briefing."
  }
}
```

---

## 4. Careers Job Listings & Detail

### `GET /api/v1/careers/jobs`
Returns open job openings, optionally filtered by `department`.

#### Query Parameters
* `department`: String (optional, e.g. `Operations`, `Growth`, `Ecosystem`)

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "status": 200,
  "message": "Active job openings retrieved successfully",
  "data": [
    {
      "id": "business-development-intern",
      "title": "Business Development Intern",
      "department": "Growth",
      "location": "Jaipur / Remote",
      "type": "Internship",
      "status": "OPEN",
      "description": "Identify enterprise client opportunities and strategic industry partnerships."
    }
  ]
}
```

---

## 5. Careers Candidate Application Submission

### `POST /api/v1/careers/applications`
Submits a candidate's architectural blueprint and application. Validates all 15 form fields, enforces strict URL syntax, and provides field-level RFC 9457 error feedback.

#### Rate Limit Policy
* **Tier:** Careers
* **Max Requests:** 10
* **Window:** 1800 seconds (30 minutes)

#### Request Body
```json
{
  "jobId": "business-development-intern",
  "fullName": "Alex Rivera",
  "email": "alex.rivera@domain.com",
  "phone": "+919876543210",
  "whatsapp": "+919876543210",
  "dob": "2001-05-15",
  "education": [
    {
      "qualificationLevel": "Bachelor’s Degree",
      "degree": "B.Tech / B.E.",
      "university": "State Engineering University",
      "graduationYear": "2025",
      "scoreType": "CGPA",
      "scoreValue": "8.8",
      "status": "Completed"
    }
  ],
  "noticePeriod": "Immediate",
  "skills": "Node.js, TypeScript, PostgreSQL, Redis",
  "currentCity": "Jaipur",
  "portfolioUrl": "https://drive.google.com/file/d/alex-portfolio-doc",
  "linkedinUrl": "https://linkedin.com/in/alexrivera",
  "professionalProfileUrl": "https://github.com/alexrivera",
  "agreedToTerms": true
}
```

#### Validation Rules
* `jobId`: Required non-empty string.
* `fullName`: String, 2–100 chars.
* `email`: String, valid email format, max 255 chars.
* `phone`: Valid international format `+?[0-9]{7,15}`.
* `whatsapp`: Valid international format `+?[0-9]{7,15}`.
* `dob`: Valid ISO date string `YYYY-MM-DD`.
* `education`: Valid education item schema or array of education items.
* `noticePeriod`: Required string.
* `skills`: String, 2–255 chars.
* `currentCity`: String, 2–100 chars.
* `portfolioUrl`: Valid URL starting with `http://` or `https://` (max 500 chars).
* `linkedinUrl`: Valid URL starting with `http://` or `https://` (max 500 chars).
* `professionalProfileUrl`: Optional URL; if provided and non-empty, must start with `http://` or `https://`.
* `agreedToTerms`: Boolean, must be `true`.

#### Success Response (`HTTP 201 Created`)
```json
{
  "success": true,
  "status": 201,
  "message": "Your technical blueprint has been submitted successfully.",
  "data": {
    "applicationId": "f7d2e9c1-8456-4231-9870-ab1234567890",
    "jobId": "business-development-intern",
    "jobTitle": "Business Development Intern",
    "status": "SUBMITTED",
    "trackingUrl": "/careers/status/f7d2e9c1-8456-4231-9870-ab1234567890",
    "message": "Your technical blueprint has been submitted successfully.",
    "submittedAt": "2026-10-30T06:55:00.000Z"
  }
}
```

#### Field-Level Validation Failure Response (`HTTP 400 Bad Request`, RFC 9457)
*(Demonstrating direct resolution of Issue 3)*
```json
{
  "type": "https://api.cynbit.in/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed. Please check field-level errors.",
  "instance": "/api/v1/careers/applications",
  "requestId": "req_careers_fail_01",
  "timestamp": "2026-10-30T06:55:00.000Z",
  "errors": [
    {
      "field": "portfolioUrl",
      "message": "Please enter a valid URL, such as https://drive.google.com/file/d/... or https://alex.dev",
      "code": "custom"
    }
  ]
}
```

#### Duplicate Application Error (`HTTP 409 Conflict`, RFC 9457)
```json
{
  "type": "https://api.cynbit.in/errors/conflict",
  "title": "Conflict Error",
  "status": 409,
  "detail": "You have already submitted an active application for position 'Business Development Intern'. Your blueprint is currently under architectural review.",
  "instance": "/api/v1/careers/applications",
  "requestId": "req_conflict_01",
  "timestamp": "2026-10-30T06:55:00.000Z"
}
```

---

## 6. Rate Limit Exceeded Response (`HTTP 429 Too Many Requests`)

Returned whenever a client breaches rate limit quotas.

```json
{
  "type": "https://api.cynbit.in/errors/rate-limit-exceeded",
  "title": "Rate Limit Error",
  "status": 429,
  "detail": "Rate limit exceeded for contact. Please retry after 900 seconds.",
  "instance": "/api/v1/contact",
  "requestId": "req_rate_limit_01",
  "timestamp": "2026-10-30T06:55:00.000Z",
  "retryAfter": 900
}
```

**Associated Response Headers:**
```http
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 900
Retry-After: 900
Content-Type: application/problem+json
```
