import { Router } from "express";
import { auth } from "../lib/auth";
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

router.post("/", requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const assignedRole = role === "ADMIN" ? "ADMIN" : "AGENT";

  try {
    // Called without headers → admin plugin skips its own session check (server-side usage).
    // Our requireAdmin middleware above has already verified the caller is an admin.
    const result = await auth.api.createUser({
      body: { name, email, password, role: assignedRole },
    });
    const u = result.user as Record<string, unknown>;
    res.status(201).json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as string) ?? "AGENT",
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; statusCode?: number; message?: string };
    res.status(e.status ?? e.statusCode ?? 400).json({ error: e.message ?? "Failed to create user" });
  }
});

export default router;
