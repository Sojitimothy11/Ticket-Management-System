import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Sparkles } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../components/ui/dropdown-menu";
import { statusStyles, categoryLabels, formatDate, type TicketStatus, type TicketCategory } from "../lib/tickets";

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  body: string;
  isFromCustomer: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type Agent = { id: string; name: string };

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
  assignedTo: Agent | null;
  messages: Message[];
};

type TicketPatch = {
  assignedToId?: string | null;
  status?: TicketStatus;
  category?: TicketCategory;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchTicket(id: string): Promise<TicketDetail> {
  const res = await fetch(`${API}/api/tickets/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(res.status === 404 ? "Ticket not found" : `Failed to load ticket (${res.status})`);
  return res.json();
}

async function fetchAssignableUsers(): Promise<Agent[]> {
  const res = await fetch(`${API}/api/users/assignable`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load assignable users (${res.status})`);
  return res.json();
}

async function patchTicket(id: string, patch: TicketPatch): Promise<TicketDetail> {
  const res = await fetch(`${API}/api/tickets/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update ticket (${res.status})`);
  return res.json();
}

async function postReply(id: string, body: string): Promise<TicketDetail> {
  const res = await fetch(`${API}/api/tickets/${id}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`Failed to send reply (${res.status})`);
  return res.json();
}

async function polishReply(id: string, body: string): Promise<string> {
  const res = await fetch(`${API}/api/tickets/${id}/polish-reply`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`Failed to polish reply (${res.status})`);
  const data = await res.json();
  return data.text as string;
}

async function summarizeTicket(id: string): Promise<string> {
  const res = await fetch(`${API}/api/tickets/${id}/summarize`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to summarize ticket (${res.status})`);
  const data = await res.json();
  return data.summary as string;
}

function useTicketPatch(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: TicketPatch) => patchTicket(ticketId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ─── Generic radio-select dropdown ──────────────────────────────────────────

function RadioPicker<T extends string>({
  value,
  options,
  optionLabels,
  onSelect,
  disabled,
  triggerClassName,
}: {
  value: T;
  options: readonly T[];
  optionLabels: Record<T, string>;
  onSelect: (value: T) => void;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled} className={triggerClassName}>
            {optionLabels[value]}
            <ChevronDown size={14} />
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onSelect(v as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} closeOnClick>
              {optionLabels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Assignee picker ─────────────────────────────────────────────────────────

const UNASSIGNED = "__unassigned__";

function AssigneePicker({ ticket }: { ticket: TicketDetail }) {
  const mutation = useTicketPatch(ticket.id);

  const { data: agents } = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: fetchAssignableUsers,
  });

  const options = [UNASSIGNED, ...(agents?.map((a) => a.id) ?? [])];
  const optionLabels: Record<string, string> = { [UNASSIGNED]: "Unassigned" };
  for (const agent of agents ?? []) optionLabels[agent.id] = agent.name;

  return (
    <RadioPicker
      value={ticket.assignedTo?.id ?? UNASSIGNED}
      options={options}
      optionLabels={optionLabels}
      disabled={mutation.isPending}
      onSelect={(value) => mutation.mutate({ assignedToId: value === UNASSIGNED ? null : value })}
    />
  );
}

// ─── Status & category pickers ──────────────────────────────────────────────

const statusOptions: readonly TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const statusLabels: Record<TicketStatus, string> = { OPEN: "Open", RESOLVED: "Resolved", CLOSED: "Closed" };
const categoryOptions: readonly TicketCategory[] = ["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"];

function StatusPicker({ ticket }: { ticket: TicketDetail }) {
  const mutation = useTicketPatch(ticket.id);
  return (
    <RadioPicker
      value={ticket.status}
      options={statusOptions}
      optionLabels={statusLabels}
      disabled={mutation.isPending}
      triggerClassName={statusStyles[ticket.status]}
      onSelect={(status) => mutation.mutate({ status })}
    />
  );
}

function CategoryPicker({ ticket }: { ticket: TicketDetail }) {
  const mutation = useTicketPatch(ticket.id);
  return (
    <RadioPicker
      value={ticket.category}
      options={categoryOptions}
      optionLabels={categoryLabels}
      disabled={mutation.isPending}
      onSelect={(category) => mutation.mutate({ category })}
    />
  );
}

// ─── Ticket summary ──────────────────────────────────────────────────────────

export function TicketSummary({ ticketId }: { ticketId: string }) {
  const mutation = useMutation({
    mutationFn: () => summarizeTicket(ticketId),
  });

  return (
    <div className="mt-4">
      <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        <Sparkles size={14} />
        {mutation.isPending ? "Summarizing…" : "Summarize"}
      </Button>

      {mutation.isError && <p className="mt-2 text-sm text-red-600">{mutation.error.message}</p>}

      {mutation.isSuccess && (
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {mutation.data}
        </div>
      )}
    </div>
  );
}

// ─── Reply form ──────────────────────────────────────────────────────────────

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () => postReply(ticketId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", ticketId], updated);
      setBody("");
    },
  });

  const polishMutation = useMutation({
    mutationFn: () => polishReply(ticketId, body),
    onSuccess: (polished) => setBody(polished),
  });

  const busy = mutation.isPending || polishMutation.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) mutation.mutate();
      }}
      className="mt-4 bg-white rounded-lg border border-slate-200 shadow-sm p-4"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={4}
        disabled={busy}
      />
      {polishMutation.isError && (
        <p className="mt-2 text-sm text-red-600">{polishMutation.error.message}</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-sm text-red-600">{mutation.error.message}</p>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !body.trim()}
          onClick={() => polishMutation.mutate()}
        >
          <Sparkles size={14} />
          {polishMutation.isPending ? "Polishing…" : "Polish"}
        </Button>
        <Button type="submit" disabled={busy || !body.trim()}>
          {mutation.isPending ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
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
                <StatusPicker ticket={ticket} />
              </div>

              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">Requester</dt>
                <dd className="text-slate-700">
                  {ticket.customerName ?? ticket.customerEmail}
                  {ticket.customerName && <span className="text-slate-400"> ({ticket.customerEmail})</span>}
                </dd>

                <dt className="text-slate-400 self-center">Category</dt>
                <dd>
                  <CategoryPicker ticket={ticket} />
                </dd>

                <dt className="text-slate-400 self-center">Assigned To</dt>
                <dd>
                  <AssigneePicker ticket={ticket} />
                </dd>

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

            <TicketSummary ticketId={ticket.id} />

            <ReplyForm ticketId={ticket.id} />
          </>
        )}
      </main>
    </div>
  );
}
