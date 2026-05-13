# Helpdesk — Claude Code Project Memory

## Project Overview

AI-powered ticket management system for support teams. Agents receive tickets (via email or manual creation), and AI handles classification, summarisation, and suggested replies backed by a knowledge base.

**Users:** Admin (manages agents) and Agent (manages tickets).
**Ticket statuses:** Open · Resolved · Closed
**Ticket categories:** General Question · Technical Question · Refund Request

## Monorepo Layout

```
helpdesk/
├── client/          # React + TypeScript SPA (Vite, Tailwind CSS v4, React Router v7)
├── server/          # Express v5 + TypeScript API (Bun runtime)
├── e2e/             # Playwright E2E tests (package.json sets "type": "commonjs")
├── playwright.config.ts
├── package.json     # Bun workspaces root
└── bun.lock
```

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | React 19, TypeScript, Tailwind CSS v4, React Router v7, Vite 6, shadcn/ui |
| Backend     | Node/Bun, Express v5, TypeScript                |
| Database    | PostgreSQL via Prisma ORM                       |
| Auth        | Session-based (database sessions) via Better Auth |
| AI          | Claude API (Anthropic) — classification, summaries, suggested replies |
| Email       | SendGrid or Mailgun (inbound webhook + outbound) |
| Deployment  | Docker + cloud provider (AWS / Railway / Fly.io) |

## Dev Commands

```bash
# Run both client and server in watch mode
bun dev

# Run individually
bun run dev:server
bun run dev:client

# Type-check everything
bun typecheck

# Run E2E tests (starts both servers automatically)
bun test:e2e
```

Server hot-reloads via `bun --hot`. Client dev server via Vite.

## Implementation Phases (see implementation-plan.md for checklist)

1. Project setup
2. Authentication (login, sessions, route protection)
3. User management (admin-only CRUD)
4. Ticket CRUD (list with filters/sort, detail view)
5. AI features (Claude API: auto-classify, summarise, suggest reply, knowledge base)
6. Email integration (inbound webhook → ticket, outbound reply, threading)
7. Dashboard (stats, category breakdown, recent tickets)
8. Polish & deployment (validation, error states, Docker, CI)

## Fetching Up-to-Date Documentation

Use the **context7 MCP server** before writing code that touches any library in this project. This ensures you use current APIs rather than stale training data.

Key libraries to always look up via context7:

- `react` / `react-dom` — hooks, concurrent features
- `react-router` (v7) — loader/action patterns, `<Link>`, `useNavigate`
- `tailwindcss` (v4) — utility classes, config, new v4 syntax
- `vite` — plugins, config options
- `express` (v5) — routing, middleware, error handling (v5 has breaking changes vs v4)
- `prisma` — schema, migrations, client queries
- `@anthropic-ai/sdk` — Messages API, tool use, prompt caching, streaming
- `bun` — runtime APIs, workspace commands

### How to use context7

```
# 1. Resolve the library ID
mcp__context7__resolve-library-id  { libraryName: "express" }

# 2. Fetch relevant docs
mcp__context7__query-docs  { context7CompatibleLibraryID: "/expressjs/express", topic: "error handling middleware" }
```

Always resolve before querying — IDs are not guessable.

## Key Conventions

- TypeScript strict mode on both client and server.
- ES modules (`"type": "module"`) throughout.
- Server entry: `server/src/index.ts`; client entry: `client/src/main.tsx`.
- Tailwind CSS v4 uses `@import "tailwindcss"` (no config file required for basic use).
- Express v5 has native async error propagation — no need for `express-async-errors` wrapper.
- Prisma migrations live in `server/prisma/migrations/`.
- `.env` at `server/.env` for secrets (never commit).

## shadcn/ui

Installed in `client/` — style: `base-nova`, base color: `neutral`, CSS variables enabled, icon library: `lucide`.

- Add components: `npx shadcn@latest add <component>` (run from project root or `client/`)
- Components live in `client/src/components/ui/`
- Currently installed: `button`, `input`, `label`, `card`, `badge`, `alert`
- The `form` component is **not available** in `base-nova` — use `Label` + `Input` directly with react-hook-form `register`
- The `Button` component does **not** support `asChild` in `base-nova` — use a plain `<Link>` with Tailwind classes for nav links instead
- Path alias `@/*` → `src/*` is configured in both `tsconfig.json` and `vite.config.ts`

## UI Conventions

- Use shadcn CSS variable classes everywhere — **never** raw Tailwind color classes like `text-gray-500`. Use `text-muted-foreground`, `bg-background`, `text-destructive`, `border-border`, etc.
- Loading spinners: `<Loader2 className="animate-spin" />` from `lucide-react`
- API-level errors: `<Alert variant="destructive">` with `<AlertCircle>` icon
- Field-level validation errors: `<p className="text-xs text-destructive">`
- Page layouts: `min-h-screen bg-muted` as the outer wrapper
- Chrome autofill override is set globally in `src/index.css` — no per-input fix needed

## Authentication

Better Auth is fully wired up. Sign-up is **disabled** — only admins create users via seed scripts or the future admin UI.

**Seeded accounts:**

| Email | Password | Role |
|---|---|---|
| _(set via `SEED_ADMIN_EMAIL` env var)_ | `SEED_ADMIN_PASSWORD` | `admin` |
| `agent@example.com` | `password123` | `agent` |

To create/recreate a user, write a one-off script under `server/prisma/` using a bare `betterAuth` instance (no plugins, `disableSignUp` omitted) so sign-up is permitted, then delete the script after running.

### Server (`server/src/lib/auth.ts`)

- Prisma adapter with PostgreSQL provider.
- `emailAndPassword` enabled; `disableSignUp: true`.
- Custom `role` field (`"admin" | "agent"`) added to the `user` model via `additionalFields`; defaults to `"agent"`, never accepted from client input.
- `customSession` plugin re-fetches the role from the DB on every session so role changes take effect immediately without forcing re-login.
- `TRUSTED_ORIGIN` env var (comma-separated) — required; the auth handler rejects cross-origin requests from unlisted origins.

### Server mounting (`server/src/app.ts`)

- Auth handler: `app.all("/api/auth/{*any}", toNodeHandler(auth))` — **must be registered before `express.json()`** (Better Auth reads the raw body itself).
- CORS: `credentials: true`, origin from `CLIENT_URL` env var (default `http://localhost:5173`).

### Client (`client/src/lib/auth-client.ts`)

- `createAuthClient()` from `better-auth/react` — no explicit `baseURL`; relies on Vite's dev-server proxy forwarding `/api/*` to the Express server.
- Exported as `authClient`; import this everywhere auth is needed — never call `/api/auth/*` directly.

### Key client APIs

| Usage | Code |
|---|---|
| Read session / loading state | `const { data: session, isPending } = authClient.useSession()` |
| Sign in | `authClient.signIn.email({ email, password })` |
| Sign out | `authClient.signOut()` |
| Access role | `session?.user.role` → `"admin"` or `"agent"` |

### Route protection (`client/src/App.tsx`)

`<ProtectedRoute>` wraps any route that requires a session. It uses `authClient.useSession()` and:
- Shows a spinner while `isPending` is true.
- Redirects to `/login` if `session` is `null`.
- Renders children otherwise.

Apply role gating inside the protected page (check `session.user.role`) or add a separate `<AdminRoute>` wrapper for admin-only pages.

`<AdminRoute>` is already implemented in `App.tsx` — it redirects unauthenticated users to `/login` and non-admins to `/`.

**Typing `role` on the client:** The client tsconfig only covers `client/src`, so `inferAdditionalFields<typeof auth>()` cannot be used (would require importing from the server). Cast instead:

```ts
const role = (session?.user as { role?: "admin" | "agent" } | undefined)?.role;
```

### Users page (`client/src/pages/UsersPage.tsx`)

- Route: `/users` — wrapped in `<AdminRoute>`, redirects agents to `/`.
- Navbar shows a "Users" link next to the "Helpdesk" logo, visible to admins only (role check via type cast).

### Login page (`client/src/pages/LoginPage.tsx`)

- Validates with react-hook-form + zod (`email` + `password` fields).
- Calls `authClient.signIn.email()` on submit; maps auth errors to `errors.root` shown in a destructive `<Alert>`.
- Redirects to `/` on success; also redirects automatically if already logged in (via `useEffect` watching `session`).

### Environment variables (server)

| Variable | Purpose |
|---|---|
| `TRUSTED_ORIGIN` | Comma-separated allowed origins for Better Auth CORS |
| `CLIENT_URL` | Express CORS `origin` value (default `http://localhost:5173`) |
| `BETTER_AUTH_SECRET` | Secret used to sign session tokens (required in production) |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |

## E2E Testing (Playwright)

- Config: `playwright.config.ts` at root — single Chromium project, `workers: 1`.
- Test files go in `e2e/` — the directory has its own `package.json` with `"type": "commonjs"` because Playwright compiles setup files to CJS, which conflicts with the root `"type": "module"`.
- **Separate test database:** `helpdesk_test` (never touches the dev `helpdesk` DB).
- `e2e/global-setup.ts` runs before any test: creates `helpdesk_test` if missing, runs `prisma migrate deploy`, seeds two test users.
- Test env vars live in `server/.env.test` (safe to commit — no production secrets). Test credentials: `e2e-admin@test.local` / `E2eAdminPass!1` (admin) and `e2e-agent@test.local` / `E2eAgentPass!1` (agent).
- The server webServer in `playwright.config.ts` injects `DATABASE_URL` pointing to `helpdesk_test` — dotenv won't override it since it respects pre-set env vars.
- Password hashing in global-setup uses `node:crypto scrypt` with the exact same parameters as Better Auth (`N:16384, r:16, p:1, dkLen:64`, format: `salt:hex(key)`).

## Security

- Rate limiting (`express-rate-limit`) on `/api/auth/sign-in`: **production only** (`NODE_ENV === "production"`). Disabled in dev and test to avoid friction.

## Notes

- Claude API integration should include prompt caching on large knowledge-base context to reduce cost.
- Role-based access: middleware should enforce `admin` vs `agent` at the route level.
- Email threading: store `Message-ID` header on tickets so inbound replies match existing tickets.
