// tickets.spec.ts — E2E coverage for the /tickets page.
// Rendering and data-display concerns live in TicketsPage.test.tsx (unit tests).
// These tests cover only auth-flow behaviour that requires a real session.

import { test, expect } from '@playwright/test';

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

// Verifies that an agent is NOT redirected away from /tickets — the route is
// available to all authenticated users, not just admins.
test.describe('Tickets — agent access', () => {
  test('agent can visit /tickets without being redirected', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await page.goto('/tickets');
    await expect(page).toHaveURL('/tickets');
    await expect(page.getByRole('heading', { name: /tickets/i })).toBeVisible();
  });
});

// Verifies that visiting /tickets without a session redirects to /login.
test.describe('Tickets — auth redirect', () => {
  test('unauthenticated user is redirected to /login', async ({ page }: any) => {
    await page.goto('/tickets');
    await expect(page).toHaveURL('/login');
  });
});
