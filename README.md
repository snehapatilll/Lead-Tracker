# Lead Tracker

A small lead management application: capture leads, search them, and move them
through a sales pipeline.

**Live deployment:** _(fill in after deploying — see [Deployment](#deployment))_

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Setup](#setup)
- [Testing](#testing)
- [Deployment](#deployment)
- [Trade-offs](#trade-offs)
- [Future improvements](#future-improvements)

---

## Features

| Feature | Where |
| --- | --- |
| Create a lead | `POST /api/leads` — form in the left panel |
| List leads | `GET /api/leads` — paginated, newest first |
| Search leads | Single search box, matches name, email **and** phone |
| Update lead status | Inline dropdown on each row → `PATCH /api/leads/:id/status` |

Each lead has a **name**, **email**, **phone**, **status** and **createdAt**
timestamp. Status is one of `new`, `contacted`, `qualified`, `converted`,
`lost`.

Beyond the brief: status filtering, sortable columns, pagination, debounced
search, and duplicate-email protection.

---

## Architecture

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite | Required by the brief; Vite for fast builds |
| Backend | Node + Express + TypeScript | Same language as the frontend — one toolchain, one deploy |
| Database | PostgreSQL (Neon) | Relational data with a natural unique constraint on email |
| Validation | zod | One schema drives parsing, defaults and error messages |
| Tests | Vitest + Supertest | Fast, TypeScript-native |
| Hosting | Render (single web service) | Serves API and static bundle from one process |

### Repository layout

```
lead-tracker/
├── server/
│   ├── src/
│   │   ├── domain.ts                    # Lead types + status vocabulary
│   │   ├── validation.ts                # zod schemas for every input
│   │   ├── errors.ts                    # ApiError → safe HTTP responses
│   │   ├── db.ts                        # pg Pool + idempotent schema bootstrap
│   │   ├── app.ts                       # Express app factory (testable)
│   │   ├── index.ts                     # Process bootstrap, graceful shutdown
│   │   ├── routes/leads.ts              # HTTP layer
│   │   └── repositories/
│   │       ├── leadRepository.ts        # Storage interface
│   │       ├── postgresLeadRepository.ts
│   │       └── inMemoryLeadRepository.ts
│   └── tests/leads.test.ts              # 25 integration tests
├── client/
│   └── src/
│       ├── types.ts                     # Mirrors server domain
│       ├── lib/api.ts                   # Typed fetch wrapper
│       ├── lib/useLeads.ts              # All list state in one hook
│       ├── components/                  # Presentational components
│       └── App.tsx
├── render.yaml                          # Deployment blueprint
├── AGENT.md                             # AI usage documentation
└── package.json                         # npm workspaces root
```

### Two decisions worth calling out

**1. A repository interface sits between the routes and Postgres.**

`routes/leads.ts` depends on the `LeadRepository` interface, never on `pg`.
There are two implementations — Postgres for real use, in-memory for tests.

The payoff is that the entire test suite runs against the real Express stack
(routing, validation, serialisation, error handling) with **no database
process**. Clone the repo, `npm install`, `npm test`, and 25 tests pass. A
suite that needs a live Postgres would fail for anyone reviewing this without
one, which defeats the point of having tests.

**2. The API and the client ship as one service.**

In production Express serves `client/dist` alongside `/api/*`. One deploy, one
URL, no CORS configuration, no risk of the frontend pointing at a stale API
host. In development Vite runs separately on `:5173` and proxies `/api` to
`:3000`, so hot reload still works.

### Request flow

```
Browser
  → useLeads hook (debounce 300ms, AbortController cancels superseded requests)
  → lib/api.ts (typed fetch, unwraps { error: { message, details } })
  → Express route (zod parse → 400 with field-level detail on failure)
  → LeadRepository
  → Postgres (parameterised SQL, COUNT(*) OVER() for pagination totals)
```

---

## API reference

Base path: `/api`

### `GET /api/health`
Liveness probe. Returns `{ status: "ok", statuses: [...] }`.

### `POST /api/leads`
```jsonc
// Request
{ "name": "Ada Lovelace", "email": "ada@example.com",
  "phone": "+91 98765 43210", "status": "new" }   // status optional, defaults to "new"

// 201 Created
{ "lead": { "id": "uuid", "name": "...", "email": "...",
            "phone": "...", "status": "new", "createdAt": "2026-09-26T..." } }
```
- `400` — validation failed, with `error.details` keyed by field name
- `409` — a lead with that email already exists

Email is lowercased and all string fields are trimmed before storage.

### `GET /api/leads`
| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `search` | string | — | Case-insensitive match on name, email or phone |
| `status` | enum | — | Filter to one status |
| `page` | int ≥ 1 | `1` | |
| `pageSize` | int 1–100 | `20` | Capped to prevent unbounded reads |
| `sort` | `createdAt` \| `name` | `createdAt` | Whitelisted — not interpolated from raw input |
| `order` | `asc` \| `desc` | `desc` | |

Returns `{ leads, total, page, pageSize }` where `total` is the count
**before** pagination.

### `GET /api/leads/:id`
Returns `{ lead }`, or `404` if not found, `400` if the id is not a UUID.

### `PATCH /api/leads/:id/status`
```jsonc
{ "status": "contacted" }
```
Returns the updated `{ lead }`. `400` on an invalid status or malformed id,
`404` if no such lead.

---

## Setup

### Prerequisites

- Node.js 20+ (built and tested on 22.20.0)
- A PostgreSQL database — or skip it, see below

### Run without a database (fastest)

```bash
npm install
npm run build
USE_IN_MEMORY_DB=true SERVE_CLIENT=true npm start
```

Open <http://localhost:3000>. Data lives in memory and disappears on restart.
Useful for a quick look; this mode is refused when `NODE_ENV=production`.

On Windows PowerShell, set the variables first:

```powershell
$env:USE_IN_MEMORY_DB="true"; $env:SERVE_CLIENT="true"; npm start
```

### Run with Postgres and hot reload

```bash
npm install
cp .env.example .env     # then edit DATABASE_URL
npm run dev
```

- API: <http://localhost:3000>
- App: <http://localhost:5173> (proxies `/api` to the API)

The schema is created automatically on first boot — no migration step.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes¹ | — | Postgres connection string |
| `PORT` | no | `3000` | Injected automatically by Render |
| `NODE_ENV` | no | `development` | `production` enables static serving |
| `USE_IN_MEMORY_DB` | no | `false` | Run without Postgres (non-production only) |
| `SERVE_CLIENT` | no | follows `NODE_ENV` | Force static serving on or off |

¹ Not required when `USE_IN_MEMORY_DB=true`.

---

## Testing

```bash
npm test          # 25 integration tests, no database needed
npm run typecheck # strict tsc across both workspaces
```

The suite covers creation and status defaulting, input normalisation, every
validation branch (missing name, malformed email, non-numeric phone, unknown
status, oversized `pageSize`), duplicate-email conflicts, search across all
three fields, status filtering, pagination totals, sorting, and the
400-vs-404 distinction for lead ids.

**Not covered:** the Postgres repository itself. Its SQL is exercised manually
and in deployment, but the in-memory double means the query layer has no
automated test. See [Future improvements](#future-improvements).

---

## Deployment

Deployed as a **single Render web service** that serves both the API and the
React bundle.

### 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string — it looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.

No schema setup is needed; the server creates the table on first boot.

### 2. Push the repository to GitHub

```bash
git remote add origin https://github.com/<you>/lead-tracker.git
git push -u origin main
```

### 3. Create the Render service

1. At [render.com](https://render.com), choose **New → Blueprint** and select
   the repository. Render reads `render.yaml`.
2. When prompted for `DATABASE_URL`, paste the Neon connection string.
3. Deploy.

Without the blueprint, create a **Web Service** manually with:

| Setting | Value |
| --- | --- |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Env vars | `NODE_ENV=production`, `DATABASE_URL=<neon string>` |

### 4. Verify

```bash
curl https://<your-service>.onrender.com/api/health
```

Then add the live URL to the top of this README.

> **Note on the free tier:** Render spins a free service down after ~15
> minutes of inactivity, so the first request after an idle period takes
> 30–60 seconds. This is a hosting-plan characteristic, not an application
> bug.

---

## Trade-offs

Decisions made deliberately, with what they cost.

**Schema bootstrap instead of a migration tool.**
`migrate()` runs `CREATE TABLE IF NOT EXISTS` on every boot. For one table
this keeps deployment to a single step. It does not handle destructive schema
changes — a second table or a column rename would justify node-pg-migrate.

**Types duplicated between client and server.**
`client/src/types.ts` mirrors `server/src/domain.ts` by hand. A shared
workspace would guarantee they stay in sync, but adds a third package and a
build step to every deploy for roughly thirty lines. At this size the
duplication is cheaper than the wiring; past two or three consumers that flips.

**`ILIKE '%term%'` for search.**
Simple, correct, and index-ineligible — Postgres scans the table. Fine for
thousands of rows, not for millions. The fix is a `pg_trgm` GIN index or a
`tsvector` column, which is a five-line migration once it is actually needed.

**`rejectUnauthorized: false` on remote database TLS.**
Connections are still encrypted, but the certificate chain is not verified,
which leaves a theoretical MITM window. Hosted Postgres providers use chains
that are not always in a container's trust store, and debugging that against a
deadline was not a good trade. The correct fix is pinning the provider's CA
certificate.

**No authentication.**
The brief did not ask for it, so anyone with the URL can read and write leads.
This is the single biggest gap between this and something deployable for real.

**Status transitions are unconstrained.**
Any status can move to any other — a `converted` lead can go back to `new`.
Without a stated sales process, inventing a state machine seemed more likely
to be wrong than useful.

**Re-fetch after create instead of local insertion.**
Creating a lead triggers a full list refresh rather than splicing the new row
into state. One extra request, but it is always correct: the new lead may not
belong on the current page under the active search, filter and sort.

---

## Future improvements

Roughly in the order I would actually do them.

1. **Authentication and per-user lead ownership.** Sessions or JWT, and a
   `user_id` on `leads`. Everything else is secondary to this.
2. **Postgres repository tests** against a real database in CI —
   Testcontainers, or a service container in GitHub Actions. This is the
   known hole in the current suite.
3. **Frontend component tests** with Testing Library — the form validation and
   the search-debounce behaviour are the parts most likely to regress.
4. **CI pipeline** running typecheck, tests and build on every push.
5. **Edit and delete leads.** Only creation and status updates exist today.
6. **Rate limiting** on writes — trivial to add with `express-rate-limit`, and
   necessary the moment this is public and unauthenticated.
7. **Structured logging** (pino) with request ids, replacing `console.log`.
8. **Notes and activity history per lead**, which is where a lead tracker
   starts being genuinely useful versus a spreadsheet.
9. **Full-text search** via `pg_trgm`, once the row count justifies it.
10. **Optimistic UI** for status changes, with rollback on failure.

---

## AI usage

Built with AI assistance. See [AGENT.md](./AGENT.md) for tools, prompts,
which parts were generated versus directed, and the reasoning behind the key
engineering decisions.
