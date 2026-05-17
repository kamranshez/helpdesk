---
name: coverage-tickets
description: tickets.spec.ts covers the /tickets page — list view, role access, auth redirect, navbar link, count subtitle (6 tests, all passing)
metadata:
  type: project
---

`e2e/tickets.spec.ts` — 6 tests, all passing.

**Describes:**
1. `Tickets — admin list view` — seeds 3 tickets via webhook in `beforeAll` (one per category), then asserts subject text, from-email, Open status badge, and General/Technical/Refund category badges are visible.
2. `Tickets — agent access` — agent visits `/tickets`, confirms no redirect (URL stays `/tickets`).
3. `Tickets — auth redirect` — unauthenticated user visiting `/tickets` lands on `/login`.
4. `Tickets — navbar link` — both admin and agent see a "Tickets" nav link after login.
5. `Tickets — count subtitle` — seeds 3 tickets, asserts the subtitle matches `/\d+ tickets?/` and is not "0 tickets".

**Selector lessons learned:**
- `getByText('General')` fails strict-mode when the subject column also contains "General" (e.g. "General inquiry …"). Use `getByRole('cell', { name: 'General', exact: true }).first()` instead.
- The test DB accumulates tickets across runs — always use `.first()` when asserting on category/status cells that may appear in multiple rows.

**Seed approach:**
- Tickets are seeded with `request.post` inside `test.beforeAll` — not through the UI.
- Uses `Date.now()` suffix on `messageId`, `from`, and `subject` to avoid 409 conflicts across runs.

**Related:** [[coverage-webhooks]] — webhook spec shows the same `postTicket` helper pattern.
