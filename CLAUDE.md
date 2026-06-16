# Ticket Management System

## Project Overview
An AI-powered helpdesk ticket management system. See `project-scope.md` for features and `tech-stack.md` for the chosen stack.

## Stack
- **Frontend**: React 19 + TypeScript + Vite + React Router (port 5173)
- **Backend**: Node.js + Express 5 + TypeScript, run with Bun (port 3000)
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Claude API (Anthropic)
- **Email**: SendGrid or Mailgun

## Monorepo Structure
```
/client   React frontend
/server   Express backend
```

Run with Bun workspaces. Install: `bun install` from root. Start each app with `bun dev` inside its directory.

## Documentation
Always use Context7 MCP to fetch up-to-date documentation before writing code that involves any library or framework — including React, Express, Prisma, Vite, React Router, the Anthropic SDK, and any other dependency in this project.

Steps:
1. `resolve-library-id` with the library name and the question
2. `query-docs` with the resolved ID and the full question
3. Write code based on the fetched docs, not training data