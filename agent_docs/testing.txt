# Testing Strategy

*(Source: `TechDesign-Parking-Management-MVP.md` §23-24. No strict percentage-coverage target is defined — for a portfolio MVP, the bar is that every critical case below has a test, not hitting an arbitrary coverage number.)*

## Frameworks
- **Unit Tests:** Vitest
- **Integration Tests:** Vitest against a real Postgres instance (local or test Supabase project) — not mocked, so the integrity constraints (partial unique indexes, RLS) are actually exercised.
- **E2E Tests:** Playwright

## Rules & Requirements
- **Coverage:** No arbitrary percentage target. All critical cases listed below must have an automated test or a documented manual verification.
- **Before Commit:** Run the relevant test suite locally before every PR; CI (GitHub Actions) runs `test` and `build` on every push to `main`.
- **Failures:** NEVER skip tests or mock out assertions to make a pipeline pass without human approval. If an agent breaks a test, the agent must fix it.

## Test Types & What They Cover
- **Unit:** `domain/pricing.ts` (all cases below), state-transition validation functions, other pure `domain/` functions.
- **Integration:** full entry → exit → payment → session-close flow against a real Postgres database, verifying that the database-level constraints actually hold.
- **Security:** verifying an `operator`-role user cannot execute Admin-only actions — checked both at the Route Handler level and directly against RLS at the database level.
- **Concurrency:** tests that fire two simultaneous requests for the same spot / same vehicle and verify exactly one succeeds.
- **End-to-End:** login → register entry → view active session → register exit → pay → view generated receipt (the one must-have happy path).

## Critical Test Cases

**Pricing (`domain/pricing.ts`)**
- 0 minutes → 1 hour billed (minimum-charge rule, BR-014).
- 1 minute → 1 hour billed.
- Exactly 60 minutes → 1 hour billed.
- 61 minutes → 2 hours billed.
- Long stay (e.g. 30 hours) → 30 hours billed, no daily cap.

**Integrity**
- Two simultaneous attempts to create an active session for the same vehicle → one succeeds, the other fails with `409`.
- Two simultaneous attempts to assign the same spot → one succeeds, the other fails with `409`.

**Security**
- Operator attempts to modify a rate → `403`.
- Operator attempts to configure the parking lot → `403`.
- Unauthenticated user attempts any protected operation → `401`.

**State**
- `active → completed` only occurs if the associated payment reaches `paid` in the same transaction.
- `active → pending_payment` when payment isn't completed at exit time.
- `pending_payment → completed` when payment is completed later.
- `completed` accepts no further `UPDATE` — verified in both the Route Handler and RLS.

**Concurrency**
- Two simultaneous assignments on the same spot → one wins deterministically, the other fails with a clear frontend message (no raw SQL error surfaced).

## Execution
- Command to run all tests: **pending decision** — exact `package.json` script names (`npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, etc.) are not specified in the Technical Design; define them during Phase 0 project setup and update `AGENTS.md` → Setup & Commands accordingly.
- Command to run a single test file: **pending decision**, same reason as above (Vitest/Playwright default single-file invocation applies once scripts are defined).