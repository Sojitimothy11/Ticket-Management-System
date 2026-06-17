import { Router } from "express";
import { TicketStatus, TicketCategory, type Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

router.get("/", requireAuth, async (req, res) => {
  const { sortBy, sortOrder, status, category, q, page, pageSize } = req.query as {
    sortBy?: string;
    sortOrder?: string;
    status?: string;
    category?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  };

  const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  const buildOrderBy = sortableFields[sortBy ?? ""] ?? sortableFields.createdAt;
  const orderBy = buildOrderBy(order);

  const statuses = parseEnumList(status, Object.values(TicketStatus));
  const categories = parseEnumList(category, Object.values(TicketCategory));
  const search = typeof q === "string" ? q.trim() : "";

  const where: Prisma.TicketWhereInput = {
    ...(statuses.length > 0 && { status: { in: statuses } }),
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
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page: currentPage, pageSize: take, totalPages: Math.max(1, Math.ceil(total / take)) });
});

router.get("/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: {
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
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          isFromCustomer: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

export default router;
