import { Router } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { requireInboundEmailSecret } from "../middleware/requireInboundEmailSecret";
import { parseFromHeader, extractTicketId, stripHtml } from "../lib/email";
import { enqueueClassifyTicket } from "../lib/classifyTicket";
import { enqueueResolveTicket } from "../lib/resolveTicket";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

router.post("/inbound/:secret", requireInboundEmailSecret, upload.any(), async (req, res) => {
  const { to, from, subject, text, html } = req.body as {
    to?: string;
    from?: string;
    subject?: string;
    text?: string;
    html?: string;
  };

  if (!from || !to) {
    res.status(200).json({ ok: false, error: "Missing required fields" });
    return;
  }

  const supportAddress = process.env.SUPPORT_EMAIL_ADDRESS;
  if (supportAddress && !to.toLowerCase().includes(supportAddress.toLowerCase())) {
    res.status(200).json({ ok: false, error: "Not addressed to the support address" });
    return;
  }

  const { name: customerName, email: customerEmail } = parseFromHeader(from);
  const body = text?.trim() || (html ? stripHtml(html) : "") || "(no content)";
  const ticketSubject = subject?.trim() || "(no subject)";

  try {
    const existingTicketId = extractTicketId(ticketSubject);
    const existingTicket = existingTicketId
      ? await prisma.ticket.findUnique({ where: { id: existingTicketId } })
      : null;

    if (existingTicket) {
      const message = await prisma.message.create({
        data: { body, isFromCustomer: true, ticketId: existingTicket.id },
      });
      if (existingTicket.status === "CLOSED") {
        await prisma.ticket.update({ where: { id: existingTicket.id }, data: { status: "OPEN" } });
      }
      res.status(200).json({ ok: true, ticketId: existingTicket.id, messageId: message.id });
      return;
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: ticketSubject,
        body,
        customerEmail,
        customerName,
        status: "PROCESSING",
        messages: { create: { body, isFromCustomer: true } },
      },
      include: { messages: true },
    });

    try {
      await enqueueClassifyTicket(ticket.id, ticketSubject, body);
    } catch (err) {
      console.error(`Failed to enqueue classification for ticket ${ticket.id}:`, err);
    }

    try {
      await enqueueResolveTicket(ticket.id, ticketSubject, body, customerName ?? customerEmail);
    } catch (err) {
      console.error(`Failed to enqueue auto-resolve for ticket ${ticket.id}:`, err);
    }

    res.status(200).json({ ok: true, ticketId: ticket.id, messageId: ticket.messages[0]?.id });
  } catch (err) {
    console.error("Failed to process inbound email:", err);
    res.status(500).json({ ok: false, error: "Failed to process inbound email" });
  }
});

export default router;
