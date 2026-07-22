# Automatic state transitions

This document lists every change the **backend makes on its own** — a booking,
vehicle, maintenance job, or account whose status changes **without a direct
click on that record by the affected user**. It exists so frontend engineers and
admins understand *when* and *why* a status flips automatically.

> **Live, machine-readable copy:** `GET /api/system/automatic-behaviors/`
> (authenticated). It is generated from
> [`operations/automatic_behaviors.py`](../src/operations/automatic_behaviors.py),
> which is the single source of truth — update it when you add/change a transition.

Two trigger types:

- **time** — a Celery Beat scheduled job runs it (Celery worker + beat + Redis
  are required and run as the `backend-celery`, `backend-celery-beat`,
  `backend-redis` containers).
- **event** — a side-effect of another user's action (e.g. one approval
  rejecting competing requests).

---

## Time-triggered (scheduled jobs)

| Behavior | Cadence | What changes | Why | Notifies |
|---|---|---|---|---|
| **Booking period-ended** | daily 07:00 UTC | `return_state: none → period_ended` (booking **stays** `running`) | end_date passed → prompt the driver to *Complete Trip*. Does **not** auto-complete. | driver + owner (daily nudge) |
| **Vehicle pending-return** | daily 07:00 UTC | vehicle `rented → pending_return` | mirrors the above until the owner confirms the handover | driver + owner |
| **Driver GPS suspension** | every 5 min | account `is_suspended: false → true` on the **3rd** strike | GPS went stale during an active rental; strikes are spaced **≥60 min** apart, so suspension needs ~2h of repeated location-off. Admin-only reversal. | driver, owner, all admins |
| **Daily reminders** | daily 07:00 UTC | creates oil/rego/return/maintenance-overdue notifications (no record state change) | recurring nudges, de-duplicated once per day | the relevant user |

### Monitoring
`generate_vehicle_reminders` is wrapped in failure alerting: if the sweep raises,
**every admin is notified** and the error re-raised so Celery records the failure.
After a successful run it **verifies** that no past-end rental was left unflagged
(`status=running, return_state=none, end_date<today`) and alerts admins if any
slipped through. `monitor_active_trip_locations` has the same failure alerting.

---

## Event-triggered (side-effects of another action)

| Behavior | Trigger | What changes | Why | Notifies |
|---|---|---|---|---|
| **Booking auto-rejected** | a competing booking is approved | other pending requests for that vehicle `pending → rejected` | vehicle is taken; prevents double-booking | **each losing driver** (in-app) |
| **Vehicle rented** | rental approval | vehicle `available → rented` | the car goes out with the driver | driver + admins |
| **Vehicle released** | return confirmation | vehicle `rented/pending_return → available`; booking `→ completed` | the trip is closed and the car re-bookable | the other party + admins |
| **Maintenance auto-declined** | owner accepts a competing quote | other open quotes for that vehicle `→ declined` | one vehicle → one active job | **each losing mechanic** (in-app) |
| **Maintenance vehicle chain** | accept / mechanic done / owner confirm | vehicle `available → maintenance → pending_return → available` | maintenance lifecycle | mechanic, owner, admins |
| **Token rotation** | refresh / logout | old refresh token blacklisted; access token expires | security — no replay of rotated tokens | n/a |
| **Cascade-delete audit** | admin/owner delete | related rows cascade; a durable `DeletionAudit` snapshot is written **first** | referential integrity + a forensic recovery trail | other admins |

---

## Notes for the frontend

- A booking can read `running` while being effectively over: once `end_date`
  passes, the UI may show it as complete locally, and the 07:00 job sets
  `return_state=period_ended`. Drive button visibility off `return_state`, not a
  date guess alone.
- Auto-rejected drivers and auto-declined mechanics now receive a normal
  `rental_decision` / `maintenance_declined` notification — no need to infer it
  from the reason text.
- Deletions are **not** reversible from the app, but a `DeletionAudit` row (admin
  Django panel) preserves a snapshot and the cascade row-counts for investigation.
