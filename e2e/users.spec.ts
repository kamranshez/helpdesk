// users.spec.ts — Happy-path CRUD coverage for the /users page (admin only).

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared login helper — mirrors the pattern in auth.spec.ts
// ---------------------------------------------------------------------------
async function loginAsAdmin(page: any): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-admin@test.local');
  await page.getByLabel('Password').fill('E2eAdminPass!1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}

// ---------------------------------------------------------------------------
// 1. List users
// ---------------------------------------------------------------------------

// Verifies that the users table renders after an admin logs in and navigates to /users.
test.describe('Users — list', () => {
  test('admin sees the users table with at least one row', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

    // The card header shows "N user(s)" — wait for it to appear (data loaded)
    await expect(page.getByRole('cell', { name: /e2e admin/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Create user
// ---------------------------------------------------------------------------

// Verifies the full create flow: open dialog → fill form → submit → new row visible.
test.describe('Users — create', () => {
  test('admin can create a new user and see them in the list', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');

    // Use a unique email so repeated test runs don't conflict
    const timestamp = Date.now();
    const userName = `Test User ${timestamp}`;
    const userEmail = `testuser-${timestamp}@example.com`;

    // Open the create dialog
    await page.getByRole('button', { name: /new user/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /create new user/i })).toBeVisible();

    // Fill in the form
    await page.getByLabel('Name').fill(userName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');

    // Submit
    await page.getByRole('button', { name: /create user/i }).click();

    // Dialog should close and the new user should appear in the table
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: userName })).toBeVisible();
    await expect(page.getByRole('cell', { name: userEmail })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Edit user
// ---------------------------------------------------------------------------

// Verifies the edit flow: click Edit on a row → change name → save → updated name visible.
// We edit the seeded e2e-agent user and restore their name afterwards so tests stay independent.
test.describe('Users — edit', () => {
  test('admin can edit a user name and see the updated name in the list', async ({ page }: any) => {
    // First create a throwaway user we can safely mutate
    await loginAsAdmin(page);
    await page.goto('/users');

    const timestamp = Date.now();
    const originalName = `Edit Target ${timestamp}`;
    const updatedName = `Edited Name ${timestamp}`;
    const userEmail = `edit-target-${timestamp}@example.com`;

    // Create the user
    await page.getByRole('button', { name: /new user/i }).click();
    await page.getByLabel('Name').fill(originalName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');
    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: originalName })).toBeVisible();

    // Find the row for this user and click its Edit button
    const row = page.getByRole('row').filter({ hasText: originalName });
    await row.getByRole('button', { name: /edit user/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /edit user/i })).toBeVisible();

    // Clear the name field and type the new name
    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill(updatedName);

    await page.getByRole('button', { name: /save changes/i }).click();

    // Dialog closes and updated name appears
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible();
    await expect(page.getByRole('cell', { name: originalName })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Delete user
// ---------------------------------------------------------------------------

// Verifies the delete flow: click Delete on a row → confirm in dialog → row removed.
test.describe('Users — delete', () => {
  test('admin can delete a user and they are removed from the list', async ({ page }: any) => {
    await loginAsAdmin(page);
    await page.goto('/users');

    // Create a throwaway user to delete so we don't affect seeded accounts
    const timestamp = Date.now();
    const userName = `Delete Target ${timestamp}`;
    const userEmail = `delete-target-${timestamp}@example.com`;

    await page.getByRole('button', { name: /new user/i }).click();
    await page.getByLabel('Name').fill(userName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('SecurePass!99');
    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: userName })).toBeVisible();

    // Click the Delete button on that user's row
    const row = page.getByRole('row').filter({ hasText: userName });
    await row.getByRole('button', { name: /delete user/i }).click();

    // Confirm in the delete dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /delete user/i })).toBeVisible();
    // The dialog body shows the user's name in the confirmation message
    await expect(dialog.getByText(userName)).toBeVisible();

    await page.getByRole('button', { name: /^delete$/i }).click();

    // Dialog closes and the user is no longer in the table
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: userName })).not.toBeVisible();
  });
});
