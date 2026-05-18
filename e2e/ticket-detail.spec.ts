// ticket-detail.spec.ts
//
// Covers route protection and role-based access for /tickets/:id.
//
// NOT here (covered by unit tests):
//   - Back link rendering         → TicketDetailPage.test.tsx "renders a back link to /tickets"
//   - 404 error message           → TicketDetailPage.test.tsx "shows Ticket not found for a 404 response"
//   - Reply thread section render → ReplyThread.test.tsx
//   - Navigation on link click    → unit-testable rendering concern

import { test, expect } from '@playwright/test';

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? 'test-webhook-secret';

async function loginAs(page: any, role: 'admin' | 'agent'): Promise<void> {
  const creds = {
    admin: { email: 'e2e-admin@test.local', password: 'E2eAdminPass!1' },
    agent: { email: 'e2e-agent@test.local', password: 'E2eAgentPass!1' },
  };
  await page.goto('/login');
  await page.getByLabel('Email').fill(creds[role].email);
  await page.getByLabel('Password').fill(creds[role].password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}

async function createTicket(request: any, subject: string): Promise<string> {
  const response = await request.post(`${SERVER_URL}/api/webhooks/email`, {
    data: { from: `e2e-${Date.now()}@example.com`, subject, bodyText: 'E2E test body.' },
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
  });
  expect(response.status()).toBe(201);
  const { ticket } = await response.json();
  return ticket.id;
}

// ---------------------------------------------------------------------------
// 1. Route protection — unauthenticated access
// ---------------------------------------------------------------------------

test.describe('Ticket detail — unauthenticated', () => {
  test('visiting /tickets/:id without a session redirects to /login', async ({ page }) => {
    await page.goto('/tickets/non-existent-id');
    await expect(page).toHaveURL('/login');
  });
});

// ---------------------------------------------------------------------------
// 2. Role-based access — both roles can reach /tickets/:id
//    Requires a real session + a real ticket in the DB.
// ---------------------------------------------------------------------------

test.describe('Ticket detail — agent access', () => {
  test('agent can view a ticket detail page', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'Agent detail access test');
    await loginAs(page, 'agent');
    await page.goto(`/tickets/${ticketId}`);
    await expect(page).toHaveURL(`/tickets/${ticketId}`);
    await expect(page.getByText('Agent detail access test')).toBeVisible();
  });
});

test.describe('Ticket detail — admin access', () => {
  test('admin can view a ticket detail page', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'Admin detail access test');
    await loginAs(page, 'admin');
    await page.goto(`/tickets/${ticketId}`);
    await expect(page).toHaveURL(`/tickets/${ticketId}`);
    await expect(page.getByText('Admin detail access test')).toBeVisible();
  });
});
