# Security Audit: Authentication & Authorization
Date: 2026-05-13
Auditor: security-auditor agent

## Scope
Files reviewed:
- server/src/lib/auth.ts
- server/src/app.ts
- server/src/index.ts
- server/src/lib/db.ts
- server/prisma/seed.ts
- server/prisma/schema.prisma
- server/.env (present, NOT committed — gitignore correct)
- server/.env.example (committed)
- client/src/lib/auth-client.ts
- client/src/App.tsx
- client/src/pages/LoginPage.tsx
- client/src/pages/UsersPage.tsx
- client/src/components/Navbar.tsx
- client/vite.config.ts

## Findings Summary

### CRITICAL
- None

### HIGH
1. **No server-side auth middleware exists at all** — server/src/app.ts and server/src/index.ts have zero routes protected by session verification. The only application route currently is GET /api/health which is unprotected, but ALL future ticket/user API routes will be unprotected unless middleware is built and applied before they are written.
2. **GET /api/health leaks infrastructure info** (PostgreSQL full version string) with no authentication. Exposed to any unauthenticated caller.

### MEDIUM
3. **No rate limiting on /api/auth/** — brute-force login attacks are unrestricted. No express-rate-limit or similar package installed.
4. **No HTTP security headers** — helmet is not installed or used. X-Frame-Options, Content-Security-Policy, HSTS, etc. are all absent.
5. **TRUSTED_ORIGIN crashes on missing env var** — `process.env.TRUSTED_ORIGIN!.split(...)` will throw at startup if the env var is unset (TypeScript non-null assertion does not guard at runtime). Better to validate and fail with a meaningful error message.
6. **.env.example contains weak default seed credentials** (admin@example.com / password123) — operators may use these verbatim in production.

### LOW
7. **SESSION_SECRET env var is defined but unused** — auth.ts uses BETTER_AUTH_SECRET. The SESSION_SECRET variable is dead code that could mislead operators into thinking it protects sessions.
8. **Client-side-only route guards** — ProtectedRoute and AdminRoute in App.tsx are purely client-side React components. They are a good UX layer but provide zero server-side enforcement. Any API route added later must independently verify the session and role on the server.
9. **Login always redirects to hardcoded "/"** — no "returnTo" / "next" query parameter support. This is actually a security positive (no open redirect risk), but it degrades UX for deep-linking.
10. **No CSRF protection documented or verified** — Better Auth ^1.6 uses Origin/Referer checking via trustedOrigins for its own endpoints; custom Express routes added later must independently protect state-mutating endpoints (POST/PUT/DELETE) from CSRF if cookie-based sessions are used.

## Positive Findings (things done correctly)
- `input: false` on the role field in additionalFields — role cannot be supplied by the client during sign-in.
- `disableSignUp: true` in production auth config (seed.ts uses a separate betterAuth instance without the flag, intentionally).
- customSession plugin re-fetches role from DB on every session request — role changes take effect immediately.
- .env is in .gitignore; was never committed to git history.
- CORS is correctly configured with `credentials: true` and a specific CLIENT_URL origin (not wildcard).
- AdminRoute checks both authentication AND role before rendering admin pages.
- Role is never sent from the client in any API request — all role reads come from the session object.
- Prisma schema enforces role as an enum (`Role.admin | Role.agent`) with DB-level constraint.
- No open redirect in login flow — post-login destination is hardcoded to "/".

## Remediation Priorities
1. (HIGH) Build requireAuth and requireAdmin middleware using Better Auth's session API before implementing any ticket/user routes.
2. (HIGH) Protect or remove GET /api/health.
3. (MEDIUM) Add express-rate-limit to /api/auth/* endpoints.
4. (MEDIUM) Install and configure helmet.
5. (MEDIUM) Validate TRUSTED_ORIGIN at startup with a clear error rather than a runtime crash.
6. (LOW) Remove SESSION_SECRET from .env/.env.example to avoid operator confusion.
7. (LOW) Update .env.example to use placeholder text (not real-looking default passwords) for seed credentials.
