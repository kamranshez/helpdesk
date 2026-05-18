// tickets-api.spec.ts
//
// Pure API contract tests for the /api/tickets routes.
// Uses Playwright's request fixture — no browser UI involved.
//
// Why E2E and not unit tests:
//   - Authentication enforcement requires a real session (middleware + DB).
//   - Response shapes from the real server can diverge from mocked unit tests.
//   - 404/400 edge cases require a live Prisma + Postgres stack.

import { test, expect } from '@playwright/test';

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? 'test-webhook-secret';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Signs in via the Better Auth API and stores the session cookie in the
// request context so all subsequent calls in this test are authenticated.
async function signIn(
  request: any,
  role: 'admin' | 'agent' = 'agent',
): Promise<void> {
  const creds = {
    admin: { email: 'e2e-admin@test.local', password: 'E2eAdminPass!1' },
    agent: { email: 'e2e-agent@test.local', password: 'E2eAgentPass!1' },
  };
  const response = await request.post(`${SERVER_URL}/api/auth/sign-in/email`, {
    data: creds[role],
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    },
  });
  expect(response.status()).toBe(200);
}

// Creates a ticket via the webhook and returns its id.
async function createTicket(request: any, subject = 'API test ticket'): Promise<string> {
  const response = await request.post(`${SERVER_URL}/api/webhooks/email`, {
    data: {
      from: `api-test-${Date.now()}@example.com`,
      subject,
      bodyText: 'API E2E test body.',
    },
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET,
    },
  });
  expect(response.status()).toBe(201);
  const { ticket } = await response.json();
  return ticket.id;
}

// ---------------------------------------------------------------------------
// 1. Unauthenticated access — all ticket endpoints must return 401
// ---------------------------------------------------------------------------

test.describe('Tickets API — unauthenticated access', () => {
  test('GET /api/tickets returns 401 without a session', async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/api/tickets`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/tickets/:id returns 401 without a session', async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/api/tickets/some-id`);
    expect(response.status()).toBe(401);
  });

  test('PATCH /api/tickets/:id returns 401 without a session', async ({ request }) => {
    const response = await request.patch(`${SERVER_URL}/api/tickets/some-id`, {
      data: { status: 'resolved' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/tickets/:id/replies returns 401 without a session', async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/api/tickets/some-id/replies`);
    expect(response.status()).toBe(401);
  });

  test('POST /api/tickets/:id/replies returns 401 without a session', async ({ request }) => {
    const response = await request.post(`${SERVER_URL}/api/tickets/some-id/replies`, {
      data: { body: 'Hello' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/tickets — response shape
// ---------------------------------------------------------------------------

test.describe('Tickets API — GET /api/tickets', () => {
  test('returns 200 with correct paginated shape', async ({ request }) => {
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('tickets');
    expect(Array.isArray(body.tickets)).toBe(true);
    expect(body).toHaveProperty('total');
    expect(typeof body.total).toBe('number');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
  });

  test('ticket items include expected fields', async ({ request }) => {
    await createTicket(request, 'Shape check ticket');
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets`);
    const { tickets } = await response.json();
    expect(tickets.length).toBeGreaterThan(0);

    const ticket = tickets[0];
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('subject');
    expect(ticket).toHaveProperty('fromEmail');
    expect(ticket).toHaveProperty('status');
    expect(ticket).toHaveProperty('createdAt');
    // bodyText and bodyHtml are NOT returned in the list — only in detail
    expect(ticket).not.toHaveProperty('bodyText');
  });

  test('respects the status filter param', async ({ request }) => {
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets?status=open`);
    expect(response.status()).toBe(200);

    const { tickets } = await response.json();
    for (const ticket of tickets) {
      expect(ticket.status).toBe('open');
    }
  });

  test('ignores an invalid sortBy param and falls back to createdAt', async ({ request }) => {
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets?sortBy=notAColumn`);
    expect(response.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/tickets/:id — detail and 404
// ---------------------------------------------------------------------------

test.describe('Tickets API — GET /api/tickets/:id', () => {
  test('returns the full ticket with bodyText and assignedTo', async ({ request }) => {
    const ticketId = await createTicket(request, 'Detail shape ticket');
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets/${ticketId}`);
    expect(response.status()).toBe(200);

    const { ticket } = await response.json();
    expect(ticket.id).toBe(ticketId);
    expect(ticket).toHaveProperty('bodyText');
    expect(ticket).toHaveProperty('updatedAt');
    expect(ticket).toHaveProperty('assignedTo');
    expect(ticket.status).toBe('open');
  });

  test('returns 404 for an unknown ticket id', async ({ request }) => {
    await signIn(request);

    const response = await request.get(
      `${SERVER_URL}/api/tickets/00000000-0000-0000-0000-000000000000`
    );
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// 4. PATCH /api/tickets/:id — update and validation
// ---------------------------------------------------------------------------

test.describe('Tickets API — PATCH /api/tickets/:id', () => {
  test('updates ticket status and returns the updated ticket', async ({ request }) => {
    const ticketId = await createTicket(request, 'Status update ticket');
    await signIn(request);

    const response = await request.patch(`${SERVER_URL}/api/tickets/${ticketId}`, {
      data: { status: 'resolved' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(200);

    const { ticket } = await response.json();
    expect(ticket.status).toBe('resolved');
  });

  test('returns 400 for an invalid status value', async ({ request }) => {
    const ticketId = await createTicket(request, 'Bad status ticket');
    await signIn(request);

    const response = await request.patch(`${SERVER_URL}/api/tickets/${ticketId}`, {
      data: { status: 'not_a_real_status' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when assignedToId references a non-existent agent', async ({ request }) => {
    const ticketId = await createTicket(request, 'Bad agent ticket');
    await signIn(request);

    const response = await request.patch(`${SERVER_URL}/api/tickets/${ticketId}`, {
      data: { assignedToId: '00000000-0000-0000-0000-000000000000' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 404 for an unknown ticket id', async ({ request }) => {
    await signIn(request);

    const response = await request.patch(
      `${SERVER_URL}/api/tickets/00000000-0000-0000-0000-000000000000`,
      {
        data: { status: 'resolved' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    expect(response.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 5. GET /api/tickets/:id/replies — list replies
// ---------------------------------------------------------------------------

test.describe('Tickets API — GET /api/tickets/:id/replies', () => {
  test('returns an empty array for a new ticket with no replies', async ({ request }) => {
    const ticketId = await createTicket(request, 'No replies ticket');
    await signIn(request);

    const response = await request.get(`${SERVER_URL}/api/tickets/${ticketId}/replies`);
    expect(response.status()).toBe(200);

    const { replies } = await response.json();
    expect(Array.isArray(replies)).toBe(true);
    expect(replies).toHaveLength(0);
  });

  test('returns 404 for an unknown ticket id', async ({ request }) => {
    await signIn(request);

    const response = await request.get(
      `${SERVER_URL}/api/tickets/00000000-0000-0000-0000-000000000000/replies`
    );
    expect(response.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 6. POST /api/tickets/:id/replies — create a reply
// ---------------------------------------------------------------------------

test.describe('Tickets API — POST /api/tickets/:id/replies', () => {
  test('creates a reply and returns 201 with the reply shape', async ({ request }) => {
    const ticketId = await createTicket(request, 'Reply shape ticket');
    await signIn(request);

    const response = await request.post(`${SERVER_URL}/api/tickets/${ticketId}/replies`, {
      data: { body: 'This is an agent reply.' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(201);

    const { reply } = await response.json();
    expect(reply).toHaveProperty('id');
    expect(reply.body).toBe('This is an agent reply.');
    expect(reply).toHaveProperty('senderType');
    expect(reply).toHaveProperty('author');
    expect(reply.author).toHaveProperty('name');
    expect(reply).toHaveProperty('createdAt');
  });

  test('sets senderType to agent when reply is posted by an agent', async ({ request }) => {
    const ticketId = await createTicket(request, 'Sender type ticket');
    await signIn(request, 'agent');

    const response = await request.post(`${SERVER_URL}/api/tickets/${ticketId}/replies`, {
      data: { body: 'Replying as agent.' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(201);

    const { reply } = await response.json();
    expect(reply.senderType).toBe('agent');
  });

  test('reply appears when fetching the replies list afterwards', async ({ request }) => {
    const ticketId = await createTicket(request, 'Reply persistence ticket');
    await signIn(request);

    await request.post(`${SERVER_URL}/api/tickets/${ticketId}/replies`, {
      data: { body: 'Persisted reply.' },
      headers: { 'Content-Type': 'application/json' },
    });

    const listResponse = await request.get(`${SERVER_URL}/api/tickets/${ticketId}/replies`);
    const { replies } = await listResponse.json();
    expect(replies).toHaveLength(1);
    expect(replies[0].body).toBe('Persisted reply.');
  });

  test('returns 400 when body is empty', async ({ request }) => {
    const ticketId = await createTicket(request, 'Empty reply ticket');
    await signIn(request);

    const response = await request.post(`${SERVER_URL}/api/tickets/${ticketId}/replies`, {
      data: { body: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 404 when the ticket does not exist', async ({ request }) => {
    await signIn(request);

    const response = await request.post(
      `${SERVER_URL}/api/tickets/00000000-0000-0000-0000-000000000000/replies`,
      {
        data: { body: 'Reply to ghost ticket.' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    expect(response.status()).toBe(404);
  });
});
