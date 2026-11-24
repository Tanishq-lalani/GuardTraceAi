<div align="center">



# GuardTraceAI

**A secure AI workspace that catches sensitive data and risky prompts before they ever reach the model.**

Employees get a clean, familiar chat experience. Admins get organization-wide visibility: usage trends, risk scoring, blocked-attempt forensics, and a tamper-evident audit trail. Every message is inspected locally — PII, secrets, and prompt-injection attempts are blocked *before* anything is sent to the AI provider.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google&logoColor=white)](https://ai.google.dev)

**[Live App](https://guardtraceai-frontend.onrender.com)** · **[API](https://guardtraceai.onrender.com)** · **[Interactive API Docs](https://guardtraceai.onrender.com/docs)**

</div>

---

## Table of contents

- [Overview](#overview)
- [Live deployment](#live-deployment)
- [Features](#features)
- [Architecture](#architecture)
- [Request lifecycle](#request-lifecycle)
- [Tech stack](#tech-stack)
- [Security model](#security-model)
- [Repository structure](#repository-structure)
- [API reference](#api-reference)
- [Database schema](#database-schema)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Docker Compose](#docker-compose)
- [Deployment on Render](#deployment-on-render)
- [The `/api` prefix (important)](#the-api-prefix-important)
- [Troubleshooting](#troubleshooting)
- [Development scripts](#development-scripts)
- [Roadmap & known limitations](#roadmap--known-limitations)
- [Contributing](#contributing)

---

## Overview

GuardTraceAI sits between your team and a generative AI provider as a **policy-enforcing gateway**. Instead of letting prompts flow straight from the browser to Gemini, the backend:

1. authenticates the request and checks quota,
2. scans the prompt for personal data, secrets, and prompt-injection patterns,
3. blocks unsafe prompts and records a security event (data *types* only — never the secret itself),
4. serves safe prompts from a per-organization Redis cache when possible, or forwards them to Gemini,
5. persists the conversation, token usage, and latency for analytics and audit.

Multi-tenancy is baked in: every user belongs to an **organization**, every query is scoped to it, and cached responses never cross organization boundaries.

---

## Live deployment

| Service | URL | Stack |
| --- | --- | --- |
| Frontend | <https://guardtraceai-frontend.onrender.com> | React SPA served by Nginx (Docker) |
| Backend API | <https://guardtraceai.onrender.com> | FastAPI + Uvicorn (Docker) |
| API docs | <https://guardtraceai.onrender.com/docs> | Swagger UI |
| ReDoc | <https://guardtraceai.onrender.com/redoc> | ReDoc |

> Free-tier Render services sleep after idle. The first request after a nap can return `502` for ~30–60 seconds while the backend wakes; simply retry.

---

## Features

### Employee workspace

- **Organization self-registration** — creating an account creates the organization and its first admin in one transaction.
- **Secure authentication** — bcrypt password hashing, JWT access tokens (1 hour), automatic session expiry handling.
- **Forced password rotation** — admin-issued accounts start with a one-time temporary password and must change it on first login.
- **AI chat workspace** — conversation sidebar, message history, token/usage meter, responsive mobile layout.
- **Safe-by-default messaging** — blocked prompts are removed from the UI so sensitive text is never echoed back.
- **Dark / light theme** — persisted in local storage, defaults to the OS preference.
- **Accessibility** — labelled controls, ARIA roles, keyboard-friendly navigation.

### Admin control plane

- **Overview analytics** — employees, prompts, violations, tokens, daily activity chart, violations by type, sensitive-data breakdown, cache-hit rate.
- **Employee management** — create accounts with generated temporary passwords, activate/deactivate, reset passwords.
- **Risk leaderboard** — per-employee risk index (0–100), violation rate, token usage, cache hits, and a peer percentile ("riskier than N% of colleagues").
- **Per-employee drill-down** — ranked stats, recent violations, paginated conversation history, read-only conversation viewer.
- **Security events feed** — filter blocked attempts by time window, severity, event type, and employee.
- **Audit log** — every admin action is recorded, including conversation views, account creation, activation/deactivation, and password resets.

### Security engine

- **PII & secret detection** — emails, phone numbers, SSNs, Aadhaar, PAN, API keys/tokens, and credit cards (with a Luhn checksum to reduce false positives).
- **Prompt-injection detection** — pattern matching for instruction-override and jailbreak attempts.
- **Optional ML classifier** — lazily loaded `protectai/deberta-v3-base-prompt-injection-v2` model scores prompts when enabled.
- **Severity & risk scoring** — every block is classified `low` / `medium` / `high` with a numeric risk score.
- **Brute-force protection** — Redis-backed login throttling per `email + IP` and per IP.
- **Cache isolation** — cache keys include the organization scope.
- **Hardened delivery** — Nginx sends `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options` headers and hides server tokens; CORS is restricted to the configured frontend origin.

---

## Architecture

```mermaid
flowchart LR
    U["Browser<br/>React 19 SPA"] -->|HTTPS| N["Nginx 1.27<br/>static SPA + /api proxy"]
    N -->|"/api/* → /*"| F["FastAPI + Uvicorn<br/>JWT · routers · middleware"]

    F --> RC["Risk classifier<br/>regex + optional ML"]
    F --> CE["Cache engine<br/>Redis client"]
    CE --> R[("Redis 7 / Upstash<br/>cache · quota · rate limits")]
    F --> DB[("PostgreSQL 17<br/>orgs · users · chat · events · audit")]
    F -->|safe prompts only| G["Google Gemini API"]
    G --> F
```

**Why a proxy at all?** The browser talks to a single origin (`/api/...`), avoiding CORS in production, letting Nginx serve the SPA with client-side-routing fallback, and keeping the backend URL out of the client bundle.

---

## Request lifecycle

A `POST /chat` request passes through the following gates in order:

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Nginx
    participant F as FastAPI
    participant S as Risk Classifier
    participant R as Redis
    participant D as PostgreSQL
    participant G as Gemini

    B->>N: POST /api/chat (Bearer JWT)
    N->>F: POST /chat
    F->>D: load user + conversation (ownership check)
    F->>R: daily usage check (limit)
    F->>S: inspect_prompt(text)
    alt unsafe
        S-->>F: PII / injection found
        F->>D: store security event (types only)
        F->>R: increment usage (blocks count)
        F-->>B: 400 Message blocked
    else safe
        F->>R: org-scoped cache lookup
        alt cache hit
            R-->>F: cached reply
        else cache miss
            F->>G: generate_content
            G-->>F: reply + token usage
            F->>R: store reply (TTL 1h)
        end
        F->>D: persist user + assistant messages
        F->>R: increment usage
        F-->>B: 200 reply + usage
    end
```

Blocked attempts still consume the daily quota — this prevents probing the filter for free.

---

## Tech stack

### Frontend

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| UI library | React | 19.2 | Component model, lazy routes |
| Build tool | Vite + Rolldown runtime | 8.3 | Dev server, production bundling |
| Styling | Tailwind CSS (`@tailwindcss/vite`) | 4.3 | Utility-first design system |
| Routing | React Router | 7.18 | SPA routes + guards |
| HTTP | Axios | 1.20 | API client, interceptors |
| Charts | Recharts | 3.10 | Admin analytics visualizations |
| Linting | oxlint | 1.81 | Fast linting |
| Fonts/design | Custom CSS tokens | — | Light/dark themes, landing page |

### Backend

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| Language | Python | 3.12 (Docker) | Runtime |
| Framework | FastAPI | ≥ 0.110 | Routers, validation, OpenAPI |
| Server | Uvicorn | 0.30.6 | ASGI server (`--proxy-headers`) |
| Validation | Pydantic + pydantic-settings | ≥ 2.6 | Schemas + env config |
| ORM | SQLAlchemy | ≥ 2.0 | Typed models, sessions |
| Migrations | Alembic | ≥ 1.13 | Versioned schema changes |
| Driver | psycopg | ≥ 3.2 | PostgreSQL connectivity |
| Auth | PyJWT + bcrypt | ≥ 2.8 / ≥ 4.1 | JWT issuance, password hashing |
| AI | google-genai SDK | 1.0.0 | Async Gemini calls |
| Cache/limits | redis (asyncio) | ≥ 5.0 | Cache, quota, login throttling |
| HTTP | httpx | ≥ 0.27 | Async client utilities |
| Config | python-dotenv | ≥ 1.0 | `.env` loading |
| ML (optional) | torch, transformers, numpy | ≥ 2.2 / ≥ 4.38 / ≥ 1.26 | Prompt-injection classifier |

### Data & infrastructure

| Layer | Technology | Purpose |
| --- | --- | --- |
| Database | PostgreSQL 17 (Alpine) | Durable relational store |
| Cache | Redis 7 (Alpine) or Upstash (`rediss://`) | Response cache, quotas, rate limits |
| Containers | Docker multi-stage builds | Reproducible images |
| Web server | Nginx 1.27 (Alpine) | SPA hosting, API reverse proxy, security headers |
| Orchestration | Docker Compose | Local one-command stack |
| Hosting | Render | Frontend + backend web services |
| Edge | Cloudflare (Render edge) | TLS termination, routing |

---

## Security model

| Control | Implementation |
| --- | --- |
| Password storage | bcrypt with per-password salt |
| Sessions | JWT (HS256), `sub` = user id, 1-hour expiry |
| Authorization | Role checks (`admin` / `user`); every admin query filtered by `organization_id` |
| Brute force | Redis counters: 5 failures per email+IP, 20 per IP, 15-minute window |
| Temp passwords | Random 12-char password, `must_change_password` enforced by API and route guard |
| Prompt inspection | Regex PII/secrets + injection patterns, optional ML model |
| Secret hygiene | Security events store *detected types* only, never the matched value |
| Cache tenancy | SHA-256 cache key includes `scope=org:<id>` |
| CORS | Allow-list containing only `FRONTEND_URL` |
| Transport | HTTPS at the Render/Cloudflare edge; Nginx proxies to the backend over TLS with SNI |
| Response headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `server_tokens off` |
| Secrets management | Environment variables only; `.env` files are git-ignored |

### PII & risk rules

| Signal | Pattern / rule | Weight |
| --- | --- | --- |
| API keys / tokens | `bearer`, `api_key`, `secret`, `sk-…`, `AIza…`, `ghp_…` | 0.90 |
| Credit cards | 13–19 digits + Luhn checksum | 0.90 |
| SSN | `###-##-####` | 0.90 |
| Aadhaar | 12-digit Indian ID | 0.80 |
| PAN | `AAAAA9999A` | 0.70 |
| Email | Standard email pattern | 0.40 |
| Phone | Indian / US formats | 0.40 |
| Prompt injection | "ignore previous instructions", jailbreak, prompt-reveal patterns | 0.85 |

A prompt is blocked when **any** PII/secret rule matches, an injection pattern matches, or the optional ML score exceeds `PII_CONFIDENCE_THRESHOLD` (default `0.5`). Severity maps from the risk score: `high ≥ 0.8`, `medium ≥ 0.5`, otherwise `low`.

### Admin risk index

The leaderboard risk score is a bounded aggregate of weighted security events:

```
risk = min(100, 100 × Σ(severity weight) / (3 × max(attempts, 10)))
```

where `attempts = prompts + violations` and severity weights are `high = 3`, `medium = 2`, `low = 1`. The `max(attempts, 10)` floor prevents a single event from producing a misleading 100.

---

## Repository structure

```text
GuardTraceAI/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan, CORS, /api normalization
│   ├── config.py                # Pydantic settings (env-driven)
│   ├── database.py              # SQLAlchemy engine
│   ├── gemini_client.py         # Async Gemini wrapper + token accounting
│   ├── core/
│   │   ├── auth.py              # bcrypt + JWT helpers
│   │   ├── cache.py             # Redis cache, quotas, login throttling
│   │   ├── dependencies.py      # Bearer auth, current user, admin guard
│   │   └── audit.py             # Audit log helper
│   ├── routes/
│   │   ├── auth.py              # register / login / me / change-password
│   │   ├── conversation.py      # create & list conversations
│   │   ├── message.py           # conversation messages
│   │   ├── chat.py              # guarded chat pipeline
│   │   ├── admin.py             # employee management
│   │   └── admin_analytics.py   # overview, leaderboard, events, audit
│   ├── schemas/                 # Pydantic schemas + SQLAlchemy models
│   ├── ml/risk_classifier.py    # regex + optional DeBERTa classifier
│   ├── alembic/                 # migrations
│   ├── requirements.txt
│   ├── requirements-ml.txt      # optional ML dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/               # landing, auth, dashboards
│   │   ├── components/admin/    # analytics tabs, tables, charts
│   │   ├── components/common/   # brand, headers, footer, theme toggle
│   │   ├── context/             # theme provider
│   │   ├── layouts/             # public + workspace shells
│   │   ├── axiosInstance.js     # base URL + auth/401 interceptors
│   │   └── App.jsx              # lazy routes + guards
│   ├── public/
│   ├── nginx.conf               # SPA routing + /api reverse proxy
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yaml          # postgres + redis + backend + frontend
└── README.md
```

---

## API reference

All routes below are also served under an **`/api` alias** (see [The `/api` prefix](#the-api-prefix-important)). Interactive docs: `/docs`.

### Authentication

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create organization + first admin (201). Body: `organization_name`, `name`, `email`, `password` |
| `POST` | `/auth/login` | Public | Returns `access_token`, `role`, `must_change_password`. Rate-limited |
| `GET` | `/auth/me` | Bearer | Current user profile + organization name |
| `POST` | `/auth/change-password` | Bearer | Body: `current_password`, `new_password`; clears the forced-change flag |

### Conversations & chat

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/conversations` | Bearer | Create a conversation; body `{ "title": null }` |
| `GET` | `/conversations` | Bearer | List the current user's conversations |
| `GET` | `/conversations/{id}/messages` | Bearer | Message history (ownership enforced) |
| `POST` | `/conversations/{id}/messages` | Bearer | Append a message directly |
| `POST` | `/chat` | Bearer | Full guarded pipeline; body `conversation_id`, `message`; returns reply + usage |

### Admin — employees

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/admin/users` | Admin | Create employee; returns a one-time temporary password |
| `GET` | `/admin/users` | Admin | List users in the admin's organization |
| `PATCH` | `/admin/users/{id}/status` | Admin | Activate/deactivate; body `{ "is_active": bool }` |
| `POST` | `/admin/users/{id}/reset-password` | Admin | Issue a new temporary password |

### Admin — analytics & audit

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/overview?days=30` | Admin | Totals, daily series, violation/PII breakdowns, cache stats |
| `GET` | `/admin/leaderboard?days=30` | Admin | Ranked employee risk index + peer percentiles |
| `GET` | `/admin/users/{id}?days=30` | Admin | Employee profile, stats, recent violations |
| `GET` | `/admin/users/{id}/history?limit=&offset=` | Admin | Paginated conversation history |
| `GET` | `/admin/conversations/{id}/messages` | Admin | Read a conversation (writes an audit entry) |
| `GET` | `/admin/events?days=&user_id=&event_type=&severity=&limit=&offset=` | Admin | Filterable security-event feed |
| `GET` | `/admin/audit-log?limit=&offset=` | Admin | Admin action history |

### Operations

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Service banner |
| `GET` | `/health` | Public | `{"status":"healthy"}` — used for warm-up and health checks |

`GET /healthz` on the **frontend** host is Nginx's own health endpoint.

### Status codes you will see

| Code | Meaning |
| --- | --- |
| `400` | Prompt blocked by the security engine (payload includes risk score, detected types, injection flag) |
| `401` | Missing/expired JWT, or invalid credentials |
| `403` | Inactive account, forced password change pending, or not an admin |
| `409` | Email already registered |
| `422` | Request validation error |
| `429` | Login throttled or daily chat limit reached |
| `502`/`503` | Upstream AI provider error (or a sleeping backend during wake-up) |

---

## Database schema

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    ORGANIZATIONS ||--o{ SECURITY_EVENTS : scopes
    ORGANIZATIONS ||--o{ AUDIT_LOGS : scopes
    USERS ||--o{ CONVERSATIONS : owns
    USERS ||--o{ USERS : "created_by"
    CONVERSATIONS ||--o{ MESSAGES : contains
    CONVERSATIONS ||--o{ SECURITY_EVENTS : may_reference
    USERS ||--o{ AUDIT_LOGS : "admin"
```

| Table | Key columns | Purpose |
| --- | --- | --- |
| `organizations` | `id`, `name`, `created_at` | Tenant boundary |
| `users` | `id`, `organization_id`, `created_by`, `name`, `email` (unique), `password_hash`, `role`, `is_active`, `must_change_password`, `last_login_at` | Admins and employees |
| `conversations` | `id`, `user_id`, `title`, `created_at` | Chat threads |
| `messages` | `id`, `conversation_id`, `role`, `content`, `model`, `prompt_tokens`, `completion_tokens`, `cached`, `latency_ms`, `created_at` | Message history + usage telemetry |
| `security_events` | `id`, `organization_id`, `user_id`, `conversation_id`, `event_type`, `action_taken`, `severity`, `risk_score`, `detected_pii`, `created_at` | Blocked-attempt forensics (types only) |
| `audit_logs` | `id`, `organization_id`, `admin_id`, `action`, `target_user_id`, `conversation_id`, `created_at` | Admin accountability trail |

Migration chain (`alembic upgrade head` runs automatically in the backend container):

```text
739463d5f216 (initial tables)
  └── 15ae19772193 (initial tables)
        └── cb77fe8a2abb (organizations token tracking)
              └── ec3dbf38addc (audit log)
```

---

## Local development

### Prerequisites

- Node.js 20+ (22 recommended)
- Python 3.12+
- PostgreSQL 15+ (17 recommended)
- Redis 7 (optional locally — the app degrades gracefully without it)
- Docker + Docker Compose (optional, fastest path)

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows (Git Bash): source .venv/Scripts/activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
# Optional ML classifier dependencies:
# pip install -r requirements-ml.txt
```

Create `backend/.env` (this file is git-ignored):

```env
DATABASE_URL=postgresql+psycopg://guardtrace_user:change-me@localhost:5432/guardtrace
SECRET_KEY=replace-with-openssl-rand-hex-32
ALGORITHM=HS256
GEMINI_API_KEY=your-google-ai-studio-key
FRONTEND_URL=http://localhost:5173

# Redis: a full URL wins over host/port settings
REDIS_URL=redis://localhost:6379/0
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
# REDIS_SSL=false

DEFAULT_MODEL=gemini-3.6-flash
FREE_DAILY_LIMIT=20
REDIS_TTL_SECONDS=3600
ENABLE_ML_CLASSIFIER=false
```

Apply migrations and start the API:

```bash
alembic upgrade head
uvicorn main:app --reload --port 8000
```

- API: <http://127.0.0.1:8000>
- Swagger UI: <http://127.0.0.1:8000/docs>

If Redis is unreachable, the server still starts; caching, quotas, and login throttling become no-ops (fail-open).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The client defaults to `http://127.0.0.1:8000`. Override it with a `frontend/.env` file:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Open <http://localhost:5173>, register an organization, and you are in.

Useful commands:

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run oxlint |

---

## Environment variables

### Backend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host:5432/db` |
| `SECRET_KEY` | Yes | — | JWT signing key (32+ random bytes recommended) |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `GEMINI_API_KEY` | Yes for chat | — | Google AI Studio key |
| `DEFAULT_MODEL` | No | `gemini-3.6-flash` | Model used for chat |
| `FRONTEND_URL` | No | `http://localhost:5173` | Exact CORS origin of the frontend |
| `REDIS_URL` | Recommended | — | Full URL; supports `rediss://` for Upstash |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_SSL` | Fallback | `localhost` / `6379` / — / `true` | Used when `REDIS_URL` is absent |
| `REDIS_TTL_SECONDS` | No | `3600` | Response-cache TTL |
| `FREE_DAILY_LIMIT` | No | `20` | Chat requests per user per day |
| `ENABLE_ML_CLASSIFIER` | No | `false` | Enable the DeBERTa prompt-injection model |
| `ML_MODEL_NAME` | No | `protectai/deberta-v3-base-prompt-injection-v2` | Hugging Face model id |
| `PII_CONFIDENCE_THRESHOLD` | No | `0.5` | ML score threshold for blocking |
| `LOGIN_MAX_ATTEMPTS` | No | `5` | Failures per email+IP before lockout |
| `LOGIN_MAX_ATTEMPTS_PER_IP` | No | `20` | Failures per IP before lockout |
| `LOGIN_WINDOW_SECONDS` | No | `900` | Rate-limit window (15 minutes) |

### Frontend

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` in Docker builds, `http://127.0.0.1:8000` in source | API base URL (baked at build time) |

---

## Docker Compose

The compose file runs the full stack: PostgreSQL, Redis, the backend, and the Nginx-hosted frontend with health checks and dependency ordering.

Create a root `.env` (git-ignored):

```env
POSTGRES_USER=guardtrace_user
POSTGRES_PASSWORD=change-me
POSTGRES_DB=guardtrace
SECRET_KEY=replace-with-openssl-rand-hex-32
GEMINI_API_KEY=your-google-ai-studio-key
FRONTEND_URL=http://localhost:8080
APP_PORT=8080
INSTALL_ML_CLASSIFIER=false
```

Then:

```bash
docker compose up --build
```

| Service | Container | Notes |
| --- | --- | --- |
| `postgres` | `postgres:17-alpine` | Healthcheck via `pg_isready`, persistent volume |
| `redis` | `redis:7-alpine` | AOF persistence, healthcheck via `redis-cli ping` |
| `backend` | Built from `backend/Dockerfile` | Waits for healthy DB/Redis; runs `alembic upgrade head` then Uvicorn |
| `frontend` | Built from `frontend/Dockerfile` | Nginx on `127.0.0.1:8080`, proxies `/api` to the configured backend |

The frontend is bound to loopback only (`127.0.0.1:${APP_PORT}`) — put an HTTPS reverse proxy in front for any real deployment.

> **Local stack note:** `frontend/nginx.conf` proxies `/api` to the deployed Render backend. If you want Compose to use the local `backend` container instead, change the upstream to `http://backend:8000/` and remove the `proxy_ssl_*` directives and TLS `Host` override. Keeping it pointed at Render is intentional for deployments where only the frontend runs in Docker.

---

## Deployment on Render

Both services deploy as **Docker web services** from this repository.

### Backend service

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Dockerfile | `backend/Dockerfile` |
| Port | `8000` |
| Health check path | `/health` |
| Start command | `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'` |

Required environment: `DATABASE_URL` (Render PostgreSQL or external), `SECRET_KEY`, `GEMINI_API_KEY`, `FRONTEND_URL=https://guardtraceai-frontend.onrender.com`, and `REDIS_URL` (Upstash `rediss://…`).

### Frontend service

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Dockerfile | `frontend/Dockerfile` |
| Port | `80` |
| Health check path | `/healthz` |
| Build arg | `VITE_API_BASE_URL=/api` (image default) |

The image is a two-stage build: Node bundles the SPA, then Nginx serves `dist/` and proxies `/api/*` to the backend.

### Deployment checklist

1. Push to `main` (Render auto-deploys, or trigger a manual deploy).
2. Deploy the **backend** first and confirm `GET https://guardtraceai.onrender.com/health` returns `200`.
3. Deploy the **frontend**, then verify the proxy end-to-end:
   ```bash
   curl -i https://guardtraceai-frontend.onrender.com/api/health
   # → 200 {"status":"healthy"}
   ```
4. Set `FRONTEND_URL` on the backend to the **exact** frontend origin (scheme + host, no trailing slash) and redeploy if it changed.
5. Open the app, register an organization, and confirm the dashboard loads.

---

## The `/api` prefix (important)

There are two layers that make the prefix work, and it is worth understanding both because a mismatch here produces confusing `404`s:

1. **Nginx (frontend)** — `location /api/` uses `proxy_pass https://<backend-host>/;` **with a trailing slash**. Nginx replaces the matched `/api/` prefix, so `/api/auth/register` becomes `/auth/register` upstream.
2. **FastAPI (backend)** — a small middleware in `backend/main.py` strips a leading `/api` if it is still present, so `/auth/register` **and** `/api/auth/register` both resolve.

This makes the deployment resilient: whether traffic is proxied, direct, or hits a proxy that does not rewrite the path, the API answers. The same middleware means the app also works behind other hosts (Railway, Fly.io, a VPS with Nginx) without code changes.

Rules of thumb:

- Keep `proxy_pass` and `proxy_set_header Host` pointing at the **same** backend hostname.
- A backend hostname with no Render service returns a **plain-text `404 Not Found`** (10 bytes) plus the header `x-render-routing: no-server`. That is *not* a FastAPI 404. FastAPI's 404 body is JSON: `{"detail":"Not Found"}`.
- Change the backend URL in **two places** in `frontend/nginx.conf` (`proxy_pass` and `Host`) and redeploy the frontend.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `404` with body `{"detail":"Not Found"}` | Path prefix mismatch | Backend accepts both `/x` and `/api/x`; confirm the route and proxy rewrite |
| `404` with plain `Not Found`, header `x-render-routing: no-server` | Nginx upstream points at a nonexistent Render service | Use the exact backend service URL in `proxy_pass` and `Host` |
| `502` through the frontend, `200` on the backend | Backend asleep (free tier) or starting | Retry after ~30–60 s; warm it via `GET /health` |
| Browser CORS error | `FRONTEND_URL` does not match the frontend origin | Set the exact origin, redeploy the backend |
| `429` on login | Brute-force limiter triggered | Wait for the 15-minute window; inspect `gt_login_fail*` keys |
| `429` on chat | Daily quota reached | Raise `FREE_DAILY_LIMIT` or wait for the next day (key is date-scoped) |
| `400` "Message blocked by security system" | PII/secret or injection detected | Remove sensitive content; details include detected types and risk score |
| `401` and redirect to login | JWT expired (1 hour) | Sign in again |
| Redis warnings at startup | Bad URL/credentials/TLS | Check `REDIS_URL` (`rediss://` for TLS); the app continues without cache |
| Frontend route 404 on refresh | SPA fallback missing | Nginx must keep `try_files $uri $uri/ /index.html` |
| Alembic failure on deploy | Database unreachable or migrations out of order | Verify `DATABASE_URL`; run `alembic upgrade head` locally to reproduce |

---

## Development scripts

| Script | Location | Purpose |
| --- | --- | --- |
| `create_table.py` | `backend/` | Legacy shortcut that calls `Base.metadata.create_all`. **Prefer Alembic** as the source of truth |
| `initial_user.py` | `backend/` | Legacy seed script; predates organizations, so use the registration flow instead |
| `test_db.py`, `check.py` | `backend/` | Ad-hoc database/connectivity probes |

> These helper scripts are development conveniences and are not part of the deployment path.

---

## Roadmap & known limitations

- **Token storage** — access tokens live in `localStorage`; moving to `httpOnly`, `SameSite` cookies would reduce XSS exposure.
- **No refresh tokens** — sessions expire after 1 hour and require a fresh login.
- **Exact-match cache** — responses are cached by an exact prompt/parameters hash; semantic (embedding-based) caching is a natural next step (the original design notes mention it).
- **Single AI provider** — Gemini today; the gateway abstraction makes adding OpenAI/Anthropic providers straightforward.
- **ML classifier off by default** — enabling it requires `INSTALL_ML_CLASSIFIER=true` at build time and `ENABLE_ML_CLASSIFIER=true` at runtime; the model loads in a background thread to keep startup fast.
- **No automated test suite** — high-value targets for contributors: auth flows, the chat inspection pipeline, tenant scoping, and admin analytics.
- **Compliance** — the app implements security controls, but it is not certified for HIPAA/GDPR/DPDP by itself; pair it with your organization's policies.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes focused; match the existing code style (React function components, FastAPI routers, Pydantic schemas).
3. For backend changes: add/adjust an Alembic migration rather than editing `create_table.py`.
4. Run `npm run lint` and `npm run build` in `frontend/`, and start `uvicorn` locally to smoke-test API changes.
5. Open a pull request describing the change and how you verified it.

---

<div align="center">

**GuardTraceAI** — give your team the freedom to use AI, with guardrails.

Maintained by [@Tanishq-lalani](https://github.com/Tanishq-lalani)

</div>
