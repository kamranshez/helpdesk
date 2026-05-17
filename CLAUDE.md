# Helpdesk — Claude Code Project Memory

## Project Overview

AI-powered ticket management system for support teams. Agents receive tickets (via email or manual creation), and AI handles classification, summarisation, and suggested replies backed by a knowledge base.

**Users:** Admin (manages agents) and Agent (manages tickets).
**Ticket statuses:** Open · Resolved · Closed
**Ticket categories:** General Question · Technical Question · Refund Request
**Ticket table:** includes `assignedToId` (nullable FK → `user.id`) and `assignedTo` relation; set via `PATCH /api/tickets/:id` with `{ assignedToId: string | null }`.

## Monorepo Layout

```
helpdesk/
├── core/            # Shared TypeScript package — Zod schemas, shared types (@helpdesk/core)
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
| Frontend    | React 19, TypeScript, Tailwind CSS v4, React Router v7, Vite 6, shadcn/ui, Axios, TanStack Query |
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
- Always import Prisma enums from the generated client (`server/generated/prisma/enums.js`) — never hardcode enum strings. Example: `import { Role } from "../../generated/prisma/enums.js"` then use `Role.agent`, `Role.admin`.

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

## Shared Core Package (`@helpdesk/core`)

`core/` is a Bun workspace package imported by both `client` and `server` as `@helpdesk/core`. It holds anything that must stay in sync across the boundary — primarily Zod schemas and their inferred types.

**Rules:**
- Define Zod schemas in `core/src/schemas/<resource>.ts` and export them from `core/src/index.ts`.
- **Always use explicit named re-exports in `core/src/index.ts`** — never `export *`. Bun's static analysis caches the export list from `export *` and won't pick up new names after the source file changes, causing `Export named '...' not found` errors at runtime.
- The server uses `schema.safeParse(req.body)` for validation — no duplicate manual checks.
- The client imports the same schema and passes it to `zodResolver` for react-hook-form.
- Never copy a schema into client or server — always reference `@helpdesk/core`.

**Adding a new schema:**

```ts
// core/src/schemas/tickets.ts
import { z } from "zod";

export const createTicketSchema = z.object({ ... });
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

```ts
// core/src/index.ts
export * from "./schemas/tickets.js";
```

```ts
// server: validate request body
import { createTicketSchema } from "@helpdesk/core";
const result = createTicketSchema.safeParse(req.body);
if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

// client: wire into react-hook-form
import { createTicketSchema, type CreateTicketInput } from "@helpdesk/core";
useForm<CreateTicketInput>({ resolver: zodResolver(createTicketSchema) });
```

**Reference:** `core/src/schemas/users.ts` + how it's consumed in `client/src/pages/UsersPage.tsx` and `server/src/routes/users.ts`.

## Form Validation

Use **react-hook-form** + **Zod v4** for all forms. Wire them together with `@hookform/resolvers/zod`.

**Zod v4 API changes** (v4 differs from v3 — use these):

```ts
// Top-level primitives replace chained string methods:
z.email()          // not z.string().email()
z.url()            // not z.string().url()
z.uuid()           // not z.string().uuid()

// String constraints still chain off z.string():
z.string().min(3)
z.string().max(100)
```

**Full pattern (schema → form → mutation → errors):**

```ts
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

// 1. Define schema and infer type
const schema = z.object({
  name: z.string().min(3, "Min 3 characters"),
  email: z.email("Valid email required"),
});
type FormData = z.infer<typeof schema>;

// 2. Wire form
const { register, handleSubmit, reset, formState: { errors }, setError } = useForm<FormData>({
  resolver: zodResolver(schema),
});

// 3. Wire mutation — surface API errors via setError("root")
const mutation = useMutation({
  mutationFn: (data: FormData) => axios.post("/api/...", data, { withCredentials: true }),
  onSuccess: () => { reset(); /* close modal / redirect */ },
  onError: (err) => {
    const message = axios.isAxiosError(err) && err.response?.data?.error
      ? (err.response.data.error as string)
      : "Something went wrong.";
    setError("root", { message });
  },
});

// 4. Submit
<form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
  <Input {...register("name")} />
  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}

  {errors.root && <Alert variant="destructive"><AlertDescription>{errors.root.message}</AlertDescription></Alert>}

  <Button type="submit" disabled={mutation.isPending}>Submit</Button>
</form>
```

- Field errors: `<p className="text-xs text-destructive">{errors.field?.message}</p>`
- Red border on invalid fields: pass `aria-invalid={!!errors.field}` to `<Input>` — the component's styles activate on `aria-invalid`
- API/server errors: `setError("root", { message })` shown in a destructive `<Alert>`
- Disable the submit button while `mutation.isPending`

**Reference implementation:** `client/src/pages/UsersPage.tsx` (create user modal)

## Data Fetching

- **Always use Axios** for HTTP requests — never the native `fetch` API.
- **Always use TanStack Query** (`useQuery`, `useMutation`) for server state in components — never `useEffect` + `useState` for fetching.
- `QueryClientProvider` is set up in `client/src/main.tsx` — no additional setup needed.
- Extract the fetcher into a plain `async` function above the component and pass it to `queryFn`.
- Use `withCredentials: true` on all Axios calls so session cookies are sent.
- Access `isLoading`, `error`, and `data` from the query result; `error` is typed as `Error | null`.

```ts
async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<{ users: User[] }>("/api/users", { withCredentials: true });
  return data.users;
}

const { data: users = [], isLoading, error } = useQuery({
  queryKey: ["users"],
  queryFn: fetchUsers,
});
```

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

## Testing Strategy

**Default to component tests. Use E2E only for things that cannot be tested at the component level.**

### Component Testing (Vitest + React Testing Library)

Tests live alongside their component as `ComponentName.test.tsx`. The test runner is Vitest with jsdom.

**Commands (run from `client/`):**

```bash
cd client

# Run all tests once
bun run test

# Watch mode
bun run test:watch
```

**Setup files:**

- `client/src/test/setup.ts` — imports `@testing-library/jest-dom` matchers globally.
- `client/src/test/render.tsx` — exports `renderWithProviders(ui)`, which wraps any component in a fresh `QueryClient` (retries disabled). **Always use this instead of bare `render`.**

**Mocking conventions:**

- Mock `axios` at the module level with `vi.mock("axios")`, then spy on `axios.get` / `axios.post` with `vi.spyOn`.
- Mock `react-router` to stub `useNavigate` and `Link`.
- Mock `@/lib/auth-client` to return a fixed session so tests don't depend on auth state.
- Call `vi.clearAllMocks()` in `beforeEach`.

**What to cover in component tests (covers the vast majority of cases):**

- Loading state (skeleton/spinner visible while query is in-flight).
- Successful data render (rows, counts, formatted values, badge labels).
- Empty state (zero items, no crash).
- Error state (destructive `<Alert>` appears, data card absent).
- Correct Axios call (URL + `withCredentials: true`).
- Navbar links and UI elements rendered given a mocked session.
- Form validation errors and submission behaviour.

**Reference implementation:** `client/src/pages/TicketsPage.test.tsx`, `client/src/pages/UsersPage.test.tsx`

### E2E Testing (Playwright)

E2E tests are slow, require a real server + database, and accumulate state across runs. Use them **only** for flows that genuinely cannot be tested at the component level.

**Reserve E2E for:**
- Auth flows that depend on real session state — e.g. unauthenticated redirect to `/login`, role-based redirect (agent → `/`).
- Role access checks that must prove a route is or is not accessible to a given role with a real session.
- Pure API contracts with no UI — e.g. webhook endpoint behaviour (happy path, auth rejection, validation, deduplication).

**Do not write E2E tests for:**
- Page rendering, data display, badge labels, formatted values — use component tests.
- Navbar link visibility — mock the session in a component test.
- Count subtitles or empty states — component tests cover these without a real DB.
- Anything already covered by a component test.

Use the **`playwright-e2e-writer` agent** when E2E tests are genuinely needed. Do not write them inline.

Run tests with: `bun test:e2e`

## Security

- Rate limiting (`express-rate-limit`) on `/api/auth/sign-in`: **production only** (`NODE_ENV === "production"`). Disabled in dev and test to avoid friction.

## Notes

- Claude API integration should include prompt caching on large knowledge-base context to reduce cost.
- Role-based access: middleware should enforce `admin` vs `agent` at the route level.
- Email threading: store `Message-ID` header on tickets so inbound replies match existing tickets.
