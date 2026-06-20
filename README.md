# TicketDesk

An AI-powered helpdesk ticket management system. Customers email support and a ticket is created automatically; an AI worker tries to resolve it from a knowledge base, and if it can't, agents triage, classify, and reply from a web dashboard — replies (with optional attachments) go back out over email, and the customer's email replies land back on the same ticket.

## Features

- **Email-in, email-out ticketing** — inbound emails create/append to tickets via a SendGrid Inbound Parse webhook; agent replies are sent back to the customer by email. Threading is handled by tagging the ticket ID into the subject line.
- **File attachments** — agents can attach files to replies; customers can attach files to inbound emails. Both are stored in Postgres and downloadable from the ticket.
- **AI auto-resolve** — a background worker checks new tickets against `server/knowledge_base.md` and auto-replies + resolves the ticket when it can answer confidently, without an agent.
- **AI classification** — every new ticket is automatically categorized (General Question / Technical Question / Refund Request) in the background.
- **AI assist for agents** — "Polish" a draft reply, and "Summarize" a ticket's conversation, on demand from the ticket detail page.
- **Ticket list** — server-side sorting, filtering (status, category, search), and pagination; bulk select for trash/restore/priority actions.
- **Recycle Bin** — soft-delete tickets (trash/restore) with a separate permanent-delete step.
- **My Priority** — a personal, per-user "flag this ticket" marker — never shared between users.
- **Dashboard** — ticket volume, status/category breakdowns, AI vs human resolution rate, and average resolution time.
- **User management (admin only)** — create, edit, and delete agent/admin accounts.
- **Role-based access** — `ADMIN` and `AGENT` roles; ticket assignment and user management are admin-only.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query/Table, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express 5, TypeScript — run with [Bun](https://bun.sh) |
| Database | PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg`) |
| Auth | [better-auth](https://better-auth.com) (email/password, database sessions, admin plugin) |
| Background jobs | [pg-boss](https://github.com/timgit/pg-boss) (Postgres-backed queue) for AI classification and auto-resolve workers |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/openai`), model `gpt-5-nano` |
| Email | `@sendgrid/mail` (outbound) and `@sendgrid/inbound-mail-parser` (inbound webhook) |
| File uploads | `multer` (memory storage; bytes persisted straight to Postgres) |
| Testing | Bun's test runner + Testing Library (unit), Playwright (e2e) |

## Monorepo Structure

```
/client   React frontend (Vite)
/server   Express backend (Bun)
/e2e      Playwright end-to-end tests (own workspace, own test DB)
```

Managed as Bun workspaces from the repo root.

## Prerequisites

- [Bun](https://bun.sh) (latest)
- PostgreSQL running locally (or a connection string to one)
- A SendGrid account (for email — optional for local UI/ticket work, required for the inbound/outbound email flow)
- An OpenAI API key (for the AI classification, auto-resolve, polish, and summarize features)

## Local Setup

1. **Install dependencies** (from the repo root):
   ```bash
   bun install
   ```

2. **Configure the server environment** — copy `server/.env.example` to `server/.env` and fill it in:

   | Variable | Purpose |
   |---|---|
   | `DATABASE_URL` | Postgres connection string |
   | `PORT` | Port the API listens on (default `3000`) |
   | `BETTER_AUTH_SECRET` | Session signing secret — generate with `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | Public URL of the API (`http://localhost:3000` locally) |
   | `FRONTEND_URL` | Public URL of the client (`http://localhost:5173` locally) — used for CORS and auth's trusted origins |
   | `SUPPORT_EMAIL_ADDRESS` | The address tickets are sent from / inbound mail is addressed to |
   | `INBOUND_EMAIL_SECRET` | Random secret embedded in the inbound webhook URL — generate with `openssl rand -hex 32` |
   | `OPENAI_API_KEY` | Powers ticket classification, auto-resolve, polish, and summarize |
   | `SENDGRID_API_KEY` | Sends outbound reply emails |

3. **Set up the database**:
   ```bash
   cd server
   bunx prisma migrate dev
   ```

4. **Run both apps** (in separate terminals, from their respective directories):
   ```bash
   cd server && bun dev   # http://localhost:3000
   cd client && bun dev   # http://localhost:5173
   ```

5. **Create the first admin** — sign up normally through the UI, then promote that account once via SQL (new signups always default to `AGENT` — there's no self-service way to become admin, by design):
   ```sql
   UPDATE "user" SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```
   From there, that admin can create/promote other users from the in-app Users page.

6. **(Optional) Wire up real email** — SendGrid's Inbound Parse needs a public URL to deliver to, so for local dev you'll need a tunnel (e.g. `ngrok http 3000`) and to point SendGrid's Inbound Parse destination at:
   ```
   https://<your-tunnel-domain>/api/email/inbound/<INBOUND_EMAIL_SECRET>
   ```

## Scripts

| Location | Command | What it does |
|---|---|---|
| `/server` | `bun dev` | Start the API with hot reload |
| `/server` | `bun run generate` | Regenerate the Prisma client (run after every schema/migration change) |
| `/server` | `bun run migrate:deploy` | Apply pending migrations (production-safe, non-interactive) |
| `/client` | `bun dev` | Start the Vite dev server |
| `/client` | `bun run build` | Type-check and build the production client bundle |
| `/client` | `bun test` | Run client unit tests |
| `/e2e` | `bun run test` | Run the full Playwright e2e suite (auto-provisions its own test DB) |
| repo root | `bun run build` | Production build: builds the client, then regenerates the Prisma client — used by the deploy pipeline |
| repo root | `bun run start` | Production start: applies pending migrations, then starts the server (which also serves the built client) |

## Architecture Notes

- **Single deployable service**: in production, the Express server serves the built client (`client/dist`) as static files and falls back to `index.html` for client-side routes, so the API and frontend share one origin. This is deliberate — Better Auth's session cookies don't reliably survive two separate origins (e.g. two separate Railway services) without a shared parent domain, so keeping everything same-origin avoids that entirely.
- **Email threading**: outbound subjects get a ticket-ID tag appended (see `server/src/lib/email.ts`); inbound mail is matched back to its ticket by parsing that tag out of the subject. Unmatched mail creates a new ticket.
- **AI workers run via pg-boss**, not inline in the request — a new ticket is classified and (separately) evaluated for auto-resolution as background jobs, so the inbound webhook returns immediately.
- **Attachments** are stored as `Bytes` directly in Postgres (`Attachment` model, capped at 10MB/file, 5 files/message) rather than an external object store — there's no cloud storage SDK in this project, and ticket volume doesn't currently justify one.
- **"My Priority"** is a private per-user marker (`TicketPriority` join table), deliberately never written onto the `Ticket` row itself, so one user's priority flag can never leak to or overwrite another user's.

## Deployment (Railway)

The app deploys as a **single Railway service** (not split into separate client/server services — see the architecture note above on why). `railway.json` at the repo root configures the build/start commands.

1. Create a Railway project from this GitHub repo, leaving the service's Root Directory at the repo root.
2. Add a PostgreSQL plugin to the project.
3. Set these environment variables on the service:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
   - `BETTER_AUTH_SECRET`, `INBOUND_EMAIL_SECRET` → generate fresh secrets
   - `OPENAI_API_KEY`, `SENDGRID_API_KEY`, `SUPPORT_EMAIL_ADDRESS`
   - `BETTER_AUTH_URL`, `FRONTEND_URL` → both set to the service's public Railway URL once you've generated one (Settings → Networking → Generate Domain)
   - `VITE_API_URL` → leave **completely unset** (don't set it to `""` either — some dashboards store that as a literal two-character string, not an empty value). Unset correctly resolves to "same origin" in a production build.
4. Deploy, then update SendGrid's Inbound Parse webhook to point at `https://<your-domain>/api/email/inbound/<INBOUND_EMAIL_SECRET>`.
5. Sign up through the live site, then promote that account to `ADMIN` directly in Railway's Postgres (Data tab → SQL query, same `UPDATE "user" SET role = 'ADMIN' ...` as local setup).

## Roles & Access

- **Admin** — everything an agent can do, plus user management (create/edit/delete users, assign roles) and ticket assignment.
- **Agent** — view, manage, and respond to tickets; cannot manage users.

New signups always default to `AGENT`; there is no public way to self-assign `ADMIN`.

## Ticket Statuses & Categories

- **Statuses**: `PROCESSING` (just received, AI is evaluating it) → `OPEN` / `RESOLVED` / `CLOSED`
- **Categories**: General Question, Technical Question, Refund Request
