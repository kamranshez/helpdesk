# Helpdesk — Claude Code Project Memory

## Project Overview

AI-powered ticket management system for support teams. Agents receive tickets (via email or manual creation), and AI handles classification, summarisation, and suggested replies backed by a knowledge base.

**Users:** Admin (manages agents) and Agent (manages tickets).
**Ticket statuses:** Open · Resolved · Closed
**Ticket categories:** General Question · Technical Question · Refund Request

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

### Client source layout

```
client/src/
├── lib/
│   ├── auth-client.ts       # Better Auth client (authClient) — import everywhere auth is needed
│   ├── ticket-api.ts        # All ticket/reply/agent axios calls (fetchTicket, patchTicket, postReply, …)
│   └── ticket-utils.ts      # STATUS_LABELS, CATEGORY_LABELS, statusVariant, formatDate, getInitials
├── components/
│   ├── Navbar.tsx
│   ├── tickets/
│   │   ├── ReplyBubble.tsx       # Single reply display
│   │   ├── ReplyThread.tsx       # Reply list + send form (owns its own query + mutation)
│   │   └── TicketProperties.tsx  # Status / category / assigned-to sidebar (owns its mutations)
│   └── ui/                  # shadcn/ui components
├── pages/
│   ├── LoginPage.tsx
│   ├── UsersPage.tsx
│   ├── TicketsPage.tsx       # Ticket list with filters, sort, pagination
│   └── TicketDetailPage.tsx  # Thin shell — renders TicketProperties + ReplyThread
└── App.tsx                  # Router, ProtectedRoute, AdminRoute
```

### Server source layout

```
server/src/
├── lib/
│   ├── auth.ts    # Better Auth config
│   ├── db.ts      # Prisma client
│   └── ai.ts      # Vercel AI SDK — openai client + AI service functions
├── middleware/
│   └── auth.ts    # requireAuth, requireAdmin
├── routes/
│   ├── tickets.ts   # GET/PATCH /api/tickets, GET/POST /api/tickets/:id/replies, POST /api/tickets/:id/polish
│   ├── users.ts     # User CRUD (admin-only) + GET /api/users/agents
│   └── webhooks.ts  # POST /api/webhooks/email — inbound email → ticket
└── app.ts           # Express app setup, route mounting order
```

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, React Router v7, Vite 6, shadcn/ui, Axios, TanStack Query |
| Backend  | Node/Bun, Express v5, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth     | Session-based (database sessions) via Better Auth |
| AI       | Vercel AI SDK (`ai` + `@ai-sdk/openai`) with `gpt-4.1-nano` — reply polishing, classification, summaries |
| Email    | SendGrid or Mailgun (inbound webhook + outbound) |

## Dev Commands

```bash
bun dev            # client + server in watch mode
bun run dev:server
bun run dev:client
bun typecheck      # type-check all packages
bun test:e2e       # Playwright E2E (starts servers automatically)

cd client && bun run test        # component tests (Vitest)
cd client && bun run test:watch
```

## Fetching Up-to-Date Documentation

Use the **context7 MCP server** before writing code that touches any library. Key libraries:

`react`, `react-router` (v7), `tailwindcss` (v4), `vite`, `express` (v5), `prisma`, `@anthropic-ai/sdk`, `bun`

```
mcp__context7__resolve-library-id  { libraryName: "express" }
mcp__context7__query-docs  { context7CompatibleLibraryID: "/expressjs/express", topic: "..." }
```

Always resolve before querying — IDs are not guessable.

## Key Conventions

- TypeScript strict mode on both client and server.
- ES modules (`"type": "module"`) throughout.
- Server entry: `server/src/index.ts`; client entry: `client/src/main.tsx`.
- Tailwind CSS v4 uses `@import "tailwindcss"` — no config file required for basic use.
- Express v5 has native async error propagation — no `express-async-errors` needed.
- Prisma migrations live in `server/prisma/migrations/`.
- `.env` at `server/.env` — never commit.
- Always import Prisma enums from the generated client (`server/generated/prisma/enums.js`) — never hardcode enum strings.

## shadcn/ui

Installed in `client/` — style: `base-nova`, base color: `neutral`, CSS variables enabled, icon library: `lucide`.

- Add components: `npx shadcn@latest add <component>` (run from project root or `client/`)
- Components live in `client/src/components/ui/`
- Currently installed: `button`, `input`, `label`, `card`, `badge`, `alert`, `select`, `skeleton`, `textarea`
- The `form` component is **not available** in `base-nova` — use `Label` + `Input` directly with react-hook-form `register`
- The `Button` component does **not** support `asChild` in `base-nova` — use a plain `<Link>` with Tailwind classes for nav links
- Path alias `@/*` → `src/*` in both `tsconfig.json` and `vite.config.ts`

## UI Conventions

- Use shadcn CSS variable classes everywhere — **never** raw Tailwind color classes like `text-gray-500`. Use `text-muted-foreground`, `bg-background`, `text-destructive`, `border-border`, etc.
- Loading spinners: `<Loader2 className="animate-spin" />` from `lucide-react`
- API-level errors: `<Alert variant="destructive">` with `<AlertCircle>` icon
- Field-level validation errors: `<p className="text-xs text-destructive">`
- Page layouts: `min-h-screen bg-muted` as the outer wrapper
- Chrome autofill override is set globally in `src/index.css` — no per-input fix needed

## Shared Core Package (`@helpdesk/core`)

Imported by both `client` and `server`. Holds Zod schemas and their inferred types.

**Rules:**
- Define schemas in `core/src/schemas/<resource>.ts`, export from `core/src/index.ts`.
- **Always use explicit named re-exports in `core/src/index.ts`** — never `export *`. Bun caches the export list from `export *` and won't pick up new names, causing runtime errors.
- Server validates with `schema.safeParse(req.body)`; client passes the same schema to `zodResolver`.
- Never copy a schema into client or server — always import from `@helpdesk/core`.

**Reference:** `core/src/schemas/tickets.ts`, consumed in `client/src/pages/TicketsPage.tsx` and `server/src/routes/tickets.ts`.

## Form Validation

Use **react-hook-form** + **Zod v4** with `@hookform/resolvers/zod`.

**Zod v4 API — top-level primitives (not chained off `z.string()`):**

```ts
z.email()   // not z.string().email()
z.url()     // not z.string().url()
z.uuid()    // not z.string().uuid()
```

- Field errors: `<p className="text-xs text-destructive">{errors.field?.message}</p>`
- Pass `aria-invalid={!!errors.field}` to `<Input>` to activate the red-border style
- API errors: `setError("root", { message })` → shown in a destructive `<Alert>`
- Disable submit while `mutation.isPending`

**Reference implementation:** `client/src/pages/UsersPage.tsx`

## Data Fetching

- **Always use Axios** — never the native `fetch` API.
- **Always use TanStack Query** (`useQuery`, `useMutation`) — never `useEffect` + `useState` for fetching.
- Use `withCredentials: true` on all Axios calls.
- **Ticket API calls live in `client/src/lib/ticket-api.ts`** — do not add inline fetchers to ticket pages or components. Add new ticket-related calls there.
- Shared display helpers (labels, formatDate, etc.) live in `client/src/lib/ticket-utils.ts`.

## Authentication

Better Auth is fully wired up. Sign-up is **disabled** — admins create users via seed scripts or the Users page.

**Seeded accounts:**

| Email | Password | Role |
|---|---|---|
| _(set via `SEED_ADMIN_EMAIL` env var)_ | `SEED_ADMIN_PASSWORD` | `admin` |
| `agent@example.com` | `password123` | `agent` |

**Key client APIs** (import `authClient` from `@/lib/auth-client`):

| Usage | Code |
|---|---|
| Session / loading | `const { data: session, isPending } = authClient.useSession()` |
| Sign in | `authClient.signIn.email({ email, password })` |
| Sign out | `authClient.signOut()` |
| Role | `session?.user.role` → `"admin"` or `"agent"` |

**Typing `role` on the client** — cast instead of `inferAdditionalFields` (server import not available):

```ts
const role = (session?.user as { role?: "admin" | "agent" } | undefined)?.role;
```

**Route protection:** `<ProtectedRoute>` and `<AdminRoute>` are in `App.tsx`. `<AdminRoute>` redirects unauthenticated users to `/login` and non-admins to `/`.

**Server critical detail:** the auth handler must be registered **before** `express.json()` — Better Auth reads the raw body itself.

**Server env vars:**

| Variable | Purpose |
|---|---|
| `TRUSTED_ORIGIN` | Comma-separated allowed origins for Better Auth |
| `CLIENT_URL` | Express CORS origin (default `http://localhost:5173`) |
| `BETTER_AUTH_SECRET` | Signs session tokens (required in production) |
| `DATABASE_URL` | PostgreSQL connection string |

## Testing Strategy

**Default to component tests. Use E2E only for flows that cannot be tested at the component level.**

### Component Testing (Vitest + React Testing Library)

Tests live alongside their source file as `<Name>.test.tsx`. Run from `client/`.

**Setup:**
- `client/src/test/setup.ts` — imports `@testing-library/jest-dom` globally.
- `client/src/test/render.tsx` — exports `renderWithProviders(ui)`. **Always use this instead of bare `render`.**

**Mocking conventions:**
- `vi.mock("axios")` at the top, then `vi.spyOn(axios, "get")` / `vi.spyOn(axios, "post")`.
- Mock `react-router` to stub `useNavigate` and `Link`.
- Mock `@/lib/auth-client` to return a fixed session.
- `vi.resetAllMocks()` in `beforeEach`.

**Cover:** loading state, data render, empty state, error state, correct Axios call (URL + `withCredentials`), form validation, mutation success/failure.

**Reference tests:** `TicketsPage.test.tsx`, `TicketDetailPage.test.tsx`, `components/tickets/ReplyThread.test.tsx`

### E2E Testing (Playwright)

**The rule:** write an E2E test only if the behaviour requires something a unit test cannot provide — a real session, a real database record, real middleware enforcement, or a real server response. Everything else belongs in a component test.

**Keep in E2E:**
- Auth flows that depend on a real session: login success, server-side auth errors (wrong password), logout, already-logged-in redirect.
- Route protection that requires a real session: unauthenticated → `/login`, role-based redirect (agent → `/`).
- Role-based route access that must be proven with a real session (e.g. admin can reach `/users`, agent cannot).
- Pure API contracts: status codes, response shapes, error bodies — against the real Express + Prisma stack.
- Full-stack CRUD flows where the goal is to verify data actually persists through the server + DB (create / edit / delete users).

**Never in E2E (use component tests instead):**
- Client-side form validation errors (empty fields, invalid formats) — mock axios, render the page.
- Page rendering, data display, badge labels, empty states, formatted values.
- Navbar link visibility by role — mock the session in a component test.
- Back links, headings, static UI elements — unit tests cover these.
- Error messages from mocked API calls (e.g. 404 "Ticket not found") — already covered by unit tests with mocked axios.

**Existing E2E specs:**
- `auth.spec.ts` — login (admin + agent), server-side auth errors, already-logged-in redirect, unauthenticated route protection, role-based access (`/users`), sign-out
- `tickets.spec.ts` — agent can access `/tickets`; unauthenticated redirect
- `ticket-detail.spec.ts` — unauthenticated redirect for `/tickets/:id`; agent and admin can view a real ticket
- `tickets-api.spec.ts` — 401 on all ticket endpoints (unauthenticated); GET /api/tickets shape + filters; GET/PATCH/:id shapes, 404s, 400 validation; replies CRUD + senderType; persistence
- `users.spec.ts` — admin CRUD: create, edit, delete (full-stack persistence only — list rendering is in unit tests)
- `webhooks.spec.ts` — ticket creation (all fields + required-only + categories), auth rejection, validation, duplicate messageId

Use the **`playwright-e2e-writer` agent** when E2E is genuinely needed.

## AI Service

Packages: `ai` (Vercel AI SDK core) + `@ai-sdk/openai` (OpenAI provider). Both installed in `server/`.

**Pattern — add a new AI capability:**

1. **Schema** — add input schema + type to `core/src/schemas/tickets.ts` (or the relevant resource schema), export from `core/src/index.ts` with an explicit named export.
2. **Service function** — add a function to `server/src/lib/ai.ts`. Keep all model config, system prompts, and `generateText`/`streamText` calls here. Export only the function.
3. **Route** — validate with `schema.safeParse(req.body)`, call the service function, return the result. No AI SDK imports in route files.

**`server/src/lib/ai.ts` structure:**

```ts
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function polishReply(draft: string, ticketSubject: string): Promise<string> { … }
// add further exported functions here
```

**Env var:** `OPENAI_API_KEY` in `server/.env` — validated at startup in `ai.ts` with `throw new Error(...)`.

**Model:** `gpt-4.1-nano` (fast, low-cost). Upgrade to `gpt-4.1` or `gpt-4.1-mini` for tasks needing higher accuracy.

**Reference:** `server/src/lib/ai.ts`, `server/src/routes/tickets.ts` (`POST /:id/polish`), `core/src/schemas/tickets.ts` (`polishReplySchema`).

## Security

- Rate limiting on `/api/auth/sign-in`: **production only** (`NODE_ENV === "production"`).
