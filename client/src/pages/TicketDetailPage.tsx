import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { statusStyles, categoryLabels, formatDate, type TicketStatus, type TicketCategory } from "../lib/tickets";

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  body: string;
  isFromCustomer: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type TicketDetail = {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  category: TicketCategory;
  customerEmail: string;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  messages: Message[];
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchTicket(id: string): Promise<TicketDetail> {
  const res = await fetch(`${API}/api/tickets/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(res.status === 404 ? "Ticket not found" : `Failed to load ticket (${res.status})`);
  return res.json();
}

// ─── Ticket Detail Page ──────────────────────────────────────────────────────

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-6 py-10 max-w-3xl mx-auto">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft size={14} />
          Back to tickets
        </Link>

        {isPending && <p className="text-slate-500">Loading…</p>}

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        {ticket && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[ticket.status]}`}>
                  {ticket.status}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">Requester</dt>
                <dd className="text-slate-700">
                  {ticket.customerName ?? ticket.customerEmail}
                  {ticket.customerName && <span className="text-slate-400"> ({ticket.customerEmail})</span>}
                </dd>

                <dt className="text-slate-400">Category</dt>
                <dd className="text-slate-700">{categoryLabels[ticket.category]}</dd>

                <dt className="text-slate-400">Assigned To</dt>
                <dd className="text-slate-700">{ticket.assignedTo?.name ?? "Unassigned"}</dd>

                <dt className="text-slate-400">Created</dt>
                <dd className="text-slate-700">{formatDate(ticket.createdAt)}</dd>

                <dt className="text-slate-400">Last Updated</dt>
                <dd className="text-slate-700">{formatDate(ticket.updatedAt)}</dd>
              </dl>
            </div>

            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Conversation
            </h2>
            <div className="flex flex-col gap-3">
              {ticket.messages.map((message) => (
                <div
                  key={message.id}
                  data-testid="message"
                  className={`rounded-lg border p-4 ${
                    message.isFromCustomer ? "bg-white border-slate-200" : "bg-blue-50 border-blue-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-900">
                      {message.isFromCustomer ? (ticket.customerName ?? ticket.customerEmail) : message.user?.name ?? "Agent"}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
