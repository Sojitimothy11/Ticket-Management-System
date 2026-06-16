import { execSync } from "child_process";
import { Client } from "pg";
import path from "path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:7266@localhost:5432/ticket-management-system-test";

const DB_NAME = "ticket-management-system-test";

// Admin connection to create the database (connects to the default postgres db)
const ADMIN_URL = TEST_DATABASE_URL.replace(`/${DB_NAME}`, "/postgres");

async function globalSetup() {
  // Create the test database if it doesn't exist
  const adminClient = new Client({ connectionString: ADMIN_URL });
  await adminClient.connect();

  const { rowCount } = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [DB_NAME]
  );

  if (!rowCount) {
    await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`[e2e] Created test database: ${DB_NAME}`);
  }

  await adminClient.end();

  // Run all pending migrations against the test database
  execSync("bunx prisma migrate deploy", {
    cwd: path.join(__dirname, "../server"),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  console.log("[e2e] Test database ready.");
}

export default globalSetup;
