import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

export default router;
