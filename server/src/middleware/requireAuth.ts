import { auth } from "../lib/auth";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
