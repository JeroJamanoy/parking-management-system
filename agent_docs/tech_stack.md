# Tech Stack & Tools

- **Frontend:** Next.js (App Router) + TypeScript. Chosen over React + Vite specifically because Route Handlers provide a trusted server-side place to compute pricing without a separate backend service (TechDesign §4). Exact Next.js version: **pending decision** — not specified in the Technical Design; confirm during Phase 0 setup.
- **Backend:** No separate backend service — Next.js Route Handlers (`app/api/.../route.ts`) are the only entry point for operations that calculate money or change state. Server Actions are avoided beyond simple forms; Route Handlers are preferred as explicit, testable API contracts.
- **Database:** Supabase (PostgreSQL) with Row Level Security. Chosen over Firebase/Firestore because the domain is intrinsically relational and the critical integrity rules (one active session per vehicle/spot) map directly to Postgres partial unique indexes, evaluated atomically by the engine (TechDesign §3). No ORM specified beyond the Supabase client + generated TypeScript types (`supabase gen types`).
- **Authentication:** Supabase Auth — email + password (no social OAuth needed for an internal two-role system). Session via JWT in HTTP-only cookies through `@supabase/ssr`, with automatic refresh. Password recovery uses Supabase Auth's standard flow. Admin creates Operator accounts from within the app — no public self-registration.
- **Authorization:** Two layers — role check in the Route Handler, re-checked by Row Level Security policies at the database row level.
- **Realtime:** Supabase Realtime, scoped only to the spot grid and active-sessions list (`parking_spots` changes). Dashboard and history use manual/periodic refetch instead — deliberately not Realtime (TechDesign §17).
- **Styling:** Tailwind CSS + shadcn/ui (Radix-based, accessible by default). Generic UI components (`Button`, `Badge`, `Table`) kept separate from domain components (`SpotGrid`, `SessionCard`, `ReceiptView`).
- **Validation:** Zod, at every Route Handler boundary — schemas colocated in `lib/validation/`.
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (E2E). See `agent_docs/testing.md`.
- **Deployment:** Vercel (frontend, auto-deploy from `main`, automatic PR previews against a separate dev/staging Supabase project) + Supabase (managed Postgres, Auth, Realtime). No Docker, Kubernetes, or self-managed infrastructure — explicitly out of scope as unjustified complexity for this project's size (TechDesign §25).
- **UI prototyping:** Lovable is used only as a visual-exploration tool (grid layout, palette, dashboard layout) — never as the source of final production code. Validated components are reimplemented inside the real Next.js + shadcn/ui structure (TechDesign §5).

## Environment Variables
.env.local # local development — never committed
.env.example # template, no real values — committed
Production env vars # configured in Vercel's dashboard


| Variable | Public/Secret | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL — safe to expose to the client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anonymous key, subject to RLS — safe to expose to the client. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Bypasses RLS — used only in server-side Route Handlers (e.g. dashboard aggregations). **Never** allowed into the client bundle or a `NEXT_PUBLIC_*` variable. |

## Error Handling Pattern
```javascript
// Route Handlers normalize errors before they reach the UI.
// Specific Postgres/Supabase error codes are caught and mapped to
// business-level HTTP responses — never surfaced raw to the client.
// Example mapping (see agent_docs/code_patterns.md → Error Handling):
//   Postgres 23505 (unique violation) on parking_sessions insert
//     → 409 { message: "This spot is no longer available, choose another." }
//   No authenticated session
//     → 401 { message: "Your session expired, please log in again." }
//   Authenticated but wrong role
//     → 403 { message: "You don't have permission for this action." }
// Exact implementation (try/catch shape, shared error helper) is left
// to be written during the Build — no canonical code sample was
// provided in the Technical Design beyond this error-code contract.
```

## Styling & Component Examples
```tsx
// Example combining a shadcn/ui primitive with a domain component,
// following the "generic UI separate from domain UI" rule:
// <Card>
//   <SpotGrid spots={spots} onSelect={handleSelectSpot} />
// </Card>
// No canonical example implementation was provided in the Technical
// Design — build domain components (SpotGrid, SessionCard,
// ReceiptView, DashboardMetrics) on top of shadcn/ui primitives per
// agent_docs/code_patterns.md → UI Component Conventions.
```