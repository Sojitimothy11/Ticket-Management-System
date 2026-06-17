const TICKET_TAG_REGEX = /\[Ticket #([a-zA-Z0-9]+)\]/i;

export function parseFromHeader(from: string): { name: string | null; email: string } {
  const match = from.match(/^(.*?)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: from.trim().toLowerCase() };
}

export function extractTicketId(subject: string): string | null {
  const match = subject.match(TICKET_TAG_REGEX);
  return match ? match[1] : null;
}

export function buildTicketTag(ticketId: string): string {
  return `[Ticket #${ticketId}]`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
