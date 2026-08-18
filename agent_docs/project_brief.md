# Project Brief

- **Product vision:** A simple, reliable operating system for a single-lot parking facility, where any staff member (Admin or Operator) can see the real state of the spots, register a complete stay without ambiguity, and trust that the amount charged is always correct and verifiable.
- **Target Audience:** Operating staff of a small-to-medium parking lot — the owner/administrator (Admin role) and shift staff who receive and release vehicles (Operator role).

## Problem & Solution
A small parking lot operating manually (notebook, spreadsheet, mental math) has no reliable real-time control of spot occupancy, is prone to rate-calculation errors, leaves no auditable trail of who charged what, and can't consistently prove what a customer owes. This system solves that by centralizing parking-lot state and automating the charge calculation. (PRD §2)

## Scope (MVP)
Single parking lot, two roles (Admin, Operator), grid-based spot layout (rows × columns), entry/exit/payment operation with an internal demo receipt. See `agent_docs/product_requirements.md` for the full MoSCoW breakdown and `PRD-Parking-Management-MVP.md` for the complete source document.

**Explicitly out of scope for this version:** legally valid DIAN electronic invoicing, multi-lot/multi-tenant, vehicle/owner CRM, real payment gateways, reservations, free-position (X/Y) layout, notifications, automatic license-plate recognition.

## Conventions
- **Naming:** kebab-case for route/data/lib files; PascalCase for components; camelCase for functions/variables; UPPER_SNAKE_CASE for constants/env vars. See `agent_docs/code_patterns.md`.
- **File Structure:** `domain/` (pure business logic) separate from `data/` (Supabase access) separate from `app/api/` (Route Handlers as orchestration). No colocated tests convention specified beyond `tests/unit/`, `tests/integration/`, `tests/e2e/` (see `agent_docs/testing.md`). See `agent_docs/code_patterns.md` for the full project structure.

## Key Principles
- Ship the simplest possible solution that solves the user story — no speculative abstractions, no state library or caching layer without a real, measured need.
- Prefer a pre-built integration over a custom one when it exists and fits (e.g. Supabase Auth's built-in password-reset flow instead of a custom one).
- Priority order for every technical decision: **Correctness > Security > Simplicity > Maintainability > Scalability > Complexity.** (TechDesign, opening statement)
- The frontend is never a source of truth. Everything involving money or a critical state change is recalculated and revalidated server-side, regardless of what the client computed or displayed. (TechDesign §9)
- Portfolio-quality bar: the project should demonstrate good engineering practice, security awareness, database design, and justified technical decision-making — not just "working software." (TechDesign, project level)

