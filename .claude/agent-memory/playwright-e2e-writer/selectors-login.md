---
name: selectors-login
description: Confirmed stable selectors for the login page and navbar, verified against live app
metadata:
  type: project
---

Login form (`/login`):
- Email field: `page.getByLabel('Email')` — bound to `<Label htmlFor="email">Email</Label>`
- Password field: `page.getByLabel('Password')` — bound to `<Label htmlFor="password">Password</Label>`
- Submit button: `page.getByRole('button', { name: /sign in/i })`
- Root error alert (server errors): `page.getByRole('alert')` — rendered as `<Alert variant="destructive">`
- Email validation error text: `/enter a valid email address/i`
- Password validation error text: `/password is required/i`

Home page (`/`):
- Unique heading: `page.getByRole('heading', { name: /welcome back/i })`

Users page (`/users`):
- Unique heading: `page.getByRole('heading', { name: /users/i })`

Navbar:
- Sign out: `page.getByRole('button', { name: /sign out/i })`
- Users nav link (admin only): `page.getByRole('link', { name: /users/i })`

**How to apply:** Use these selectors in any test that touches auth flows or the navbar. Re-verify against the source if the LoginPage.tsx or Navbar.tsx changes.
