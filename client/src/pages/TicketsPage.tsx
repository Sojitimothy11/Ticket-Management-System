import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Navbar } from "../components/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketStatus = "OPEN" | "RESOLVED" | "CLOSED";
type TicketCategory = "GENERAL_QUESTION" | "TECHNICAL_QUESTION" | "REFUND_REQUEST";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  customerEmail: string;
  customerName: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchTickets(sorting: SortingState): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (sorting[0]) {
    params.set("sortBy", sorting[0].id);
    params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
  }
  const res = await fetch(`${API}/api/tickets?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load tickets (${res.status})`);
  return res.json();
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-green-100 text-green-700",
  RESOLVED: "bg-blue-100 text-blue-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const categoryLabels: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General Question",
  TECHNICAL_QUESTION: "Technical Question",
  REFUND_REQUEST: "Refund Request",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor((row) => row.customerName ?? row.customerEmail, {
    id: "customerName",
    header: "Requester",
    cell: (info) => <span className="text-slate-600">{info.getValue()}</span>,
  }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: (info) => <span className="text-slate-600">{categoryLabels[info.getValue()]}</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[info.getValue()]}`}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor((row) => row.assignedTo?.name ?? "Unassigned", {
    id: "assignedTo",
    header: "Assigned To",
    cell: (info) => <span className="text-slate-600">{info.getValue()}</span>,
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => <span className="text-slate-500">{formatDate(info.getValue())}</span>,
  }),
];

// ─── Tickets Page ────────────────────────────────────────────────────────────

export function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const { data: tickets, isPending, error } = useQuery({
    queryKey: ["tickets", sorting],
    queryFn: () => fetchTickets(sorting),
  });

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Tickets</h1>

        {isPending && <p className="text-slate-500">Loading…</p>}

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        {tickets && (
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortDirection = header.column.getIsSorted();
                      return (
                        <th key={header.id} className="text-left px-4 py-3 font-medium text-slate-600">
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDirection === "asc" && <ArrowUp size={13} />}
                            {sortDirection === "desc" && <ArrowDown size={13} />}
                            {!sortDirection && <ArrowUpDown size={13} className="text-slate-300" />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
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
      </main>
    </div>
  );
}
