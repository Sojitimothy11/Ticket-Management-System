import { defineConfig, devices } from "@playwright/test";
import path from "path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:7266@localhost:5432/ticket-management-system-test";

const TEST_API_PORT = Number(process.env.TEST_API_PORT ?? 3001);
const TEST_APP_PORT = Number(process.env.TEST_APP_PORT ?? 5174);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }]],

  use: {
    baseURL: `http://localhost:${TEST_APP_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  globalSetup: "./global.setup.ts",
  globalTeardown: "./global.teardown.ts",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "bun run start",
      url: `http://localhost:${TEST_API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: path.join(__dirname, "../server"),
      env: {
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: String(TEST_API_PORT),
        BETTER_AUTH_URL: `http://localhost:${TEST_API_PORT}`,
        BETTER_AUTH_SECRET:
          process.env.BETTER_AUTH_SECRET ?? "e2e-test-secret-do-not-use-in-prod",
        FRONTEND_URL: `http://localhost:${TEST_APP_PORT}`,
      },
    },
    {
      command: `bunx vite --port ${TEST_APP_PORT}`,
      url: `http://localhost:${TEST_APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      cwd: path.join(__dirname, "../client"),
      env: {
        VITE_API_URL: `http://localhost:${TEST_API_PORT}`,
      },
    },
  ],
});
