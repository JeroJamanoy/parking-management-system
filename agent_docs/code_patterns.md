# Code Patterns

## Purpose
This file defines the implementation patterns the agent should follow for this project.
Prefer these patterns over inventing new ones. Sourced from `TechDesign-Parking-Management-MVP.md`.

## Architecture Pattern
- **Primary pattern:** Layered by responsibility — `domain/` (pure business logic, no Next.js or Supabase dependencies, directly unit-testable), `data/` (the only layer that knows Supabase — clients and queries), `app/api/` (Route Handlers: orchestrate authentication, authorization, validation, calls into `domain/`/`data/`, and the HTTP response).
- **Rule:** Route/UI layers handle request/response and rendering ONLY. Business logic (pricing, state transitions, authorization rules) lives in `domain/`. No direct database calls from route handlers or components — always through `data/`.
- **Rule:** No empty folders or abstraction layers ("generic repositories," class-based "use cases") that don't earn their complexity at this project's size — do not add them speculatively.
- **Rule:** Reuse existing modules before creating new abstractions.

## Project Structure
app/
├── (auth)/login/
├── (protected)/
│ ├── dashboard/
│ ├── spots/ # grid + spot configuration
│ ├── entry/ # register vehicle entry
│ ├── sessions/ # active sessions / exit
│ ├── history/
│ ├── rates/ # admin only
│ ├── users/ # admin only
│ └── audit/ # admin only
└── api/
├── parking-lot/, spots/, rates/, sessions/, receipts/, history/, dashboard/, audit/
domain/ # pure business logic
├── pricing.ts # hours/cost calculation (BR-006, BR-014)
├── session-transitions.ts # valid state-transition validation
└── authorization.ts # role rules (Authorization matrix below)
data/ # Supabase access layer
├── supabase-client.ts, spots.ts, sessions.ts, rates.ts, audit.ts
components/
├── ui/ # shadcn/ui, generic
└── domain/ # SpotGrid, SessionCard, ReceiptView, DashboardMetrics
lib/
├── validation/ # Zod schemas per endpoint
└── auth/ # session/middleware helpers
supabase/migrations/ # versioned SQL migrations


## Data Fetching
- **Primary approach:** Route Handlers (`app/api/.../route.ts`) for every operation that calculates money or changes state (entry, exit, payment, configuration). Data reads for pages use server-loaded data where practical; Supabase Realtime subscriptions are used only for the spot grid and active-sessions list (see below).
- **Rule:** Do not introduce a query library (React Query, SWR, etc.) unless a real need appears — the MVP's data-fetching needs are met by Route Handlers + Realtime + refetch-on-navigate.
- **Rule:** Keep fetch logic out of render functions; call it from a loader/effect/handler.

## State Management
- **Server state:** Supabase is the source of truth. The spot grid and active-sessions list subscribe to **Supabase Realtime**; the dashboard and history use manual/periodic refetch (e.g. every 30–60s for the dashboard), not Realtime — this asymmetry is deliberate (see Realtime section below).
- **Client state:** React's built-in state (`useState`/`useReducer`) — no external client-state library introduced for MVP scope.
- **Forms:** React Hook Form + Zod for validation; the client validates for immediate UX feedback, but the server always re-validates as the source of truth.
- **Rule:** Prefer the simplest working approach for MVP scope. Do not add a state library if React's built-in state is sufficient.

## Database Integrity — do not simplify these
| Rule | Mechanism | Why |
|---|---|---|
| One active session per vehicle | Partial unique index `one_active_session_per_vehicle` on `parking_sessions(vehicle_id) WHERE status = 'active'` | Engine rejects the second concurrent insert atomically — no read-then-write race window. |
| One active session per spot | Partial unique index `one_active_session_per_spot` on `parking_sessions(spot_id) WHERE status = 'active'` | Same reasoning. |
| `completed` requires `paid` payment | Single transaction updates `payments.status = 'paid'` and `parking_sessions.status = 'completed'` together — both or neither commit | Postgres has no simple cross-table `CHECK`; atomicity is enforced by the transaction boundary. |
| No edits after `completed`/`cancelled` | Route Handler rejects the transition + RLS `UPDATE` policy requires `status IN ('active','pending_payment')` on the target row | Double layer: even direct DB access under RLS can't edit a protected row. |
| `out_of_service` spot can't get a new session | Application logic in the entry Route Handler (`spot.status = 'available'` check before insert) | Depends on other business rules (vehicle-type compatibility) — clearer as explicit application logic than a SQL constraint. |
| Rate never changes retroactively | Duplicated snapshot: `rate_snapshot_id` **and** `rate_snapshot_price` stored on the session at creation time | Immune even to future changes in how `rates` rows are edited. |

**Never replace the two partial unique indexes with an application-only "check availability, then insert" pattern** — that reintroduces the exact race condition they exist to prevent. **Never add triggers** for these rules — nothing here needs cascading trigger behavior that an explicit transaction doesn't already solve, and triggers are harder to test/debug/explain.

## Concurrency Pattern
When two requests race for the same spot/vehicle: each opens its own transaction and attempts the insert; the partial unique index is evaluated by the engine at commit — the first to commit succeeds, the second gets a `23505` violation. The Route Handler catches that specific error code and responds `409 Conflict` with a business-level message (never the raw SQL error). The frontend refreshes the grid (via Realtime or refetch) on `409`. The same "let the constraint decide, catch the specific violation" pattern applies to duplicate payments (`UNIQUE(session_id)` on `payments`) and to competing exit requests (`SELECT ... FOR UPDATE` on the session row).

## Error Handling
- Normalize errors at the Route Handler boundary — never let raw exceptions or SQL error codes reach the UI.
- Never swallow errors silently; log server-side, surface a safe message to the user.
- Standard mapping: `401` not authenticated · `403` role not authorized · `404` no compatible resource (e.g. no rate configured) · `409` conflict/invalid transition/concurrent race lost · `500` unexpected — generic message, no stack traces, table names, or infra details.
- `pending_payment` (incomplete payment at exit) is **not** an error — it's a valid `200` flow outcome.

## Validation
- Validate all external inputs (forms, API payloads) with **Zod** schemas colocated in `lib/validation/`, one schema per endpoint/contract.
- Apply runtime validation at Route Handler boundaries; trust internal types inside `domain/`/`data/`.
- The server is always the final source of truth — client-side validation is UX only, never a substitute.

## Authorization
- **Two layers, always:** (1) Route Handler checks the authenticated user's role before executing any logic; (2) RLS policy re-checks the same rule at the database row level, as a safety net even if a Route Handler has a bug.
- **Matrix:**

| Action | Admin | Operator |
|---|---|---|
| Configure parking lot | ✅ | ❌ |
| Create/edit/remove spots | ✅ | ❌ |
| Mark spot `out_of_service`/`available` | ✅ | ✅ |
| Configure rates | ✅ | ❌ |
| Manage users | ✅ | ❌ |
| Register entry / exit / payment | ✅ | ✅ |
| Cancel `active` session with no payment | ✅ | ✅ |
| Cancel a session with an associated payment | ❌ (no path exists) | ❌ |
| View history / dashboard | ✅ | ✅ |
| View audit log | ✅ | ❌ |

- The client (browser) never uses the `service_role` key — only the `anon` key, subject to RLS. Bypassing RLS (e.g. dashboard aggregations) happens exclusively in server-side Route Handlers.

## File and Naming Conventions
- **Files:** kebab-case for route/data/lib files (`pricing.ts`, `session-transitions.ts`), matching Next.js App Router conventions.
- **Components / classes:** PascalCase (`SpotGrid`, `SessionCard`).
- **Functions / variables:** camelCase.
- **Constants / env vars:** UPPER_SNAKE_CASE.
- **Audit action names:** `entity.action` pattern (e.g. `rate.create`, `spot.status_change`, `session.cancel`, `user.deactivate`).

## UI Component Conventions
- Generic UI (`Button`, `Badge`, `Table` from shadcn/ui) kept separate from domain components (`SpotGrid`, `SessionCard`, `ReceiptView`, `DashboardMetrics`).
- Every data view (grid, history, dashboard) must explicitly implement its three states: `loading` (skeleton), `error` (message + retry), `empty` (contextual message).
- Mobile-first for operational screens (entry/exit/sessions — frequently used from tablet/phone at the access point); dashboard may assume desktop as the primary case.
- Grid status must never rely on color alone — pair with text/icon.

## Testing Pattern
- Unit tests for `domain/` pure functions (pricing, state transitions).
- Integration tests for API contracts and critical data flows against a real Postgres instance, verifying the integrity constraints above actually hold.
- E2E tests only for the top user journey the PRD marks must-have: login → register entry → view active session → register exit → pay → view generated receipt.
- Run the relevant test suite after every feature; fix failures before moving on.

## Change Discipline
- Prefer focused, minimal edits over large rewrites.
- Do not introduce new dependencies without checking `agent_docs/tech_stack.md` first.
- Do not change database migrations, RLS policies, or auth flows without explicit approval.
- One feature at a time — commit or checkpoint after each working feature, following the phase order in `AGENTS.md`.