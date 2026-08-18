# Artifact Review Checklist 🔍

> **AGENTS:** Do not mark a feature or task as "Complete" until you verify these checks manually or via automated test runs. Provide terminal logs or browser testing results as proof.
> **HUMANS:** Use this checklist before merging Agent-generated code.

## Functionality & PRD Scope
- [ ] The feature matches its Functional Requirement / User Story / Acceptance Criteria in `agent_docs/product_requirements.md` — no reinterpretation of scope.
- [ ] Nothing from the Out-of-Scope / No-Goals list was implemented (real DIAN e-invoicing, multi-tenant, vehicle/owner CRM, real payment gateway, reservations, free-position layout, etc.).
- [ ] Any deviation from the PRD or Technical Design discovered during implementation was flagged and confirmed explicitly, not resolved silently in code.

## Code Quality & Safety
- [ ] No `any` types used (or strictly justified with `unknown` and type guards).
- [ ] Protected files/directories (migrations, RLS policies, `.env*`) were NOT modified without permission.
- [ ] No existing, unrelated tests were deleted or skipped.
- [ ] Component/Function is modular and respects the `domain/` / `data/` / `app/api/` boundaries — no direct Supabase calls from a route handler, no business logic in a UI component.

## Security & Authorization 🔐
- [ ] No hardcoded secrets, API keys, or tokens anywhere in the diff.
- [ ] `.env.local` (and any other secret files) are gitignored and were NOT committed.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never referenced outside a server-side Route Handler and never appears in a `NEXT_PUBLIC_*` variable.
- [ ] All user input is validated with Zod at the boundary (forms, API payloads, URL params).
- [ ] Role checks are enforced in the Route Handler **and** RLS is enabled and correct for the affected table (double layer, per `agent_docs/code_patterns.md` §Authorization).
- [ ] Auth-protected routes and actions were tested while logged out (`401`) and while logged in as the wrong role (`403`).
- [ ] Dependencies audited (`npm audit` or equivalent) — no unaddressed high-severity findings.

## Financial Calculations & Concurrency
- [ ] No monetary amount or billed duration is ever accepted from the client — every price/hours calculation happens server-side, from `entry_time`/`exit_time`/`rate_snapshot_price`.
- [ ] Pricing edge cases pass: 0 min, 1 min, exactly 60 min, 61 min, and a long (multi-day) stay — all against `ceil(minutes/60)` with a 1-hour minimum.
- [ ] Any endpoint touching `parking_sessions` or `parking_spots` was checked against the two partial unique indexes (`one_active_session_per_vehicle`, `one_active_session_per_spot`) and does not reintroduce a "read then write" race condition.
- [ ] Concurrent double-booking (same spot or same vehicle) was tested: exactly one request succeeds, the other fails with `409` and a clean user-facing message.
- [ ] `parking_sessions.status = 'completed'` and `'cancelled'` are verified immutable — no UI or API path allows editing them, checked at both Route Handler and RLS.
- [ ] A `parking_session` reaching `completed` always has an associated `payments` row with `status = 'paid'`, written in the same transaction.

## Execution & Testing
- [ ] Application compiles without fatal errors.
- [ ] Linter passes (`npm run lint`).
- [ ] Type check passes (`tsc --noEmit`).
- [ ] Related unit tests pass (especially `domain/pricing.ts` and state-transition logic).
- [ ] Related integration tests pass against a real Postgres instance.
- [ ] UI is decently responsive across Desktop and Mobile viewports, with special attention to the entry/exit/session screens (mobile-first per Technical Design).
- [ ] Every data view (grid, history, dashboard) explicitly handles its `loading`, `error`, and `empty` states.

## Artifact Handoff
- [ ] `MEMORY.md` was updated with any new architectural decisions made during this task.
- [ ] Any obsolete spec files in the workspace have been marked as resolved or archived.