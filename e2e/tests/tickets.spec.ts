import { test, expect } from "../fixtures";

test.describe("Tickets list", () => {
  test("lists tickets sorted newest first", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES
        ('ticket-older', 'Older ticket', 'first', 'alice@example.com', 'Alice', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z'),
        ('ticket-newer', 'Newer ticket', 'second', 'bob@example.com', 'Bob', '2026-06-16T10:00:00Z', '2026-06-16T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");

    const rows = authenticatedPage.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Newer ticket");
    await expect(rows.nth(1)).toContainText("Older ticket");
  });

  test("shows empty state when there are no tickets", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.getByText("No tickets found.")).toBeVisible();
  });

  test("clicking a column header re-sorts via the server", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES
        ('ticket-older', 'Aardvark issue', 'first', 'alice@example.com', 'Alice', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z'),
        ('ticket-newer', 'Zebra issue', 'second', 'bob@example.com', 'Bob', '2026-06-16T10:00:00Z', '2026-06-16T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");

    const rows = authenticatedPage.locator("tbody tr");
    // Default sort is createdAt desc: newest ("Zebra issue") first.
    await expect(rows.nth(0)).toContainText("Zebra issue");

    const requestPromise = authenticatedPage.waitForRequest((req) => req.url().includes("/api/tickets?"));
    await authenticatedPage.getByRole("button", { name: "Subject" }).click();
    const request = await requestPromise;
    expect(request.url()).toContain("sortBy=subject");
    expect(request.url()).toContain("sortOrder=asc");

    await expect(rows.nth(0)).toContainText("Aardvark issue");
    await expect(rows.nth(1)).toContainText("Zebra issue");

    // Clicking again reverses to descending.
    const secondRequestPromise = authenticatedPage.waitForRequest((req) => req.url().includes("/api/tickets?"));
    await authenticatedPage.getByRole("button", { name: "Subject" }).click();
    const secondRequest = await secondRequestPromise;
    expect(secondRequest.url()).toContain("sortOrder=desc");

    await expect(rows.nth(0)).toContainText("Zebra issue");
  });
});
