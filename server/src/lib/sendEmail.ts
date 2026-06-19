import sgMail from "@sendgrid/mail";
import { buildTicketTag, extractTicketId } from "./email";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

function buildReplySubject(subject: string, ticketId: string): string {
  const tagged = extractTicketId(subject) ? subject : `${subject} ${buildTicketTag(ticketId)}`;
  return tagged.toLowerCase().startsWith("re:") ? tagged : `Re: ${tagged}`;
}

export async function sendReplyEmail(opts: {
  ticketId: string;
  subject: string;
  to: string;
  text: string;
  agentName: string;
  attachments?: { filename: string; contentType: string | null; content: Buffer }[];
}): Promise<void> {
  const fromAddress = process.env.SUPPORT_EMAIL_ADDRESS;
  if (!apiKey || !fromAddress) {
    console.error("Skipping outbound reply email: SENDGRID_API_KEY or SUPPORT_EMAIL_ADDRESS is not configured");
    return;
  }

  await sgMail.send({
    to: opts.to,
    from: { email: fromAddress, name: opts.agentName },
    subject: buildReplySubject(opts.subject, opts.ticketId),
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      type: a.contentType ?? undefined,
      content: a.content.toString("base64"),
      disposition: "attachment",
    })),
  });
}
