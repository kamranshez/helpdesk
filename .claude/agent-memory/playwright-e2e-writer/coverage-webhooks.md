---
name: coverage-webhooks
description: webhooks.spec.ts covers POST /api/webhooks/email — ticket creation, auth, validation, duplicate messageId (12 tests, all passing)
metadata:
  type: project
---

`e2e/webhooks.spec.ts` — 12 tests, all passing.

Uses Playwright's `request` fixture posting directly to `http://localhost:3000/api/webhooks/email` (no browser UI). Secret is hardcoded as `dev-webhook-secret` (matches `EMAIL_WEBHOOK_SECRET` in `server/.env`; the playwright webServer env block does not set this var so the dotenv value is active).

Coverage:
- Creates ticket with all fields — verifies 201 + full response shape including `status: "open"`
- Creates ticket with required-only fields (no optional fields)
- Creates ticket with each valid category: `general_question`, `technical_question`, `refund_request`
- Returns 401 with no `x-webhook-secret` header
- Returns 401 with wrong `x-webhook-secret` value
- Returns 400 when `from` is missing
- Returns 400 when `from` is not a valid email
- Returns 400 when `subject` is missing
- Returns 400 when `bodyText` is missing
- Returns 409 on duplicate `messageId` (unique timestamp suffix per run to avoid cross-run conflicts)

Key pattern: `postWebhook(request, body, secret)` helper centralises header injection and base URL. `basePayload(overrides)` keeps individual tests concise.
