# System Memory & Context 🧠
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## 🏗️ Active Phase & Goal
**Current Task:** Phase 1 — Auth & roles.
**Next Steps:**
1. Manually verify login, logout and protected-route behaviour against the existing Supabase Admin profile.
2. Add an Operator test account before implementing Admin-only operations in Phase 2/3.
3. Implement Phase 2 — Parking configuration only after the Phase 1 manual verification passes.

## 📂 Architectural Decisions
*(Log specific choices made during the build here so future agents respect them. Carried over from the Technical Design — logged into this file on 2026-08-17.)*
- 2026-08-17 — Chose **Supabase (Postgres) over Firebase**: the domain (parking sessions/spots) needs relational integrity and atomic uniqueness under concurrency, which Postgres partial unique indexes provide natively; Firestore would require reimplementing that by hand. (TechDesign §3)
- 2026-08-17 — Chose **Next.js App Router over React + Vite**: Route Handlers give a trusted server-side place to compute pricing without standing up a separate backend service. (TechDesign §4)
- 2026-08-17 — **No triggers** for integrity rules — partial unique indexes + explicit transactions in Route Handlers are used instead, because they're easier to test and explain, and no rule in the PRD needs cascading trigger behavior. (TechDesign §7)
- 2026-08-17 — **Rate freezing implemented as a duplicated snapshot** (`rate_snapshot_id` + `rate_snapshot_price`), not just a foreign key, so historical sessions are immune even to future changes in how `rates` is edited. (TechDesign §6.6.1)
- 2026-08-17 — **Realtime limited to the spot grid and active-sessions list**; dashboard and history use plain refetch/polling — Realtime everywhere would add complexity with no perceptible benefit. (TechDesign §17)
- 2026-08-17 — **Session cancellation** (`active → cancelled`) allowed for both Admin and Operator, but only if the session has no associated payment row; no path exists to cancel/void a `completed` session in the MVP. (TechDesign, Open Questions resolution)
- 2026-08-18 — Phase 0 created the initial, versioned Supabase migration for all nine tables, their documented constraints and indexes, plus RLS. RLS role checks use narrowly scoped `SECURITY DEFINER` helpers in the private schema to avoid recursive policy lookups; no triggers were introduced.
 2026-08-18 — Phase 1 uses the authenticated user's cookie-backed Supabase session for login, profile lookup and RLS. The protected layout verifies JWT claims, then reads public.users; it rejects missing or inactive profiles. The service role client is intentionally deferred until an Admin-only user-management endpoint exists.

## 🐛 Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- Supabase free-tier automatic backups have limited retention — accepted as a known limitation for a portfolio project, not a build blocker. Must be mentioned explicitly if this project is ever presented as "production-ready." (TechDesign §21, §25)
- `rates` does not yet have a `parking_lot_id` column, unlike `parking_spots` which is partially prepared for multi-lot. This is deliberate technical debt for a possible future multi-parking-lot feature — not an oversight. Do not "fix" it without confirming scope first, since multi-tenant is explicitly Out of Scope for the MVP. (TechDesign §21)

## 📜 Completed Phases
*(Workflow-level phases, not build phases — see AGENTS.md Roadmap for build phases.)*
- [x] Research — COMPLETED (`research-Parking-Management.md`)
- [x] PRD — COMPLETED (`PRD-Parking-Management-MVP.md`)
- [x] Technical Design — COMPLETED (`TechDesign-Parking-Management-MVP.md`)
- [ ] Agent Documentation — CURRENT PHASE (this file and its siblings)
- [ ] Build — NOT STARTED (next: Phase 0 — Project Setup, see AGENTS.md Roadmap)
