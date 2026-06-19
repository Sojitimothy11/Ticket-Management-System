import { test, expect } from "../fixtures";

test.describe("Recycle Bin", () => {
  test("main list excludes deleted tickets and the Recycle Bin only shows deleted tickets", async ({
    authenticatedPage,
    db,
  }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES
        ('ticket-active', 'Still active', 'first', 'a@example.com', 'A', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', NULL),
        ('ticket-trashed', 'In the bin', 'second', 'b@example.com', 'B', '2026-06-11T10:00:00Z', '2026-06-11T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.locator("tbody tr")).toHaveCount(1);
    await expect(authenticatedPage.getByRole("link", { name: "Still active" })).toBeVisible();
    await expect(authenticatedPage.getByText("In the bin")).not.toBeVisible();

    await authenticatedPage.goto("/recycle-bin");
    await expect(authenticatedPage.locator("tbody tr")).toHaveCount(1);
    await expect(authenticatedPage.getByRole("link", { name: "In the bin" })).toBeVisible();
    await expect(authenticatedPage.getByText("Still active")).not.toBeVisible();
  });

  test("the Recycle Bin nav item is active while viewing it", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/recycle-bin");
    await expect(authenticatedPage.getByRole("heading", { name: "Recycle Bin" })).toBeVisible();
    await expect(authenticatedPage.getByRole("link", { name: "Recycle Bin" })).toHaveAttribute("aria-current", "page");
  });

  test("restoring a single ticket moves it back to the main list immediately", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES ('ticket-restore', 'Bring me back', 'body', 'r@example.com', 'R', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/recycle-bin");
    const restoreRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/tickets/ticket-restore/restore")
    );
    await authenticatedPage.getByRole("button", { name: 'Restore "Bring me back"' }).click();
    await restoreRequest;

    await expect(authenticatedPage.getByText("Recycle Bin is empty.")).toBeVisible();
    await expect(authenticatedPage.getByText('Restored "Bring me back" to Tickets.')).toBeVisible();

    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.getByRole("link", { name: "Bring me back" })).toBeVisible();
  });

  test("bulk restore moves all selected tickets back and clears the selection", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES
        ('ticket-r1', 'Restore One', 'first', 'r1@example.com', 'R1', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', '2026-06-12T10:00:00Z'),
        ('ticket-r2', 'Restore Two', 'second', 'r2@example.com', 'R2', '2026-06-11T10:00:00Z', '2026-06-11T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/recycle-bin");
    await authenticatedPage.getByRole("checkbox", { name: "Select all visible tickets" }).click();

    const bulkRestoreRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/tickets/bulk/restore")
    );
    await authenticatedPage.getByRole("button", { name: "Restore selected" }).click();
    await bulkRestoreRequest;

    await expect(authenticatedPage.getByText("Recycle Bin is empty.")).toBeVisible();
    await expect(authenticatedPage.getByRole("toolbar", { name: "Bulk ticket actions" })).toHaveCount(0);

    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.locator("tbody tr")).toHaveCount(2);
  });

  test("permanently deleting a single ticket requires confirmation and removes it entirely", async ({
    authenticatedPage,
    db,
  }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES ('ticket-perm', 'Gone for good', 'body', 'p@example.com', 'P', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/recycle-bin");
    await authenticatedPage.getByRole("button", { name: 'Permanently delete "Gone for good"' }).click();

    const dialog = authenticatedPage.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This action cannot be undone.")).toBeVisible();

    // Cancel first to confirm the ticket is NOT removed without confirmation.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(authenticatedPage.getByRole("link", { name: "Gone for good" })).toBeVisible();

    await authenticatedPage.getByRole("button", { name: 'Permanently delete "Gone for good"' }).click();
    const permanentDeleteRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "DELETE" && req.url().includes("/api/tickets/ticket-perm/permanent")
    );
    await authenticatedPage.getByRole("button", { name: "Delete Permanently" }).click();
    await permanentDeleteRequest;

    await expect(authenticatedPage.getByText("Recycle Bin is empty.")).toBeVisible();
    await expect(authenticatedPage.getByText("Permanently deleted 1 ticket.")).toBeVisible();

    const { rows } = await db.query(`SELECT id FROM "Ticket" WHERE id = $1`, ["ticket-perm"]);
    expect(rows).toHaveLength(0);
  });

  test("bulk permanently deleting selected tickets removes them all and clears the selection", async ({
    authenticatedPage,
    db,
  }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES
        ('ticket-p1', 'Purge One', 'first', 'p1@example.com', 'P1', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', '2026-06-12T10:00:00Z'),
        ('ticket-p2', 'Purge Two', 'second', 'p2@example.com', 'P2', '2026-06-11T10:00:00Z', '2026-06-11T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/recycle-bin");
    await authenticatedPage.getByRole("checkbox", { name: "Select all visible tickets" }).click();
    await authenticatedPage.getByRole("button", { name: "Permanently delete selected" }).click();

    const dialog = authenticatedPage.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "Permanently Delete Tickets" })).toBeVisible();

    const bulkPermanentDeleteRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/tickets/bulk/permanent-delete")
    );
    await dialog.getByRole("button", { name: "Delete Permanently" }).click();
    await bulkPermanentDeleteRequest;

    await expect(authenticatedPage.getByText("Recycle Bin is empty.")).toBeVisible();
    await expect(authenticatedPage.getByRole("toolbar", { name: "Bulk ticket actions" })).toHaveCount(0);

    const { rows } = await db.query(`SELECT id FROM "Ticket" WHERE id IN ('ticket-p1', 'ticket-p2')`);
    expect(rows).toHaveLength(0);
  });

  test("the Recycle Bin badge in the navbar reflects the deleted ticket count", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt", "deletedAt")
      VALUES ('ticket-badge', 'Counted', 'body', 'c@example.com', 'C', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.getByRole("link", { name: "Recycle Bin 1" })).toBeVisible();
  });
});
