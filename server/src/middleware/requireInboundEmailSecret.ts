import type { Request, Response, NextFunction } from "express";

export function requireInboundEmailSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    res.status(500).json({ error: "INBOUND_EMAIL_SECRET is not configured" });
    return;
  }
  if (req.params.secret !== expected) {
    res.status(404).end();
    return;
  }
  next();
}
