# Product Requirements

> Agent's quick-reference version of `PRD-Parking-Management-MVP.md`. Keep it short and current; consult the full PRD for detail not captured here.

## Product Summary
- **Product:** Parking Management System (MVP)
- **One-liner:** A web app to operate a single-lot parking facility — configure spots, register vehicle entries/exits, automatically calculate stay cost, log payments, and issue a demo receipt.
- **Target users:** Operating staff of a small-to-medium parking lot: the owner/administrator and the shift staff who receive and release vehicles.

## User Stories
*(Full list of 27 stories across 12 modules lives in the PRD §11; the must-have-critical ones are summarized here.)*
- As a user, I want to log in with my credentials, so that I only access the functions for my role (US-AUTH-001).
- As an admin, I want to create the parking lot by defining rows and columns, so that the spot grid is generated automatically (US-CONFIG-001).
- As an admin, I want to configure rates by vehicle type, so that the system charges the correct amount for each stay (US-CONFIG-002).
- As an operator, I want to register a vehicle's entry with its plate and type, so that its stay starts correctly (US-ENTRY-001).
- As an operator, I want the system to reject entry if the vehicle already has an active session, so duplicate sessions are avoided (US-ENTRY-003).
- As an operator, I want the system to reject assigning an already-occupied spot, to avoid double assignment (US-ENTRY-004).
- As an operator, I want to register a vehicle's exit, so the amount owed is calculated automatically (US-EXIT-001).
- As an operator, I want to close an exit even if the customer doesn't pay on the spot, so the spot isn't blocked from freeing up (US-EXIT-003).
- As an admin/operator, I want the amount due to always be calculated server-side, so it can't be manipulated from the browser (US-PAYMENT-003).
- As an admin/operator, I want to generate the demo receipt for a completed session, to give the customer proof (US-RECEIPT-001), with a clear notice that it has no fiscal validity (US-RECEIPT-002).
- As an admin/operator, I want to see a summary of occupancy and daily activity, to understand operations without reviewing records one by one (US-DASHBOARD-001).
- As an admin, I want to see who performed each sensitive action, for traceability (US-AUDIT-001).

## Feature List (MoSCoW)
*(PRD §21)*

### Must Have
- Authentication with Admin/Operator roles, authorization enforced in backend.
- Parking lot configuration + spot grid (rows × columns), spot CRUD, spot states.
- Vehicle entry registration, spot assignment, vehicle exit registration.
- Automatic, server-side duration/cost calculation (hour-fraction rounded up).
- Rates by vehicle type; rate frozen (snapshot) at session creation.
- Payment registration; incomplete-payment flow (`pending_payment`).
- Demo receipt generation.
- Session/payment history.
- Dashboard with the 7 metrics below.
- Basic audit trail (user, action, timestamp).
- Protection against double spot/vehicle assignment (concurrency).

### Should Have
- Daily rate cap.
- Free-text reason for `out_of_service`.

### Could Have
- Reservations (`reserved` state).
- Free X/Y position layout editor (drag-and-drop).
- Zones and spot types.
- Time/day-specific special rates.

### Won't Have (this version) — Out of Scope
- Legally valid electronic invoicing before Colombia's DIAN (CUFE, digital signature, fiscal XML).
- Vehicle/owner CRM or personal owner data beyond plate + vehicle type.
- Multi-lot / multi-tenant operation.
- Push/SMS notifications, real payment gateways, automatic license-plate recognition (camera).

## Business Rules (critical — see PRD §13 for the full 14)
- **BR-001 / BR-002:** A vehicle (by plate) and a spot may each have at most one **active** session at a time — enforced at the database level.
- **BR-003:** Session cost uses the rate **frozen at session creation**, never the rate in effect at calculation time.
- **BR-004:** The amount owed is never supplied by the client — always computed server-side from `entry_time`, `exit_time`, and the frozen rate.
- **BR-005:** A `completed` session cannot be edited directly; no completed-session voiding mechanism exists in the MVP.
- **BR-006 / BR-014:** `billable_hours = max(1, ceil(minutes / 60))`; `cost = billable_hours × hourly_rate`. Every stay bills a minimum of 1 hour, even at 0 minutes.
- **BR-007:** Plate is mandatory to register an entry — no session can be created without it.
- **BR-008 / BR-009:** Only Admin manages rates/config/users; both Admin and Operator can register entries, exits, payments, and view full history/dashboard.
- **BR-010:** A spot can only go `out_of_service` if it has no active session.
- **BR-011:** A session can only become `completed` if its associated payment is `paid`.
- **BR-012:** Every configuration action and every cancellation is logged to the audit trail with user + timestamp.
- **BR-013:** The demo receipt must explicitly state it has no fiscal validity.

## State Transitions (PRD §14)
- **ParkingSpot:** `available ⇄ occupied` (automatic on assign/release) · `available ⇄ out_of_service` (manual, only if no active session). Direct `occupied → out_of_service` is **not** allowed.
- **ParkingSession:** `active → completed` (payment completed at exit) · `active → pending_payment` (exit without full payment) · `pending_payment → completed` (payment completed later) · `active → cancelled` (Admin/Operator, only if no payment exists yet). `completed` and `cancelled` are terminal.
- **Payment:** `pending → paid` (no reverse transition in the MVP).
- **Invoice:** single state, `generated`, created once per completed session.

## Success Metrics / Success Criteria (PRD §23)
- Operators can register a full entry (plate, type, spot) without ambiguity.
- No double spot assignment or duplicate active vehicle session occurs, even under simultaneous attempts.
- Cost calculates correctly for the edge cases in §17 (0, 1, 60, 61 minutes, long stays).
- Rate changes never affect sessions already in progress or closed.
- Exit + payment (including incomplete payment) can be fully completed.
- Demo receipt is generated with the fiscal-invalidity notice.
- History is retained and queryable by both Admin and Operator.
- Configuration and cancellation actions are audited with user + timestamp.

## Out of Scope
- Legally valid electronic invoicing before the DIAN, CUFE, digital signature, fiscal XML.
- Vehicle/owner CRM with owner personal data.
- Multi-lot / multi-tenant operation.
- Push/SMS notifications, real payment gateways, automatic license-plate recognition, reservations, free X/Y layout editor, zones/spot-type layout, time/day-specific rates.
</markdown>