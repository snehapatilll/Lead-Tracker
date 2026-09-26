# AGENT.md

Documentation of AI tool usage in building this project, as required by the
assignment brief.

---

## Summary

I used Claude (via Claude Code) as an implementation tool under direction. I
made the architectural and technology decisions, set the constraints the
implementation had to satisfy, reviewed the output, and drove the debugging
when things broke. The AI wrote most of the code to that specification.

This document records who decided what, so the split is clear.

| Tool | Model | Role |
| --- | --- | --- |
| Claude Code (desktop) | Claude Opus 5 | Implementation, under my direction |

No other AI tools were used. No code was copied from tutorials, Stack Overflow,
or existing lead-tracker projects.

---

## Context

The project was rebuilt in a single session after my laptop failed mid-way
through the original attempt. Claude Code stores its session history locally
rather than in the account, so switching machines meant starting from the brief
again with the deadline unchanged.

That constraint drove a deliberate decision: keep the entire project in one
language and one deployable unit. Every choice below was filtered through
"what has the fewest moving parts that can break the night before a deadline."

---

## Decisions I made

These were mine. Where the AI presented options, I evaluated the trade-offs and
chose; where it proposed a design, I decided whether it earned its place.

**Backend stack — Node + Express + TypeScript.**
Options on the table were Express, FastAPI and NestJS. I chose Express with
TypeScript so the whole repository is one language and one toolchain, with the
frontend and backend sharing types and a single deploy. NestJS would have
signalled more architectural awareness, but its module/DI boilerplate is not
justified at four endpoints, and boilerplate is risk when time is short.

**Database and hosting — Neon Postgres on a single Render service.**
Postgres over MongoDB because leads have a natural unique constraint (email)
and the data is relational. I rejected a three-service split (Vercel + Render +
Neon) in favour of one Render service serving both the API and the built React
app: one URL, no CORS surface, no environment-specific API base URL to get
wrong, and one thing to debug instead of three.

**Scope — the brief, and nothing else.**
I explicitly held the feature set to create / list / search / update-status. No
auth, no CSV import, no dashboard. The extras I did allow — status filtering,
sorting, pagination, debounced search — are all in service of the four required
features rather than additions to them.

**The test suite must run without a database.**
This was the constraint that shaped the architecture. My reasoning: a reviewer
who clones the repository and runs `npm test` without a live Postgres must see
it pass, or the tests are decorative. When the AI's first instinct was to call
`pg` directly from the route handlers, I rejected that and required a seam
between the HTTP layer and storage. That produced the `LeadRepository`
interface with two implementations.

**Documentation must state real costs, not just choices.**
I required the README's trade-offs section to say what each decision gives up,
and required the test section to name what is *not* covered. A trade-offs
section that only lists benefits is marketing, not engineering.

**Production safety over convenience.**
When the no-database mode was proposed as a plain convenience flag, I required
it be refused under `NODE_ENV=production`. A deployment that silently loses
every lead on restart is worse than one that fails loudly at boot.

---

## What the AI produced

To my specification, and reviewed by me:

- `server/src/**` — domain types, zod schemas, repositories, routes, app wiring
- `client/src/**` — API client, `useLeads` hook, components, styling
- `server/tests/leads.test.ts` — the 25-test suite
- `README.md`, `render.yaml`, seed script
- Environment setup, including recovering from a failed Node installer

---

## Problems I caught or drove to resolution

The output was reviewed, not accepted on trust. These are the things that did
not work first time.

**Invalid JSX in `LeadForm.tsx`.**
A stray token was emitted into the middle of an attribute list — syntactically
invalid, would have failed the build. Caught before it was committed.

**Swallowed `AbortError` in the API client.**
The first version rewrote every `fetch` rejection as "Could not reach the
server", including the `AbortError` thrown deliberately when a superseded
search request is cancelled. Typing quickly in the search box would have
flashed a phantom network error. Fixed by re-throwing `AbortError` untouched.

**`dotenv` reading the wrong directory.**
`DATABASE_URL` came back undefined for `npm run seed` and `npm run dev`. Root
cause: npm runs workspace scripts with the cwd set to the workspace directory,
so dotenv's default lookup checked `server/.env` and silently missed the `.env`
at the repository root. Fixed with an explicit env module.

**TLS verification weakened by default.**
The database connection initially used `rejectUnauthorized: false`. I required
this be tested rather than assumed — full chain verification works fine against
Neon, so the workaround was removed and strict verification became the default,
with an opt-in escape hatch for providers that need it.

**The Render deployment failed.**
The build died with ~90 TypeScript errors: `Could not find a declaration file
for module 'react'`. I pulled the build log and diagnosed it from the evidence
— `react` had installed but `@types/react` had not, meaning Render's build
environment omits devDependencies. Notably this does not reproduce locally,
where npm installs devDependencies regardless of `NODE_ENV`, so the local
environment was actively misleading. Fixed with `--include=dev`.

**Layout regression.**
The table overflowed horizontally on a normal screen because the page container
was capped at 1180px, leaving roughly 800px for five columns once the sidebar
was subtracted. I identified the symptom and required the fix be verified at
multiple viewport widths rather than eyeballed.

---

## Engineering decisions worth recording

**Repository interface between routes and storage.**
`routes/leads.ts` depends on a `LeadRepository` interface, never on `pg`. Two
implementations exist: Postgres for real use, in-memory for tests. This is what
allows the 25 tests to exercise the real Express stack — routing, validation,
serialisation, error handling — with no database process. The known cost is
that the Postgres implementation itself has no automated test; it is verified
manually and documented as the top gap in the README.

**Single deployable unit.**
Express serves `client/dist` in production. One build, one URL, no CORS. Vite's
dev proxy preserves hot reload locally. The cost — frontend and backend cannot
scale independently — is irrelevant at this size.

**One source of truth for the status vocabulary.**
`LEAD_STATUSES` is declared once in `domain.ts` and drives the zod enum, the
Postgres `CHECK` constraint and the client dropdown. Adding a status is one
line plus a migration.

**Errors that do not leak.**
Only `ApiError` instances are rendered to the client. Everything else is logged
server-side and returned as a generic 500, so driver messages and connection
strings never reach a response body.

**Sort columns whitelisted, not interpolated.**
Column names cannot be parameterised in SQL, so `sort` maps through a `Record`
rather than being concatenated into the query. Everything else uses bound
parameters.

**Pagination total in one round trip.**
`COUNT(*) OVER()` returns the pre-pagination total alongside the page.

**Debounced search with cancellation.**
300ms debounce plus an `AbortController` per request: a fast typist issues one
request rather than one per keystroke, and a slow earlier response cannot
overwrite a newer one.

---

## Assessment

Used this way, AI is a fast implementer and an unreliable reviewer of its own
work. It produced working code quickly, and it also produced invalid JSX, an
error-handling bug that would have surfaced intermittently in production, and a
silent configuration failure — none of which it flagged.

The parts that determined whether this project succeeded were the decisions:
what to build, what stack, what constraints the implementation had to satisfy,
what "done" means, and whether each piece of output was actually correct. The
no-database testing constraint in particular changed the entire architecture,
and it came from deciding what a reviewer would experience, not from the code.
