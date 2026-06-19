import { useEffect, useState } from "react";

export type TicketStatus = "OPEN" | "RESOLVED" | "CLOSED";
export type TicketCategory = "GENERAL_QUESTION" | "TECHNICAL_QUESTION" | "REFUND_REQUEST";

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

// Shows a feedback message that automatically clears after `durationMs`,
// used for success/status banners (e.g. after a soft delete or restore).
export function useTransientMessage(durationMs = 4000) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  return [message, setMessage] as const;
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
