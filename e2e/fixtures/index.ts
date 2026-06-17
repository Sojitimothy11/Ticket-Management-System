import { test as baseTest, expect, type Page } from "@playwright/test";
import { Client } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:7266@localhost:5432/ticket-management-system-test";

export const TEST_API_URL =
  `http://localhost:${process.env.TEST_API_PORT ?? 3001}`;

export const TEST_USER = {
  name: "Test Agent",
  email: "agent@test.example",
  password: "password123",
};

type Fixtures = {
  db: Client;
  authenticatedPage: Page;
};

export const test = baseTest.extend<Fixtures>({
  // Runs automatically before every test — wipes all app data for isolation
  db: [
    async ({}, use) => {
      const client = new Client({ connectionString: TEST_DATABASE_URL });
      await client.connect();

      await client.query(`
        TRUNCATE TABLE "Message", "Ticket", "rateLimit", verification, account, session, "user"
        RESTART IDENTITY CASCADE
      `);

      await use(client);
      await client.end();
    },
    { auto: true, scope: "test" },
  ],

  // Provides a page that is already signed in as TEST_USER
  authenticatedPage: async ({ page }, use) => {
    // Create the test user via API (db has already been wiped by the auto fixture)
    const res = await page.request.post(`${TEST_API_URL}/api/auth/sign-up/email`, {
      data: TEST_USER,
    });
    expect(res.ok(), "Test user sign-up should succeed").toBeTruthy();

    // Sign-up logs the browser context in immediately; clear that session so we can
    // exercise the actual sign-in form below instead of bouncing off the redirect-if-authed check.
    await page.context().clearCookies();

    // Sign in through the UI so the session cookie lands in the browser context
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("/");

    await use(page);
  },
});

export { expect } from "@playwright/test";
