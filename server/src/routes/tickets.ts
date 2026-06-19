import { Router } from "express";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { TicketStatus, TicketCategory, type Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { sendReplyEmail } from "../lib/sendEmail";
import { attachmentUpload, attachmentSelect, filesToAttachmentData, MAX_ATTACHMENTS_PER_MESSAGE } from "../lib/attachments";

const router = Router();

const sortableFields: Record<string, (order: "asc" | "desc") => Prisma.TicketOrderByWithRelationInput> = {
  subject: (order) => ({ subject: order }),
  status: (order) => ({ status: order }),
  category: (order) => ({ category: order }),
  customerName: (order) => ({ customerName: order }),
  createdAt: (order) => ({ createdAt: order }),
  assignedTo: (order) => ({ assignedTo: { name: order } }),
};

function parseEnumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (typeof value !== "string" || !value) return [];
  return value.split(",").filter((v): v is T => allowed.includes(v as T));
}

function parseIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((v): v is string => typeof v === "string" && v.length > 0)) return null;
  return value;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Tickets are held in PROCESSING while the AI auto-resolve job is running and are never
// shown in the list (filterable or otherwise) — only OPEN/RESOLVED/CLOSED are listable.
const listableStatuses = Object.values(TicketStatus).filter((s) => s !== "PROCESSING");

const ticketDetailSelect = {
  id: true,
  subject: true,
  body: true,
  status: true,
  category: true,
  customerEmail: true,
  customerName: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
  deletedAt: true,
  messages: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      isFromCustomer: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      attachments: { select: attachmentSelect },
    },
  },
} satisfies Prisma.TicketSelect;

router.get("/", requireAuth, async (req, res) => {
  const { sortBy, sortOrder, status, category, q, page, pageSize, trashed } = req.query as {
    sortBy?: string;
    sortOrder?: string;
    status?: string;
    category?: string;
    q?: string;
    page?: string;
    pageSize?: string;
    trashed?: string;
  };

  const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  const buildOrderBy = sortableFields[sortBy ?? ""] ?? sortableFields.createdAt;
  const orderBy = buildOrderBy(order);

  const isTrashed = trashed === "true";
  const statuses = parseEnumList(status, listableStatuses);
  const categories = parseEnumList(category, Object.values(TicketCategory));
  const search = typeof q === "string" ? q.trim() : "";

  // Trashed tickets are excluded from the main list (and vice versa); within a scope, an
  // empty status filter on the main list still hides PROCESSING tickets as before.
  const statusFilter = statuses.length > 0 ? { in: statuses } : isTrashed ? undefined : { not: "PROCESSING" as const };

  const where: Prisma.TicketWhereInput = {
    deletedAt: isTrashed ? { not: null } : null,
    ...(statusFilter && { status: statusFilter }),
    ...(categories.length > 0 && { category: { in: categories } }),
    ...(search && {
      OR: [
        { subject: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize ?? "", 10) || DEFAULT_PAGE_SIZE));

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        customerEmail: true,
        customerName: true,
        createdAt: true,
        deletedAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.ticket.count({ where }),
  ]);

  // "priority" is a personal marker — looked up only for the requesting user, never shared.
  const priorityRows =
    tickets.length > 0
      ? await prisma.ticketPriority.findMany({
          where: { userId: req.user!.id, ticketId: { in: tickets.map((t) => t.id) } },
          select: { ticketId: true },
        })
      : [];
  const priorityTicketIds = new Set(priorityRows.map((p) => p.ticketId));
  const ticketsWithPriority = tickets.map((t) => ({ ...t, priority: priorityTicketIds.has(t.id) }));

  res.json({
    tickets: ticketsWithPriority,
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  });
});

const DAILY_VOLUME_DAYS = 14;

router.get("/analytics", requireAuth, async (_req, res) => {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  since.setUTCDate(since.getUTCDate() - (DAILY_VOLUME_DAYS - 1));

  const [totalTickets, openTickets, resolvedTickets, categoryGroups, statusGroups, recentTickets] =
    await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.findMany({
        where: { status: "RESOLVED" },
        select: { createdAt: true, resolvedAt: true, autoResolved: true },
      }),
      prisma.ticket.groupBy({
        by: ["category"],
        where: { status: { not: "PROCESSING" } },
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ["status"],
        where: { status: { not: "PROCESSING" } },
        _count: { _all: true },
      }),
      prisma.ticket.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

  const resolvedCount = resolvedTickets.length;
  const aiResolvedCount = resolvedTickets.filter((t) => t.autoResolved).length;
  const humanResolvedCount = resolvedCount - aiResolvedCount;
  const aiResolvedPercent = resolvedCount > 0 ? Math.round((aiResolvedCount / resolvedCount) * 100) : 0;

  const resolutionDurationsMs = resolvedTickets
    .filter((t) => t.resolvedAt)
    .map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime());
  const averageResolutionMinutes =
    resolutionDurationsMs.length > 0
      ? resolutionDurationsMs.reduce((sum, ms) => sum + ms, 0) / resolutionDurationsMs.length / 60000
      : null;

  const categoryCounts = new Map(categoryGroups.map((g) => [g.category, g._count._all]));
  const categoryBreakdown = Object.values(TicketCategory).map((category) => ({
    category,
    count: categoryCounts.get(category) ?? 0,
  }));

  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const statusBreakdown = listableStatuses.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const dailyCounts = new Map<string, number>();
  for (const { createdAt } of recentTickets) {
    const day = createdAt.toISOString().slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
  }
  const dailyVolume = Array.from({ length: DAILY_VOLUME_DAYS }, (_, i) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    return { date: day, count: dailyCounts.get(day) ?? 0 };
  });

  res.json({
    totalTickets,
    openTickets,
    resolvedTickets: resolvedCount,
    aiResolvedCount,
    humanResolvedCount,
    aiResolvedPercent,
    humanResolvedPercent: resolvedCount > 0 ? 100 - aiResolvedPercent : 0,
    averageResolutionMinutes,
    categoryBreakdown,
    statusBreakdown,
    dailyVolume,
  });
});

// Bulk routes are registered before "/:id" routes so literal segments like "bulk" aren't
// captured as an :id by the single-ticket routes below.

router.post("/bulk/trash", requireAuth, async (req, res) => {
  const ids = parseIdList((req.body as { ids?: unknown })?.ids);
  if (!ids) {
    res.status(400).json({ error: "ids must be a non-empty array of strings" });
    return;
  }

  const result = await prisma.ticket.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  res.json({ count: result.count });
});

router.post("/bulk/restore", requireAuth, async (req, res) => {
  const ids = parseIdList((req.body as { ids?: unknown })?.ids);
  if (!ids) {
    res.status(400).json({ error: "ids must be a non-empty array of strings" });
    return;
  }

  const result = await prisma.ticket.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  res.json({ count: result.count });
});

router.post("/bulk/permanent-delete", requireAuth, async (req, res) => {
  const ids = parseIdList((req.body as { ids?: unknown })?.ids);
  if (!ids) {
    res.status(400).json({ error: "ids must be a non-empty array of strings" });
    return;
  }

  // Only ever hard-deletes tickets that are already in the Recycle Bin.
  const result = await prisma.ticket.deleteMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
  });
  res.json({ count: result.count });
});

// "My Priority" is a personal marker scoped to the requesting user — it is never written
// to the Ticket row itself, so it can never become visible to, or overwrite, another user's marker.
router.post("/bulk/priority", requireAuth, async (req, res) => {
  const { ids: rawIds, priority } = req.body as { ids?: unknown; priority?: unknown };
  const ids = parseIdList(rawIds);
  if (!ids || typeof priority !== "boolean") {
    res.status(400).json({ error: "ids must be a non-empty array of strings and priority must be a boolean" });
    return;
  }

  const userId = req.user!.id;
  if (priority) {
    await prisma.ticketPriority.createMany({
      data: ids.map((ticketId) => ({ userId, ticketId })),
      skipDuplicates: true,
    });
  } else {
    await prisma.ticketPriority.deleteMany({ where: { userId, ticketId: { in: ids } } });
  }
  res.json({ count: ids.length });
});

// Registered before "/:id" routes so the literal "attachments" segment isn't captured
// as an :id by the single-ticket routes below.
router.get("/attachments/:attachmentId", requireAuth, async (req, res) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: req.params.attachmentId },
    select: { filename: true, contentType: true, content: true },
  });

  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  res.setHeader("Content-Type", attachment.contentType ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.filename)}"`);
  res.send(attachment.content);
});

router.get("/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: ticketDetailSelect,
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  // "priority" is a personal marker — only ever computed from the requesting user's own rows.
  const priorityRow = await prisma.ticketPriority.findUnique({
    where: { userId_ticketId: { userId: req.user!.id, ticketId: ticket.id } },
  });

  res.json({ ...ticket, priority: !!priorityRow });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { assignedToId, status, category } = req.body as {
    assignedToId?: string | null;
    status?: string;
    category?: string;
  };

  const data: Prisma.TicketUncheckedUpdateInput = {};

  if (assignedToId !== undefined) {
    if (req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Only admins can change ticket assignment" });
      return;
    }
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { deletedAt: true } });
      if (!assignee || assignee.deletedAt) {
        res.status(400).json({ error: "Assignee not found" });
        return;
      }
    }
    data.assignedToId = assignedToId ?? null;
  }

  if (status !== undefined) {
    if (!listableStatuses.includes(status as TicketStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    data.status = status as TicketStatus;
    if (status === "RESOLVED") {
      data.resolvedAt = new Date();
      data.autoResolved = false;
    }
  }

  if (category !== undefined) {
    if (!Object.values(TicketCategory).includes(category as TicketCategory)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }
    data.category = category as TicketCategory;
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data,
      select: ticketDetailSelect,
    });
    res.json(ticket);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2025") {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    throw err;
  }
});

router.post("/:id/trash", requireAuth, async (req, res) => {
  const result = await prisma.ticket.updateMany({
    where: { id: req.params.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: ticketDetailSelect });
  res.json(ticket);
});

router.post("/:id/restore", requireAuth, async (req, res) => {
  const result = await prisma.ticket.updateMany({
    where: { id: req.params.id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: ticketDetailSelect });
  res.json(ticket);
});

router.post("/:id/priority", requireAuth, async (req, res) => {
  try {
    await prisma.ticketPriority.upsert({
      where: { userId_ticketId: { userId: req.user!.id, ticketId: req.params.id } },
      create: { userId: req.user!.id, ticketId: req.params.id },
      update: {},
    });
    res.status(204).end();
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2003" || e.code === "P2025") {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    throw err;
  }
});

router.delete("/:id/priority", requireAuth, async (req, res) => {
  await prisma.ticketPriority.deleteMany({
    where: { userId: req.user!.id, ticketId: req.params.id },
  });
  res.status(204).end();
});

router.delete("/:id/permanent", requireAuth, async (req, res) => {
  // Only ever hard-deletes a ticket that is already in the Recycle Bin.
  const result = await prisma.ticket.deleteMany({
    where: { id: req.params.id, deletedAt: { not: null } },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.status(204).end();
});

router.post(
  "/:id/messages",
  requireAuth,
  (req, res, next) => {
    attachmentUpload.array("files", MAX_ATTACHMENTS_PER_MESSAGE)(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Invalid file upload" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const { body } = req.body as { body?: string };
    const text = typeof body === "string" ? body.trim() : "";

    if (!text) {
      res.status(400).json({ error: "Reply body is required" });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: { id: true, subject: true, customerEmail: true },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const files = filesToAttachmentData((req.files as Express.Multer.File[]) ?? []);

    await prisma.message.create({
      data: {
        body: text,
        isFromCustomer: false,
        userId: req.user!.id,
        ticketId: ticket.id,
        ...(files.length > 0 && { attachments: { create: files } }),
      },
    });

    try {
      await sendReplyEmail({
        ticketId: ticket.id,
        subject: ticket.subject,
        to: ticket.customerEmail,
        text,
        agentName: req.user!.name,
        attachments: files.map((f) => ({ filename: f.filename, contentType: f.contentType, content: f.content })),
      });
    } catch (err) {
      console.error(`Failed to send reply email for ticket ${ticket.id}:`, err);
    }

    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: ticketDetailSelect });
    res.status(201).json(updatedTicket);
  }
);

router.post("/:id/polish-reply", requireAuth, async (req, res) => {
  const { body } = req.body as { body?: string };
  const draft = typeof body === "string" ? body.trim() : "";

  if (!draft) {
    res.status(400).json({ error: "Reply body is required" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { customerName: true, customerEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const customerName = ticket.customerName ?? ticket.customerEmail;

  try {
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system:
        "You polish draft replies written by customer support agents. " +
        "Improve grammar and clarity while keeping the meaning and length similar. " +
        "Always sound professional and empathetic. " +
        "Open the reply with a brief greeting addressed to the customer by name. " +
        "Do not use dashes or hyphens as punctuation, and remove unnecessary whitespace. " +
        "Do not add a signature or sign-off — that is appended separately. " +
        "Respond with only the revised reply text.",
      prompt: `Customer name: ${customerName}\n\nDraft reply:\n${draft}`,
    });
    const polished = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    res.json({ text: `${polished}\n\nBest regards,\n${req.user!.name}` });
  } catch {
    res.status(502).json({ error: "Failed to polish reply" });
  }
});

router.post("/:id/summarize", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: {
      subject: true,
      body: true,
      customerName: true,
      customerEmail: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { body: true, isFromCustomer: true, user: { select: { name: true } } },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const customerName = ticket.customerName ?? ticket.customerEmail;
  const conversation = [
    `${customerName}: ${ticket.body}`,
    ...ticket.messages.map((m) => `${m.isFromCustomer ? customerName : m.user?.name ?? "Agent"}: ${m.body}`),
  ].join("\n\n");

  try {
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system:
        "You summarize customer support tickets for agents picking up the conversation. " +
        "Write a concise summary covering what the customer needs and the current state of the conversation. " +
        "Use plain prose, not bullet points. Do not use dashes or hyphens as punctuation. " +
        "Respond with only the summary text.",
      prompt: `Subject: ${ticket.subject}\n\n${conversation}`,
    });
    res.json({ summary: text.trim() });
  } catch {
    res.status(502).json({ error: "Failed to summarize ticket" });
  }
});

export default router;
