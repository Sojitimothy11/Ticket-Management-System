import { Router } from "express";
import { auth } from "../lib/auth";
import prisma from "../lib/prisma";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Lightweight roster for populating "assign to" pickers — any authenticated user can see who's assignable.
router.get("/assignable", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

router.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
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

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body as {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const assignedRole = role === "ADMIN" ? "ADMIN" : "AGENT";

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { name: name.trim(), email: email.trim(), role: assignedRole },
      select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
    });

    if (password?.trim()) {
      await auth.api.setUserPassword({
        body: { userId: id, newPassword: password.trim() },
        headers: req.headers as any,
      });
    }

    res.json(user);
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; statusCode?: number; message?: string };
    if (e.code === "P2002") {
      res.status(400).json({ error: "Email is already taken" });
      return;
    }
    res.status(e.status ?? e.statusCode ?? 500).json({ error: e.message ?? "Failed to update user" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "ADMIN") {
    res.status(403).json({ error: "Admin users cannot be deleted" });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
    prisma.ticket.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null },
    }),
  ]);

  res.status(204).end();
});

export default router;
