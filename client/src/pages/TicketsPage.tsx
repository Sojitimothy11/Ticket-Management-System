import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "../components/ui/dropdown-menu";
import { statusStyles, categoryLabels, formatDate, type TicketStatus, type TicketCategory } from "../lib/tickets";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type TicketFilters = {
  statuses: Set<TicketStatus>;
  categories: Set<TicketCategory>;
  search: string;
};

const PAGE_SIZE = 20;

type TicketsResponse = {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function fetchTickets(sorting: SortingState, filters: TicketFilters, page: number): Promise<TicketsResponse> {
  const params = new URLSearchParams();
  if (sorting[0]) {
    params.set("sortBy", sorting[0].id);
    params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
  }
  if (filters.statuses.size > 0) params.set("status", [...filters.statuses].join(","));
  if (filters.categories.size > 0) params.set("category", [...filters.categories].join(","));
  if (filters.search) params.set("q", filters.search);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const res = await fetch(`${API}/api/tickets?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load tickets (${res.status})`);
  return res.json();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ─── Filter dropdown ─────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  label,
  options,
  optionLabels,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly T[];
  optionLabels: Record<T, string>;
  selected: Set<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
            {selected.size > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {selected.size}
              </span>
            )}
            <ChevronDown size={14} />
          </Button>
        }
      />
      <DropdownMenuContent>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.has(option)}
            onCheckedChange={() => onToggle(option)}
            closeOnClick={false}
          >
            {optionLabels[option]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => (
      <Link to={`/tickets/${info.row.original.id}`} className="font-medium text-blue-600 hover:underline">
        {info.getValue()}
      </Link>
    ),
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

const statusOptions: readonly TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const categoryOptions: readonly TicketCategory[] = ["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"];

export function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState<Set<TicketStatus>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<TicketCategory>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);

  const filters: TicketFilters = { statuses: statusFilter, categories: categoryFilter, search };
  const sortedStatuses = [...statusFilter].sort();
  const sortedCategories = [...categoryFilter].sort();

  // Any change to sorting/filters/search invalidates the current page of results.
  useEffect(() => {
    setPage(1);
  }, [sorting, search, sortedStatuses.join(","), sortedCategories.join(",")]);

  const { data, isPending, error } = useQuery({
    queryKey: ["tickets", sorting, sortedStatuses, sortedCategories, search, page],
    queryFn: () => fetchTickets(sorting, filters, page),
  });
  const tickets = data?.tickets;

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

        {data && data.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>
              Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} tickets
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <span className="text-slate-600">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
