---
name: coverage-auth
description: auth.spec.ts exists and covers all auth scenarios — 17 tests, all passing as of initial write
metadata:
  type: project
---

`e2e/auth.spec.ts` provides full coverage for the authentication system.

Test groups and counts:
- Login — happy path (2): admin and agent login, land on /
- Login — client-side validation (4): empty email, empty password, invalid email format, both empty
- Login — server-side auth errors (2): wrong password, non-existent email — asserts `getByRole('alert')` visible and URL stays /login
- Already authenticated (1): visiting /login while logged in redirects to /
- Route protection — unauthenticated (2): / and /users both redirect to /login
- Role-based access (4): agent→/users redirects to /, admin can access /users, admin sees Users nav link, agent does not see Users nav link
- Sign out (2): sign out redirects to /login, protected route after sign-out redirects to /login

All 17 tests passed in first run (35.3s total, single Chromium worker).

**Why:** Establishes baseline E2E auth coverage for the helpdesk project.
**How to apply:** Before adding new auth tests, check this file so you don't duplicate existing scenarios.
