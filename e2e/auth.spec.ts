// auth.spec.ts — Covers authentication, route protection, role-based access, and sign-out.

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared login helper
// ---------------------------------------------------------------------------
async function loginAs(
  page: any,
  role: 'admin' | 'agent'
): Promise<void> {
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
// 1. Happy path — successful login
// ---------------------------------------------------------------------------
test.describe('Login — happy path', () => {
  test('admin can log in and land on /', async ({ page }: any) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByLabel('Password').fill('E2eAdminPass!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('agent can log in and land on /', async ({ page }: any) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-agent@test.local');
    await page.getByLabel('Password').fill('E2eAgentPass!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Client-side validation errors (form submitted without network call)
// ---------------------------------------------------------------------------
test.describe('Login — client-side validation', () => {
  test.beforeEach(async ({ page }: any) => {
    await page.goto('/login');
  });

  test('shows validation error when email is empty', async ({ page }: any) => {
    // Leave email blank, fill password, submit
    await page.getByLabel('Password').fill('anypassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
  });

  test('shows validation error when password is empty', async ({ page }: any) => {
    // Fill email, leave password blank, submit
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ page }: any) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('anypassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
  });

  test('shows validation errors when both fields are empty', async ({ page }: any) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Server-side auth errors
// ---------------------------------------------------------------------------
test.describe('Login — server-side auth errors', () => {
  test.beforeEach(async ({ page }: any) => {
    await page.goto('/login');
  });

  test('shows error alert for wrong password', async ({ page }: any) => {
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByLabel('Password').fill('WrongPassword!99');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on /login and show a destructive alert
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
// 4. Already authenticated — visiting /login redirects to /
// ---------------------------------------------------------------------------
test.describe('Already authenticated', () => {
  test('visiting /login while logged in redirects to /', async ({ page }: any) => {
    await loginAs(page, 'agent');
    // Now already on /; navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});

// ---------------------------------------------------------------------------
// 5. Route protection — unauthenticated access
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
// 6. Role-based access
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
    // Confirm the page actually loaded (not just URL match)
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
  });

  test('admin navbar shows Users link', async ({ page }: any) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
  });

  test('agent navbar does not show Users link', async ({ page }: any) => {
    await loginAs(page, 'agent');
    await expect(page.getByRole('link', { name: /users/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Sign out
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
    // Try to navigate to the home page directly
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
