// users.spec.ts — Full-stack CRUD for the /users page (admin only).
//
// NOT here (covered by unit tests):
//   - Table rendering / data display  → UsersPage.test.tsx
//   - Dialog open/close behaviour     → UsersPage.test.tsx
//   - Form validation errors          → CreateUserDialog.test.tsx, EditUserDialog.test.tsx
//   - API error handling in the UI    → dialog component unit tests
//
// These tests verify that create / edit / delete actually persist through the
// real Express + Prisma + PostgreSQL stack — something unit tests cannot do.

import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-admin@test.local');
  await page.getByLabel('Password').fill('E2eAdminPass!1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}

// ---------------------------------------------------------------------------
// 1. Create user — verifies POST /api/users persists to the DB
// ---------------------------------------------------------------------------

test.describe('Users — create', () => {
  test('admin can create a new user and see them in the list', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');

    const timestamp = Date.now();
    const userName = `Test User ${timestamp}`;
    const userEmail = `testuser-${timestamp}@example.com`;

    await page.getByRole('button', { name: /new user/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Name').fill(userName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');
    await page.getByRole('button', { name: /create user/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: userName })).toBeVisible();
    await expect(page.getByRole('cell', { name: userEmail })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Edit user — verifies PATCH /api/users/:id persists to the DB
// ---------------------------------------------------------------------------

test.describe('Users — edit', () => {
  test('admin can edit a user name and see the updated name in the list', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');

    const timestamp = Date.now();
    const originalName = `Edit Target ${timestamp}`;
    const updatedName = `Edited Name ${timestamp}`;
    const userEmail = `edit-target-${timestamp}@example.com`;

    await page.getByRole('button', { name: /new user/i }).click();
    await page.getByLabel('Name').fill(originalName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');
    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const row = page.getByRole('row').filter({ hasText: originalName });
    await row.getByRole('button', { name: /edit user/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill(updatedName);
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible();
    await expect(page.getByRole('cell', { name: originalName })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Delete user — verifies DELETE /api/users/:id removes the record from DB
// ---------------------------------------------------------------------------

test.describe('Users — delete', () => {
  test('admin can delete a user and they are removed from the list', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');

    const timestamp = Date.now();
    const userName = `Delete Target ${timestamp}`;
    const userEmail = `delete-target-${timestamp}@example.com`;

    await page.getByRole('button', { name: /new user/i }).click();
    await page.getByLabel('Name').fill(userName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');
    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const row = page.getByRole('row').filter({ hasText: userName });
    await row.getByRole('button', { name: /delete user/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(userName)).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: userName })).not.toBeVisible();
  });
});
