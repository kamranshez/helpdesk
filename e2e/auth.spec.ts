// auth.spec.ts — Authentication, route protection, and role-based access.
//
// Client-side form validation (empty fields, invalid email format) belongs in
// component tests (LoginPage.test.tsx) — not here.
// Navbar link visibility by role belongs in component tests (mock the session).

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

// ---------------------------------------------------------------------------
// 1. Happy path — successful login (requires real session + server auth)
// ---------------------------------------------------------------------------
test.describe('Login — happy path', () => {
  test('admin can log in and land on /', async ({ page }: any) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByLabel('Password').fill('E2eAdminPass!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('agent can log in and land on /', async ({ page }: any) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-agent@test.local');
    await page.getByLabel('Password').fill('E2eAgentPass!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });
});

// ---------------------------------------------------------------------------
// 2. Server-side auth errors (requires real auth server to respond)
// ---------------------------------------------------------------------------
test.describe('Login — server-side auth errors', () => {
  test.beforeEach(async ({ page }: any) => {
    await page.goto('/login');
  });

  test('shows error alert for wrong password', async ({ page }: any) => {
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByLabel('Password').fill('WrongPassword!99');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('shows error alert for non-existent email', async ({ page }: any) => {
    await page.getByLabel('Email').fill('ghost@example.com');
    await page.getByLabel('Password').fill('AnyPassword!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('alert')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Already authenticated — requires real session state
// ---------------------------------------------------------------------------
test.describe('Already authenticated', () => {
  test('visiting /login while logged in redirects to /', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});

// ---------------------------------------------------------------------------
// 4. Route protection — requires real session (ProtectedRoute checks real auth)
// ---------------------------------------------------------------------------
test.describe('Route protection — unauthenticated', () => {
  test('unauthenticated user visiting / is redirected to /login', async ({ page }: any) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /users is redirected to /login', async ({ page }: any) => {
    await page.goto('/users');
    await expect(page).toHaveURL('/login');
  });
});

// ---------------------------------------------------------------------------
// 5. Role-based access — requires real role stored in session
// ---------------------------------------------------------------------------
test.describe('Role-based access', () => {
  test('agent visiting /users is redirected to /', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await page.goto('/users');
    await expect(page).toHaveURL('/');
  });

  test('admin can access /users', async ({ page }: any) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Sign out — requires real session to invalidate
// ---------------------------------------------------------------------------
test.describe('Sign out', () => {
  test('after signing out, user is redirected to /login', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login');
  });

  test('after signing out, visiting a protected route redirects to /login', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login');
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
