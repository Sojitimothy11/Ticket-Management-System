export type TicketStatus = "OPEN" | "RESOLVED" | "CLOSED";
export type TicketCategory = "GENERAL_QUESTION" | "TECHNICAL_QUESTION" | "REFUND_REQUEST";

export const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-green-100 text-green-700",
  RESOLVED: "bg-blue-100 text-blue-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export const categoryLabels: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General Question",
  TECHNICAL_QUESTION: "Technical Question",
  REFUND_REQUEST: "Refund Request",
};

export function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
