import { test, expect, TEST_USER } from "../fixtures";

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

  test("filtering by status and category narrows results via the server", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", status, category, "createdAt", "updatedAt")
      VALUES
        ('ticket-open-tech', 'Open technical issue', 'first', 'alice@example.com', 'Alice', 'OPEN', 'TECHNICAL_QUESTION', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z'),
        ('ticket-closed-tech', 'Closed technical issue', 'second', 'bob@example.com', 'Bob', 'CLOSED', 'TECHNICAL_QUESTION', '2026-06-11T10:00:00Z', '2026-06-11T10:00:00Z'),
        ('ticket-open-refund', 'Open refund issue', 'third', 'carol@example.com', 'Carol', 'OPEN', 'REFUND_REQUEST', '2026-06-12T10:00:00Z', '2026-06-12T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");
    await expect(authenticatedPage.locator("tbody tr")).toHaveCount(3);

    const rows = authenticatedPage.locator("tbody tr");
    const filterBar = authenticatedPage.getByTestId("ticket-filters");

    // Open the Status dropdown and check "Open".
    const statusRequest = authenticatedPage.waitForRequest((req) => req.url().includes("/api/tickets?"));
    await filterBar.getByRole("button", { name: "Status" }).click();
    await authenticatedPage.getByRole("menuitemcheckbox", { name: "Open" }).click();
    expect((await statusRequest).url()).toContain("status=OPEN");
    await authenticatedPage.keyboard.press("Escape");
    await expect(rows).toHaveCount(2);

    // Additionally filter to Technical Question (AND semantics with the status filter).
    const categoryRequest = authenticatedPage.waitForRequest((req) => req.url().includes("/api/tickets?"));
    await filterBar.getByRole("button", { name: "Category" }).click();
    await authenticatedPage.getByRole("menuitemcheckbox", { name: "Technical Question" }).click();
    expect((await categoryRequest).url()).toContain("category=TECHNICAL_QUESTION");
    await authenticatedPage.keyboard.press("Escape");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Open technical issue");

    // Clear filters restores all tickets.
    await authenticatedPage.getByRole("button", { name: "Clear filters" }).click();
    await expect(rows).toHaveCount(3);
  });

  test("search box filters by subject and requester via the server", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES
        ('ticket-1', 'Cannot reset password', 'first', 'alice@example.com', 'Alice', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z'),
        ('ticket-2', 'Refund for duplicate charge', 'second', 'bob@example.com', 'Bob', '2026-06-11T10:00:00Z', '2026-06-11T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets");
    const rows = authenticatedPage.locator("tbody tr");
    await expect(rows).toHaveCount(2);

    const request = authenticatedPage.waitForRequest((req) => req.url().includes("q=refund"));
    await authenticatedPage.getByPlaceholder("Search subject or requester…").fill("refund");
    expect((await request).url()).toContain("q=refund");

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Refund for duplicate charge");
  });

  test("pagination navigates between pages of results", async ({ authenticatedPage, db }) => {
    const values = Array.from({ length: 25 }, (_, i) => {
      const n = String(i).padStart(2, "0");
      return `('ticket-${n}', 'Ticket number ${n}', 'body', 'user${n}@example.com', 'User ${n}', '2026-06-${(i % 28 + 1).toString().padStart(2, "0")}T10:00:00Z', '2026-06-${(i % 28 + 1).toString().padStart(2, "0")}T10:00:00Z')`;
    }).join(",\n");
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES ${values}
    `);

    await authenticatedPage.goto("/tickets");
    const rows = authenticatedPage.locator("tbody tr");
    await expect(rows).toHaveCount(20);
    await expect(authenticatedPage.getByText("Showing 1–20 of 25 tickets")).toBeVisible();
    await expect(authenticatedPage.getByText("Page 1 of 2")).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Previous" })).toBeDisabled();

    const request = authenticatedPage.waitForRequest((req) => req.url().includes("page=2"));
    await authenticatedPage.getByRole("button", { name: "Next" }).click();
    expect((await request).url()).toContain("page=2");

    await expect(rows).toHaveCount(5);
    await expect(authenticatedPage.getByText("Showing 21–25 of 25 tickets")).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("clicking a ticket subject opens its detail page", async ({ authenticatedPage, db }) => {
    const { rows: userRows } = await db.query(`SELECT id FROM "user" WHERE email = $1`, [TEST_USER.email]);
    const agentId = userRows[0].id;

    await db.query(
      `
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", status, category, "assignedToId", "createdAt", "updatedAt")
      VALUES ('ticket-detail-1', 'Cannot log into my account', 'I keep getting an invalid password error.', 'dana@example.com', 'Dana', 'OPEN', 'TECHNICAL_QUESTION', $1, '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z')
    `,
      [agentId]
    );
    await db.query(
      `
      INSERT INTO "Message" (id, body, "isFromCustomer", "ticketId", "userId", "createdAt")
      VALUES
        ('msg-1', 'I keep getting an invalid password error.', true, 'ticket-detail-1', NULL, '2026-06-10T10:00:00Z'),
        ('msg-2', 'Try resetting your password from the login screen.', false, 'ticket-detail-1', $1, '2026-06-10T11:00:00Z')
    `,
      [agentId]
    );

    await authenticatedPage.goto("/tickets");
    await authenticatedPage.getByRole("link", { name: "Cannot log into my account" }).click();

    await expect(authenticatedPage).toHaveURL("/tickets/ticket-detail-1");
    await expect(authenticatedPage.getByRole("heading", { name: "Cannot log into my account" })).toBeVisible();
    await expect(authenticatedPage.getByText("Dana (dana@example.com)")).toBeVisible();
    await expect(authenticatedPage.getByText("Technical Question")).toBeVisible();

    const messages = authenticatedPage.getByTestId("message");
    await expect(messages).toHaveCount(2);
    await expect(messages.nth(0)).toContainText("Dana");
    await expect(messages.nth(0)).toContainText("I keep getting an invalid password error.");
    await expect(messages.nth(1)).toContainText(TEST_USER.name);
    await expect(messages.nth(1)).toContainText("Try resetting your password from the login screen.");

    await authenticatedPage.getByRole("link", { name: "Back to tickets" }).click();
    await expect(authenticatedPage).toHaveURL("/tickets");
  });

  test("shows an error for a non-existent ticket id", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/tickets/does-not-exist");
    await expect(authenticatedPage.getByText("Ticket not found")).toBeVisible();
  });

  test("assigning a ticket to an agent persists and can be reverted to unassigned", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role)
      VALUES ('agent-2', 'Priya Agent', 'priya@example.com', true, now(), now(), 'AGENT')
    `);
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES ('ticket-assign-1', 'Unassigned ticket', 'body', 'erin@example.com', 'Erin', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets/ticket-assign-1");

    const picker = authenticatedPage.getByRole("button", { name: "Unassigned" });
    await expect(picker).toBeVisible();

    const assignRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/api/tickets/ticket-assign-1")
    );
    await picker.click();
    await authenticatedPage.getByRole("menuitemradio", { name: "Priya Agent" }).click();
    const req1 = await assignRequest;
    expect(req1.postDataJSON()).toEqual({ assignedToId: "agent-2" });
    await expect(authenticatedPage.getByRole("button", { name: "Priya Agent" })).toBeVisible();

    // Persists across reload.
    await authenticatedPage.reload();
    await expect(authenticatedPage.getByRole("button", { name: "Priya Agent" })).toBeVisible();

    // Revert to unassigned.
    const unassignRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/api/tickets/ticket-assign-1")
    );
    await authenticatedPage.getByRole("button", { name: "Priya Agent" }).click();
    await authenticatedPage.getByRole("menuitemradio", { name: "Unassigned" }).click();
    const req2 = await unassignRequest;
    expect(req2.postDataJSON()).toEqual({ assignedToId: null });
    await expect(authenticatedPage.getByRole("button", { name: "Unassigned" })).toBeVisible();
  });

  test("updating status and category persists across reload", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", status, category, "createdAt", "updatedAt")
      VALUES ('ticket-update-1', 'Billing question', 'body', 'erin@example.com', 'Erin', 'OPEN', 'GENERAL_QUESTION', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets/ticket-update-1");

    const statusRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/api/tickets/ticket-update-1")
    );
    await authenticatedPage.getByRole("button", { name: "Open", exact: true }).click();
    await authenticatedPage.getByRole("menuitemradio", { name: "Resolved" }).click();
    expect((await statusRequest).postDataJSON()).toEqual({ status: "RESOLVED" });
    await expect(authenticatedPage.getByRole("button", { name: "Resolved" })).toBeVisible();

    const categoryRequest = authenticatedPage.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/api/tickets/ticket-update-1")
    );
    await authenticatedPage.getByRole("button", { name: "General Question" }).click();
    await authenticatedPage.getByRole("menuitemradio", { name: "Refund Request" }).click();
    expect((await categoryRequest).postDataJSON()).toEqual({ category: "REFUND_REQUEST" });
    await expect(authenticatedPage.getByRole("button", { name: "Refund Request" })).toBeVisible();

    await authenticatedPage.reload();
    await expect(authenticatedPage.getByRole("button", { name: "Resolved" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Refund Request" })).toBeVisible();
  });

  test("replying to a ticket adds it to the conversation thread and persists", async ({ authenticatedPage, db }) => {
    await db.query(`
      INSERT INTO "Ticket" (id, subject, body, "customerEmail", "customerName", "createdAt", "updatedAt")
      VALUES ('ticket-reply-1', 'Need help with export', 'Export keeps failing.', 'finn@example.com', 'Finn', '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z')
    `);
    await db.query(`
      INSERT INTO "Message" (id, body, "isFromCustomer", "ticketId", "createdAt")
      VALUES ('msg-reply-1', 'Export keeps failing.', true, 'ticket-reply-1', '2026-06-10T10:00:00Z')
    `);

    await authenticatedPage.goto("/tickets/ticket-reply-1");

    const messages = authenticatedPage.getByTestId("message");
    await expect(messages).toHaveCount(1);

    const replyTextarea = authenticatedPage.getByPlaceholder("Write a reply…");
    await expect(authenticatedPage.getByRole("button", { name: "Send Reply" })).toBeDisabled();

    await replyTextarea.fill("Can you tell me which file format you're exporting to?");

    const request = authenticatedPage.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/tickets/ticket-reply-1/messages")
    );
    await authenticatedPage.getByRole("button", { name: "Send Reply" }).click();
    expect((await request).postDataJSON()).toEqual({ body: "Can you tell me which file format you're exporting to?" });

    await expect(messages).toHaveCount(2);
    await expect(messages.nth(1)).toContainText(TEST_USER.name);
    await expect(messages.nth(1)).toContainText("Can you tell me which file format you're exporting to?");
    await expect(replyTextarea).toHaveValue("");

    // Persists across reload.
    await authenticatedPage.reload();
    await expect(messages).toHaveCount(2);
    await expect(messages.nth(1)).toContainText("Can you tell me which file format you're exporting to?");
  });
});
