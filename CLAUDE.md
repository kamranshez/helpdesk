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
├── package.json     # Bun workspaces root
└── bun.lock
```

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | React 19, TypeScript, Tailwind CSS v4, React Router v7, Vite 6 |
| Backend     | Node/Bun, Express v5, TypeScript                |
| Database    | PostgreSQL via Prisma ORM                       |
| Auth        | Session-based (database sessions)               |
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

## Notes

- Claude API integration should include prompt caching on large knowledge-base context to reduce cost.
- Role-based access: middleware should enforce `admin` vs `agent` at the route level.
- Email threading: store `Message-ID` header on tickets so inbound replies match existing tickets.
