# AGENTS.md — Master Plan for Parking Management System

<!--
Single source of truth for every AI coding assistant on this project.
Keep it lean — details live in the Context Files at the bottom. Update Current State and Roadmap as you build.
-->

## Project Overview & Stack
**App:** Parking Management System (MVP)
**Overview:** Web application to operate a single-lot parking facility. Lets an Admin or Operator configure spots, view real-time availability, register vehicle entries/exits, automatically calculate stay duration and cost, log payments, review history, and issue an internal demo receipt (not a legally valid invoice). Portfolio project for a Systems Engineering degree — quality bar: explainable in a technical interview.
**Stack:** Next.js (App Router) + TypeScript, Supabase (Postgres, Auth, Row Level Security, Realtime), Tailwind CSS + shadcn/ui, Zod, Vitest + React Testing Library, Playwright, deployed on Vercel.
**Critical Constraints:**
- Monolith only — no microservices, no separate backend service, no Docker/Kubernetes/Redis unless explicitly justified in `TechDesign-Parking-Management-MVP.md`.
- Supabase is the final decision for data/auth/authorization — never substitute Firebase.
- Every financial calculation (hours billed, total amount) is computed **server-side only**, in a Route Handler — the client is never a source of truth for money.
- `SUPABASE_SERVICE_ROLE_KEY` must never reach the client bundle.
- Strict TypeScript, `any` forbidden.
- Mobile-first for operational screens (entry/exit/sessions); dashboard can assume desktop as primary.

## Setup & Commands
Execute these commands for standard development workflows. Do not invent new package manager commands.
- **Setup:** `npm install` (then `cp .env.example .env.local` and fill in Supabase project keys)
- **Development:** `npm run dev`
- **Testing:** `npm test` *(exact Vitest/Playwright script names to be finalized in `package.json` during Phase 0 — see `agent_docs/testing.md`)*
- **Linting & Formatting:** `npm run lint` (ESLint + Prettier, standard Next.js config)
- **Build:** `npm run build`
- **Database migrations:** applied via the Supabase CLI (`supabase db push` or equivalent) — never edited manually in the production dashboard.

## Protected Areas 🛡️
Do NOT modify these without explicit human approval:
- **Secrets:** NEVER commit `.env.local` or hardcode API keys, tokens, or passwords. `SUPABASE_SERVICE_ROLE_KEY` lives only in server-side environment variables (Vercel), never in `NEXT_PUBLIC_*`.
- **Database Migrations:** Existing files in `supabase/migrations/`. New migrations are additive; never edit or delete an applied migration.
- **Row Level Security policies:** RLS is the second authorization layer (alongside Route Handler checks) — do not weaken or disable a policy to "make something work."
- **Third-Party Integrations:** Supabase Auth configuration.
- **Core integrity mechanisms:** the partial unique indexes `one_active_session_per_vehicle` and `one_active_session_per_spot`, and the `rate_snapshot_id` + `rate_snapshot_price` duplication pattern. Do not replace these with "read-then-write" application-only checks (see `agent_docs/code_patterns.md`).
- **Infrastructure:** this project intentionally has no `infrastructure/` directory, Dockerfiles, or custom deploy workflows — do not add any.

## Coding Conventions
- **Formatting:** ESLint + Prettier, standard Next.js config — no warnings in new code.
- **Architecture:** Layered by responsibility — `domain/` (pure business logic, no framework/DB dependencies), `data/` (the only layer that talks to Supabase), `app/api/` (Route Handlers: orchestrate auth, authorization, validation, domain calls, data calls, HTTP response). See `agent_docs/code_patterns.md`.
- **Testing:** All new utilities in `domain/` get unit tests. Core user flows (entry → exit → payment → receipt) get integration tests against a real Postgres instance. See `agent_docs/testing.md`.
- **Type Safety:** Use strict typing. Avoid `any`; define precise interfaces or use `unknown`. Validate all external input with Zod at the Route Handler boundary.

## How I Should Think 🧠
1. **Understand Intent First:** Identify what the user actually needs before answering.
2. **Ask If Unsure:** If critical information is missing, ask ONE specific question before proceeding.
3. **Plan Before Coding:** Propose a brief step-by-step plan and wait for approval before changing more than one file. (If your tool has a plan/reflect mode, use it.)
4. **Execute Incrementally:** Build one feature at a time, following the phase order in the Roadmap below. Prefer refactoring over rewriting large blocks.
5. **Verify After Changes:** Run tests/linters or manual checks after each logical change; fix failures before moving on (see `REVIEW-CHECKLIST.md`).
6. **Explain Trade-offs:** When recommending something, briefly mention alternatives — but do not reopen decisions already confirmed in `TechDesign-Parking-Management-MVP.md` without flagging it explicitly as a deviation.
7. **Remember in Files:** Write state and decisions to `MEMORY.md` instead of relying on chat history.
8. **Use Subagents If Available:** If your tool supports subagents or parallel agents, assign roles and require a plan before edits.

## What NOT To Do ⛔
- Do NOT delete files without explicit confirmation.
- Do NOT modify database schemas without a backup plan.
- Do NOT add features not in the current phase, and NEVER add anything listed as Out of Scope / No-Goals in `agent_docs/product_requirements.md` (e.g. real DIAN e-invoicing, multi-tenant, vehicle/owner CRM, real payment gateway, reservations, free-position X/Y layout) without explicit confirmation from the human.
- Do NOT skip tests for "simple" changes — pricing math and concurrency logic are exactly the kind of "simple" change that has broken this system before.
- Do NOT bypass failing tests or pre-commit hooks.
- Do NOT use deprecated libraries or patterns.
- Do NOT accept a monetary amount or calculated duration from the client as a source of truth — always recompute server-side.
- Do NOT edit a `completed` or `cancelled` `parking_session` — these are terminal states with no update path, enforced in both the Route Handler and RLS.

## Engineering Constraints 🏗️
- **Type Safety:** The `any` type is forbidden — use `unknown` with type guards. All function parameters and returns are typed. Validate external input with a runtime schema (Zod).
- **Architectural Sovereignty:** Route/UI layers handle request/response ONLY. Business logic lives in `domain/`. No direct Supabase calls from route handlers — always through `data/`.
- **Library Governance:** Check `package.json` before suggesting new dependencies. Prefer native APIs over libraries. Use the data-fetching approach specified in `agent_docs/tech_stack.md`.
- **Clear Communication:** State issues briefly and fix them — no apology loops or filler. If context is missing, ask ONE specific clarifying question.
- **Workflow Discipline:** Pre-commit hooks must pass before commits (or ask before bypassing). If verification fails, fix it before continuing.
- **Concurrency discipline:** any new endpoint touching `parking_sessions` or `parking_spots` must be checked against the integrity rules in `agent_docs/code_patterns.md` before merging.

## Current State 📍
**Last Updated:** 2026-08-17
**Working On:** Agent Documentation (Phase 4 of the vibe-coding-prompt-template workflow) — no application code written yet.
**Recently Completed:** Technical Design Document approved (`TechDesign-Parking-Management-MVP.md`), all Open Questions from the PRD resolved.
**Blocked By:** None — ready to begin Phase 0 (Project Setup) once this documentation is in place.

## Roadmap 🗺️
*(Numbered phases below map directly to the Implementation Plan, section 22 of `TechDesign-Parking-Management-MVP.md`.)*

### Phase 1: Foundation
- [ ] Phase 0 — Project setup: repo, Next.js, Supabase project + CLI + initial migrations, env vars, basic CI
- [ ] Phase 1 — Auth & roles: `users` table, Supabase Auth integration, protected-route middleware, base authorization matrix
- [ ] Phase 2 — Parking configuration: `parking_lots`, `parking_spots`, grid generation, basic RLS

### Phase 2: Core Features
- [ ] Phase 3 — Rates: `rates` table, configuration endpoint, "one active rate per vehicle type" logic
- [ ] Phase 4 — Vehicle entry: `vehicles`, `parking_sessions` creation, partial unique indexes, entry endpoint
- [ ] Phase 5 — Active sessions: active-sessions view, Realtime integration for the spot grid
- [ ] Phase 6 — Exit & pricing: `domain/pricing.ts`, exit-calculation endpoint, pricing unit tests
- [ ] Phase 7 — Payments: `payments`, close-with-payment endpoint, `pending_payment` flow
- [ ] Phase 8 — Receipt: `invoices`, receipt generation and view
- [ ] Phase 9 — Dashboard & history: aggregations, paginated history
- [ ] Phase 10 — Audit: `audit_logs`, instrumentation of sensitive actions

### Phase 3: Polish
- [ ] Phase 11 — Security hardening: full RLS review, verify no calculation trusts the client, authorization tests
- [ ] Error handling pass across all flows
- [ ] Mobile responsiveness pass on entry/exit/session screens
- [ ] Performance pass (only where a real bottleneck is measured — no speculative optimization)

### Phase 4: Launch
- [ ] Phase 12 — Testing & deployment: complete the testing pyramid (`agent_docs/testing.md`), production deploy
- [ ] Security pass (see `REVIEW-CHECKLIST.md`)
- [ ] Deploy to production (Vercel + Supabase, `agent_docs/tech_stack.md`)
- [ ] Launch checklist

## Context Files 📚
Load these only when needed — progressive disclosure keeps context lean:
- `agent_docs/tech_stack.md` — Stack details, libraries, setup commands
- `agent_docs/code_patterns.md` — Architecture and code style rules
- `agent_docs/project_brief.md` — Product vision and conventions
- `agent_docs/product_requirements.md` — Feature list and user stories
- `agent_docs/testing.md` — Test strategy and commands
- `MEMORY.md` — Session memory: decisions, known issues, active goal
- `REVIEW-CHECKLIST.md` — Definition of done before marking work complete
- `PRD-Parking-Management-MVP.md` / `TechDesign-Parking-Management-MVP.md` — full source-of-truth documents (product and technical), referenced but not duplicated in `agent_docs/`
- `specs/` — Feature specs and handoff notes created during the build