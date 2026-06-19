import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const OUT = "design-screenshots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto(`${BASE}/login`);
  await page.waitForSelector("text=Sign In");
  await page.screenshot({ path: `${OUT}/login.png` });

  await page.goto(`${BASE}/signup`);
  await page.waitForSelector("text=Create Account");
  await page.screenshot({ path: `${OUT}/signup.png` });

  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("you@example.com").fill("design-check-1781831952421@test.example");
  await page.getByPlaceholder("••••••••").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/after-login-click.png` });

  await page.waitForURL(`${BASE}/`, { timeout: 10_000 });
  await page.waitForSelector("text=Total Tickets", { timeout: 15_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector("text=Tickets");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/tickets.png`, fullPage: true });

  await page.goto(`${BASE}/tickets`);
  const firstSubjectLink = page.locator("table tbody tr td a").first();
  await firstSubjectLink.waitFor();
  await firstSubjectLink.click();
  await page.waitForSelector("text=Conversation");
  await page.screenshot({ path: `${OUT}/ticket-detail.png`, fullPage: true });

  await page.goto(`${BASE}/users`);
  await page.waitForSelector("text=Member Since");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/users.png`, fullPage: true });

  console.log("Console errors:", errors);
  await browser.close();
}

main();
