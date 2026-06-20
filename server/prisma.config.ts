import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `generate` doesn't need a live connection, so fall back to a placeholder rather than
    // hard-failing config load when DATABASE_URL isn't set yet (e.g. during a Railway build,
    // before the DB is wired up). Commands that actually connect (migrate, studio) will still
    // fail with a clear connection error if DATABASE_URL is genuinely missing.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder",
  },
});
