// webhooks.spec.ts — API-level tests for POST /api/webhooks/email.
// No browser UI is involved; all assertions are made against HTTP responses
// using Playwright's `request` fixture.

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants — sourced from server/.env.test via global-setup → process.env
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET!;
const WEBHOOK_URL = `${process.env.SERVER_URL}/api/webhooks/email`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns a minimal valid payload. Individual tests override specific fields.
function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from: 'customer@example.com',
    subject: 'My order is missing',
    bodyText: 'Please help me find my order.',
    ...overrides,
  };
}

// Posts to the webhook endpoint and returns the response.
async function postWebhook(
  request: any,
  body: Record<string, unknown>,
  secret: string | null = WEBHOOK_SECRET
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== null) {
    headers['x-webhook-secret'] = secret;
  }
  return request.post(WEBHOOK_URL, { data: body, headers });
}

// ---------------------------------------------------------------------------
// 1. Ticket creation — happy paths
// ---------------------------------------------------------------------------

// Covers the primary success scenarios: all fields, required-only, and each
// valid category value.
test.describe('Webhook — ticket creation', () => {
  test('creates a ticket with all fields and returns 201 with correct shape', async ({ request }: any) => {
    const messageId = `<all-fields-${Date.now()}@mail.example.com>`;
    const response = await postWebhook(request, {
      from: 'alice@example.com',
      fromName: 'Alice',
      to: 'support@company.com',
      subject: 'My order is missing',
      bodyText: 'Please help me find my order.',
      bodyHtml: '<p>Please help me find my order.</p>',
      messageId,
      category: 'technical_question',
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('ticket');

    const { ticket } = body;
    expect(ticket).toHaveProperty('id');
    expect(ticket.subject).toBe('My order is missing');
    expect(ticket.bodyText).toBe('Please help me find my order.');
    expect(ticket.fromEmail).toBe('alice@example.com');
    expect(ticket.fromName).toBe('Alice');
    expect(ticket.toEmail).toBe('support@company.com');
    expect(ticket.messageId).toBe(messageId);
    expect(ticket.category).toBe('technical_question');
    expect(ticket.status).toBe('open');
    expect(ticket).toHaveProperty('createdAt');
    expect(ticket).toHaveProperty('updatedAt');
  });

  test('creates a ticket with only required fields (no optional fields)', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload());

    expect(response.status()).toBe(201);

    const { ticket } = await response.json();
    expect(ticket.fromEmail).toBe('customer@example.com');
    expect(ticket.subject).toBe('My order is missing');
    expect(ticket.bodyText).toBe('Please help me find my order.');
    expect(ticket.status).toBe('open');
    // Optional fields absent from the payload should be null or undefined
    expect(ticket.fromName == null || ticket.fromName === undefined).toBe(true);
    expect(ticket.messageId == null || ticket.messageId === undefined).toBe(true);
  });

  test('creates a ticket with category: general_question', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload({ category: 'general_question' }));

    expect(response.status()).toBe(201);
    const { ticket } = await response.json();
    expect(ticket.category).toBe('general_question');
  });

  test('creates a ticket with category: technical_question', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload({ category: 'technical_question' }));

    expect(response.status()).toBe(201);
    const { ticket } = await response.json();
    expect(ticket.category).toBe('technical_question');
  });

  test('creates a ticket with category: refund_request', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload({ category: 'refund_request' }));

    expect(response.status()).toBe(201);
    const { ticket } = await response.json();
    expect(ticket.category).toBe('refund_request');
  });
});

// ---------------------------------------------------------------------------
// 2. Authentication — x-webhook-secret header
// ---------------------------------------------------------------------------

// Verifies that the endpoint rejects requests that are missing the secret or
// supply the wrong value.
test.describe('Webhook — authentication', () => {
  test('returns 401 when x-webhook-secret header is absent', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload(), null);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 401 when x-webhook-secret header has wrong value', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload(), 'wrong-secret-value');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// 3. Validation errors — missing or invalid fields
// ---------------------------------------------------------------------------

// Verifies that each required field produces a 400 when omitted, and that
// invalid values (bad email format) are also rejected.
test.describe('Webhook — validation', () => {
  test('returns 400 when `from` field is missing', async ({ request }: any) => {
    const { from: _omitted, ...payload } = basePayload() as any;
    const response = await postWebhook(request, payload);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when `from` is not a valid email address', async ({ request }: any) => {
    const response = await postWebhook(request, basePayload({ from: 'not-an-email' }));

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when `subject` field is missing', async ({ request }: any) => {
    const { subject: _omitted, ...payload } = basePayload() as any;
    const response = await postWebhook(request, payload);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when `bodyText` field is missing', async ({ request }: any) => {
    const { bodyText: _omitted, ...payload } = basePayload() as any;
    const response = await postWebhook(request, payload);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// 4. Duplicate messageId — conflict detection
// ---------------------------------------------------------------------------

// Verifies that submitting the same messageId twice results in a 409 on the
// second request. A unique suffix ensures no cross-run conflicts.
test.describe('Webhook — duplicate messageId', () => {
  test('returns 409 when messageId already exists', async ({ request }: any) => {
    const messageId = `<duplicate-test-${Date.now()}@mail.example.com>`;
    const payload = basePayload({ messageId });

    // First request — must succeed
    const first = await postWebhook(request, payload);
    expect(first.status()).toBe(201);

    // Second request with same messageId — must conflict
    const second = await postWebhook(request, payload);
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body.error).toBe('A ticket with this message ID already exists.');
  });
});
