import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import Parse from "@sendgrid/inbound-mail-parser";
import prisma from "../lib/prisma";
import { requireInboundEmailSecret } from "../middleware/requireInboundEmailSecret";
import { parseFromHeader, extractTicketId, stripHtml } from "../lib/email";
import { enqueueClassifyTicket } from "../lib/classifyTicket";
import { enqueueResolveTicket } from "../lib/resolveTicket";
import { attachmentUpload, filesToAttachmentData } from "../lib/attachments";

const router = Router();

// SendGrid retries the webhook on non-2xx, so a too-large/too-many-files attachment
// shouldn't fail the whole request — just drop the attachments and keep the email text.
function uploadAttachmentsOrSkip(req: Request, res: Response, next: NextFunction) {
  attachmentUpload.any()(req, res, (err: unknown) => {
    if (err) {
      console.error("Inbound email attachment upload error (dropping attachments):", err);
      req.files = [];
    }
    next();
  });
}

router.post("/inbound/:secret", requireInboundEmailSecret, uploadAttachmentsOrSkip, async (req, res) => {
  const parser = new Parse({ keys: ["to", "from", "subject", "text", "html"] }, { body: req.body });

  // keyValues() reduces over only the keys present in the payload and throws if none are —
  // guard so a malformed webhook call 400s instead of 500ing.
  let parsed: { to?: string; from?: string; subject?: string; text?: string; html?: string };
  try {
    parsed = parser.keyValues();
  } catch {
    res.status(200).json({ ok: false, error: "Missing required fields" });
    return;
  }

  const { to, from, subject, text, html } = parsed;

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
  const files = filesToAttachmentData((req.files as Express.Multer.File[]) ?? []);

  try {
    const existingTicketId = extractTicketId(ticketSubject);
    const existingTicket = existingTicketId
      ? await prisma.ticket.findUnique({ where: { id: existingTicketId } })
      : null;

    if (existingTicket) {
      const message = await prisma.message.create({
        data: {
          body,
          isFromCustomer: true,
          ticketId: existingTicket.id,
          ...(files.length > 0 && { attachments: { create: files } }),
        },
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
        messages: {
          create: {
            body,
            isFromCustomer: true,
            ...(files.length > 0 && { attachments: { create: files } }),
          },
        },
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
