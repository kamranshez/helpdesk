---
name: coverage-users
description: users.spec.ts covers happy-path CRUD for /users page — list, create, edit, delete (4 tests, all passing)
metadata:
  type: project
---

`e2e/users.spec.ts` — 4 tests, all passing.

**Covered:**
- List: admin navigates to `/users`, table row for seeded `e2e-admin` is visible
- Create: open "New User" dialog, fill name/email/password, submit, new row appears
- Edit: create throwaway user, click "Edit user" icon button on row, change name, "Save Changes", updated name visible
- Delete: create throwaway user, click "Delete user" icon button on row, confirm in dialog with "Delete" button, row removed

**Key selector notes:**
- Create button: `getByRole('button', { name: /new user/i })` (button text is "New User", not "Create User")
- Edit button: `row.getByRole('button', { name: /edit user/i })` (aria-label="Edit user")
- Delete button: `row.getByRole('button', { name: /delete user/i })` (aria-label="Delete user")
- Confirm delete: `page.getByRole('button', { name: /^delete$/i })` (exact match avoids matching "Delete user" aria-label)
- Dialog scope: use `const dialog = page.getByRole('dialog')` then `dialog.getByText(userName)` — the user name appears in both the table cell AND the dialog span, causing strict-mode violations if not scoped

**Test isolation pattern:** create-edit and create-delete tests each create a throwaway user with a `Date.now()` timestamp email, avoiding mutation of seeded accounts.

**No role selector in create form** — `createUserSchema` has no role field; all new users are created as agents by the API.
