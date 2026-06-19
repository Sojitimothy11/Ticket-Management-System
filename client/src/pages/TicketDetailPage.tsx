import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Paperclip, Sparkles, X } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { authClient } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../components/ui/dropdown-menu";
import { StatusBadge } from "../components/StatusBadge";
import { categoryLabels, formatDate, type TicketStatus, type TicketCategory } from "../lib/tickets";

// ─── Types ───────────────────────────────────────────────────────────────────

type Attachment = { id: string; filename: string; contentType: string | null; size: number };

type Message = {
  id: string;
  body: string;
  isFromCustomer: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
  attachments: Attachment[];
};

// Mirrors the server-side limits in server/src/lib/attachments.ts.
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

async function postReply(id: string, body: string, files: File[]): Promise<TicketDetail> {
  const res = await fetch(
    `${API}/api/tickets/${id}/messages`,
    files.length > 0
      ? {
          method: "POST",
          credentials: "include",
          body: (() => {
            const formData = new FormData();
            formData.append("body", body);
            for (const file of files) formData.append("files", file);
            return formData;
          })(),
        }
      : {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
  );
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
const statusTriggerStyles: Record<TicketStatus, string> = {
  OPEN: "border-signal/30 text-signal hover:bg-signal/10",
  RESOLVED: "border-buoy/30 text-buoy hover:bg-buoy/10",
  CLOSED: "border-border text-muted-foreground",
};
const categoryOptions: readonly TicketCategory[] = ["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"];

function StatusPicker({ ticket }: { ticket: TicketDetail }) {
  const mutation = useTicketPatch(ticket.id);
  return (
    <RadioPicker
      value={ticket.status}
      options={statusOptions}
      optionLabels={statusLabels}
      disabled={mutation.isPending}
      triggerClassName={cn("font-mono text-xs font-semibold tracking-wide uppercase", statusTriggerStyles[ticket.status])}
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

      {mutation.isError && <p className="mt-2 text-sm text-destructive">{mutation.error.message}</p>}

      {mutation.isSuccess && (
        <div className="mt-3 rounded-lg border border-harbor/20 bg-harbor/5 p-4 text-sm whitespace-pre-wrap text-foreground/90">
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
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => postReply(ticketId, body, files),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", ticketId], updated);
      setBody("");
      setFiles([]);
    },
  });

  const polishMutation = useMutation({
    mutationFn: () => polishReply(ticketId, body),
    onSuccess: (polished) => setBody(polished),
  });

  const busy = mutation.isPending || polishMutation.isPending;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0) return;

    if (files.length + selected.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setFileError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`);
      return;
    }
    const tooLarge = selected.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (tooLarge) {
      setFileError(`"${tooLarge.name}" is larger than ${formatFileSize(MAX_ATTACHMENT_SIZE)}`);
      return;
    }

    setFileError(null);
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) mutation.mutate();
      }}
      className="mt-4 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={4}
        disabled={busy}
      />

      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground/90"
            >
              <Paperclip size={12} className="text-muted-foreground" />
              <span className="max-w-[14rem] truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
      {polishMutation.isError && (
        <p className="mt-2 text-sm text-destructive">{polishMutation.error.message}</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-sm text-destructive">{mutation.error.message}</p>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={busy || files.length >= MAX_ATTACHMENTS_PER_MESSAGE}
          className="sr-only"
          data-testid="reply-file-input"
          aria-label="Attach files"
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || files.length >= MAX_ATTACHMENTS_PER_MESSAGE}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={14} />
          Attach
        </Button>
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
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/tickets" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          Back to tickets
        </Link>

        {isPending && <p className="text-muted-foreground">Loading…</p>}

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message}
          </p>
        )}

        {ticket && (
          <>
            <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h1 className="font-heading text-xl font-semibold text-foreground">{ticket.subject}</h1>
                <StatusPicker ticket={ticket} />
              </div>

              <dl className="grid grid-cols-2 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Requester</dt>
                <dd className="text-foreground/90 break-words">
                  {ticket.customerName ?? ticket.customerEmail}
                  {ticket.customerName && <span className="text-muted-foreground"> ({ticket.customerEmail})</span>}
                </dd>

                <dt className="self-center text-muted-foreground">Category</dt>
                <dd>
                  <CategoryPicker ticket={ticket} />
                </dd>

                {isAdmin && (
                  <>
                    <dt className="self-center text-muted-foreground">Assigned To</dt>
                    <dd>
                      <AssigneePicker ticket={ticket} />
                    </dd>
                  </>
                )}

                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-mono text-xs text-foreground/80 tabular-nums">{formatDate(ticket.createdAt)}</dd>

                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="font-mono text-xs text-foreground/80 tabular-nums">{formatDate(ticket.updatedAt)}</dd>
              </dl>
            </div>

            <h2 className="mb-3 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Conversation
            </h2>
            <div className="flex flex-col gap-3">
              {ticket.messages.map((message) => (
                <div
                  key={message.id}
                  data-testid="message"
                  className={cn(
                    "rounded-lg border p-4",
                    message.isFromCustomer ? "border-border bg-card" : "border-harbor/20 bg-harbor/5"
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {message.isFromCustomer ? (ticket.customerName ?? ticket.customerEmail) : message.user?.name ?? "Agent"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{message.body}</p>
                  {message.attachments.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a
                            href={`${API}/api/tickets/attachments/${attachment.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground/90 hover:bg-muted/70"
                          >
                            <Paperclip size={12} className="text-muted-foreground" />
                            <span className="max-w-[14rem] truncate">{attachment.filename}</span>
                            <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
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
