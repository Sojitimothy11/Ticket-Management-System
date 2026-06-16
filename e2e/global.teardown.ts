import { Client } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:7266@localhost:5432/ticket-management-system-test";

async function globalTeardown() {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();

  // Leave the schema intact but wipe all test data after the run
  await client.query(`
    TRUNCATE TABLE "Message", "Ticket", "rateLimit", verification, account, session, "user"
    RESTART IDENTITY CASCADE
  `);

  await client.end();
  console.log("[e2e] Test database cleaned up.");
}

export default globalTeardown;
