import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Star, RotateCcw, Trash2 } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FilterDropdown } from "../components/FilterDropdown";
import { Pagination } from "../components/Pagination";
import { BulkActionBar } from "../components/BulkActionBar";
import { selectionColumn, baseTicketColumns, ticketColumnHelper, type SelectionMeta } from "../lib/ticketColumns";
import {
  categoryLabels,
  formatDate,
  useDebouncedValue,
  useTransientMessage,
  type TicketStatus,
  type TicketCategory,
} from "../lib/tickets";
import {
  fetchTickets,
  restoreTicket,
  permanentlyDeleteTicket,
  setTicketPriority,
  bulkRestoreTickets,
  bulkPermanentlyDeleteTickets,
  type Ticket,
  type TicketFilters,
} from "../lib/ticketsApi";

// ─── Permanent delete confirmation ───────────────────────────────────────────

function PermanentDeleteModal({
  count,
  label,
  onClose,
  onConfirm,
  isPending,
  errorMessage,
}: {
  count: number;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  errorMessage?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current && !isPending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="permanent-delete-title"
        className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 shrink-0">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <h2 id="permanent-delete-title" className="font-heading text-lg font-semibold text-foreground">
            Permanently Delete {count === 1 ? "Ticket" : "Tickets"}
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-1">Are you sure you want to permanently delete {label}?</p>
        <p className="text-sm font-medium text-destructive mb-6">This action cannot be undone.</p>

        {errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-foreground/80 bg-muted hover:bg-muted/70 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-destructive hover:bg-destructive/85 disabled:bg-destructive/40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
          >
            {isPending ? "Deleting…" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Columns ─────────────────────────────────────────────────────────────────

type RecycleBinMeta = SelectionMeta & {
  onTogglePriority: (ticket: Ticket) => void;
  onRestore: (ticket: Ticket) => void;
  onRequestPermanentDelete: (ticket: Ticket) => void;
};

const deletedAtColumn = ticketColumnHelper.accessor("deletedAt", {
  header: "Deleted",
  enableSorting: false,
  meta: { hideOnMobile: true },
  cell: (info) => (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {info.getValue() ? formatDate(info.getValue()!) : "—"}
    </span>
  ),
});

const actionsColumn = ticketColumnHelper.display({
  id: "actions",
  header: "",
  enableSorting: false,
  cell: ({ row, table }) => {
    const meta = table.options.meta as RecycleBinMeta;
    const ticket = row.original;
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => meta.onTogglePriority(ticket)}
          className={
            "p-1.5 rounded transition-colors cursor-pointer " +
            (ticket.priority
              ? "bg-signal/15 text-signal hover:bg-signal/25"
              : "text-muted-foreground hover:text-foreground/80 hover:bg-muted")
          }
          aria-label={ticket.priority ? `Remove "${ticket.subject}" from My Priority` : `Add "${ticket.subject}" to My Priority`}
        >
          <Star size={14} className={ticket.priority ? "fill-signal" : ""} />
        </button>
        <button
          type="button"
          onClick={() => meta.onRestore(ticket)}
          className="p-1.5 text-muted-foreground hover:text-harbor hover:bg-harbor/10 rounded transition-colors cursor-pointer"
          aria-label={`Restore "${ticket.subject}"`}
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={() => meta.onRequestPermanentDelete(ticket)}
          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
          aria-label={`Permanently delete "${ticket.subject}"`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  },
});

const columns = [selectionColumn, ...baseTicketColumns, deletedAtColumn, actionsColumn];

// ─── Recycle Bin Page ────────────────────────────────────────────────────────

const statusOptions: readonly TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const categoryOptions: readonly TicketCategory[] = ["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"];

export function RecycleBinPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState<Set<TicketStatus>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<TicketCategory>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useTransientMessage();
  const [confirmTarget, setConfirmTarget] = useState<{ ids: string[]; count: number; label: string } | null>(null);

  const queryClient = useQueryClient();

  const filters: TicketFilters = { statuses: statusFilter, categories: categoryFilter, search };
  const sortedStatuses = [...statusFilter].sort();
  const sortedCategories = [...categoryFilter].sort();

  useEffect(() => {
    setPage(1);
  }, [sorting, search, sortedStatuses.join(","), sortedCategories.join(",")]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [sorting, search, sortedStatuses.join(","), sortedCategories.join(","), page]);

  const { data, isPending, error } = useQuery({
    queryKey: ["tickets", "trash", sorting, sortedStatuses, sortedCategories, search, page],
    queryFn: () => fetchTickets(sorting, filters, page, true),
    refetchInterval: 10_000,
  });
  const tickets = data?.tickets;
  const visibleIds = tickets?.map((t) => t.id) ?? [];

  function dropFromSelection(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }

  const restoreMutation = useMutation({
    mutationFn: (ticket: Ticket) => restoreTicket(ticket.id),
    onSuccess: (_data, ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      dropFromSelection([ticket.id]);
      setFeedback(`Restored "${ticket.subject}" to Tickets.`);
    },
  });

  const priorityMutation = useMutation({
    mutationFn: (ticket: Ticket) => setTicketPriority(ticket.id, !ticket.priority),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => bulkRestoreTickets(ids),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      dropFromSelection(ids);
      setFeedback(`Restored ${ids.length} ticket${ids.length === 1 ? "" : "s"} to Tickets.`);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => (ids.length === 1 ? permanentlyDeleteTicket(ids[0]) : bulkPermanentlyDeleteTickets(ids)),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      dropFromSelection(ids);
      setFeedback(`Permanently deleted ${ids.length} ticket${ids.length === 1 ? "" : "s"}.`);
      setConfirmTarget(null);
    },
  });

  function toggleStatus(value: TicketStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleCategory(value: TicketCategory) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isIndeterminate = !allSelected && visibleIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  }

  const tableMeta: RecycleBinMeta = {
    selectedIds,
    toggleRow,
    toggleSelectAll,
    allSelected,
    isIndeterminate,
    onTogglePriority: (ticket) => priorityMutation.mutate(ticket),
    onRestore: (ticket) => restoreMutation.mutate(ticket),
    onRequestPermanentDelete: (ticket) =>
      setConfirmTarget({ ids: [ticket.id], count: 1, label: `"${ticket.subject}"` }),
  };

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="px-6 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Recycle Bin</h1>
          {data && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{data.total} total</span>
          )}
        </div>

        {feedback && (
          <p role="status" className="mb-4 rounded-md border border-buoy/20 bg-buoy/10 px-4 py-3 text-sm text-buoy">
            {feedback}
          </p>
        )}

        <div data-testid="ticket-filters" className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search subject or requester…"
              className="pl-8"
            />
          </div>
          <FilterDropdown
            label="Status"
            options={statusOptions}
            optionLabels={{ OPEN: "Open", RESOLVED: "Resolved", CLOSED: "Closed" }}
            selected={statusFilter}
            onToggle={toggleStatus}
          />
          <FilterDropdown
            label="Category"
            options={categoryOptions}
            optionLabels={categoryLabels}
            selected={categoryFilter}
            onToggle={toggleCategory}
          />
          {(statusFilter.size > 0 || categoryFilter.size > 0 || searchInput) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter(new Set());
                setCategoryFilter(new Set());
                setSearchInput("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          actions={[
            {
              label: "Restore selected",
              icon: <RotateCcw size={14} />,
              disabled: bulkRestoreMutation.isPending,
              onClick: () => bulkRestoreMutation.mutate([...selectedIds]),
            },
            {
              label: "Permanently delete selected",
              icon: <Trash2 size={14} />,
              variant: "destructive",
              disabled: permanentDeleteMutation.isPending,
              onClick: () =>
                setConfirmTarget({ ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} tickets` }),
            },
          ]}
        />

        {isPending && <p className="text-muted-foreground">Loading…</p>}

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message}
          </p>
        )}

        {tickets && (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDirection = header.column.getIsSorted();
                      const hideOnMobile = header.column.columnDef.meta?.hideOnMobile;
                      return (
                        <th
                          key={header.id}
                          className={
                            "px-4 py-3 text-left font-mono text-xs font-medium text-muted-foreground uppercase tracking-wide" +
                            (hideOnMobile ? " hidden sm:table-cell" : "")
                          }
                        >
                          {canSort ? (
                            <button
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center gap-1 cursor-pointer transition-colors hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sortDirection === "asc" && <ArrowUp size={13} />}
                              {sortDirection === "desc" && <ArrowDown size={13} />}
                              {!sortDirection && <ArrowUpDown size={13} className="text-muted-foreground/40" />}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                      Recycle Bin is empty.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        "border-b border-border last:border-0 transition-colors hover:bg-muted/50" +
                        (row.original.priority ? " bg-signal/5" : "")
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={"px-4 py-3" + (cell.column.columnDef.meta?.hideOnMobile ? " hidden sm:table-cell" : "")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            itemLabel="deleted tickets"
            onPrevious={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </main>

      {confirmTarget && (
        <PermanentDeleteModal
          count={confirmTarget.count}
          label={confirmTarget.label}
          isPending={permanentDeleteMutation.isPending}
          errorMessage={permanentDeleteMutation.isError ? permanentDeleteMutation.error.message : undefined}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => permanentDeleteMutation.mutate(confirmTarget.ids)}
        />
      )}
    </div>
  );
}
