import { Router } from "express";
import type { Prisma } from "@prisma/client";
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

router.get("/", requireAuth, async (req, res) => {
  const { sortBy, sortOrder } = req.query as { sortBy?: string; sortOrder?: string };
  const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  const buildOrderBy = sortableFields[sortBy ?? ""] ?? sortableFields.createdAt;
  const orderBy = buildOrderBy(order);

  const tickets = await prisma.ticket.findMany({
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
  });
  res.json(tickets);
});

export default router;
