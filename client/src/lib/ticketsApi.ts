import type { SortingState } from "@tanstack/react-table";
import type { TicketCategory, TicketStatus } from "./tickets";
import { API_URL } from "./env";

export type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  customerEmail: string;
  customerName: string | null;
  createdAt: string;
  // Personal to the requesting user only — never a shared/global ticket attribute.
  priority: boolean;
  deletedAt: string | null;
  assignedTo: { id: string; name: string } | null;
};

export type TicketFilters = {
  statuses: Set<TicketStatus>;
  categories: Set<TicketCategory>;
  search: string;
};

export type TicketsResponse = {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const API = API_URL;
export const TICKETS_PAGE_SIZE = 20;

export async function fetchTickets(
  sorting: SortingState,
  filters: TicketFilters,
  page: number,
  trashed = false
): Promise<TicketsResponse> {
  const params = new URLSearchParams();
  if (sorting[0]) {
    params.set("sortBy", sorting[0].id);
    params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
  }
  if (filters.statuses.size > 0) params.set("status", [...filters.statuses].join(","));
  if (filters.categories.size > 0) params.set("category", [...filters.categories].join(","));
  if (filters.search) params.set("q", filters.search);
  if (trashed) params.set("trashed", "true");
  params.set("page", String(page));
  params.set("pageSize", String(TICKETS_PAGE_SIZE));

  const res = await fetch(`${API}/api/tickets?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load tickets (${res.status})`);
  return res.json();
}

export async function fetchTrashCount(): Promise<number> {
  const params = new URLSearchParams({ trashed: "true", page: "1", pageSize: "1" });
  const res = await fetch(`${API}/api/tickets?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load Recycle Bin count (${res.status})`);
  const data: TicketsResponse = await res.json();
  return data.total;
}

async function postTickets(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API}/api/tickets${path}`, {
    method: "POST",
    credentials: "include",
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export function trashTicket(id: string): Promise<void> {
  return postTickets(`/${id}/trash`);
}

export function restoreTicket(id: string): Promise<void> {
  return postTickets(`/${id}/restore`);
}

export async function permanentlyDeleteTicket(id: string): Promise<void> {
  const res = await fetch(`${API}/api/tickets/${id}/permanent`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(`Failed to permanently delete ticket (${res.status})`);
}

// Sets/clears "My Priority" for the current user only — backed by a per-user join table,
// never a field on the ticket itself, so it can never be visible to anyone else.
export async function setTicketPriority(id: string, priority: boolean): Promise<void> {
  const res = await fetch(`${API}/api/tickets/${id}/priority`, {
    method: priority ? "POST" : "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to update priority (${res.status})`);
}

export function bulkTrashTickets(ids: string[]): Promise<void> {
  return postTickets("/bulk/trash", { ids });
}

export function bulkRestoreTickets(ids: string[]): Promise<void> {
  return postTickets("/bulk/restore", { ids });
}

export function bulkPermanentlyDeleteTickets(ids: string[]): Promise<void> {
  return postTickets("/bulk/permanent-delete", { ids });
}

export function bulkSetTicketPriority(ids: string[], priority: boolean): Promise<void> {
  return postTickets("/bulk/priority", { ids, priority });
}
