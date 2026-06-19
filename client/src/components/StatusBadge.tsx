import { cn } from "../lib/utils";
import type { TicketStatus } from "../lib/tickets";

const statusConfig: Record<TicketStatus, { label: string; dot: string }> = {
  OPEN: { label: "Open", dot: "bg-signal" },
  RESOLVED: { label: "Resolved", dot: "bg-buoy" },
  CLOSED: { label: "Closed", dot: "bg-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground uppercase",
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
