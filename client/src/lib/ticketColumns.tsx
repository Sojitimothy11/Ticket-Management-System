import { Link } from "react-router";
import { createColumnHelper, type RowData } from "@tanstack/react-table";
import { Checkbox } from "../components/ui/checkbox";
import { StatusBadge } from "../components/StatusBadge";
import { categoryLabels, formatDate } from "./tickets";
import type { Ticket } from "./ticketsApi";

// Lets a column opt out of narrow viewports (hidden below the `sm` breakpoint) without the
// pages needing to know which columns are "secondary" — see usage of `hideOnMobile` below.
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    hideOnMobile?: boolean;
  }
}

export type SelectionMeta = {
  selectedIds: Set<string>;
  toggleRow: (id: string) => void;
  toggleSelectAll: () => void;
  allSelected: boolean;
  isIndeterminate: boolean;
};

export const ticketColumnHelper = createColumnHelper<Ticket>();

export const selectionColumn = ticketColumnHelper.display({
  id: "select",
  enableSorting: false,
  header: ({ table }) => {
    const meta = table.options.meta as SelectionMeta;
    return (
      <Checkbox
        checked={meta.allSelected}
        indeterminate={meta.isIndeterminate}
        onCheckedChange={() => meta.toggleSelectAll()}
        aria-label="Select all visible tickets"
      />
    );
  },
  cell: ({ row, table }) => {
    const meta = table.options.meta as SelectionMeta;
    return (
      <Checkbox
        checked={meta.selectedIds.has(row.original.id)}
        onCheckedChange={() => meta.toggleRow(row.original.id)}
        aria-label={`Select ticket: ${row.original.subject}`}
      />
    );
  },
});

// Shared across the main ticket list and the Recycle Bin — each page prepends a
// selection column and appends its own page-specific row actions column.
export const baseTicketColumns = [
  ticketColumnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => (
      <Link to={`/tickets/${info.row.original.id}`} className="font-medium text-harbor hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  ticketColumnHelper.accessor((row) => row.customerName ?? row.customerEmail, {
    id: "customerName",
    header: "Requester",
    meta: { hideOnMobile: true },
    cell: (info) => <span className="text-foreground/80">{info.getValue()}</span>,
  }),
  ticketColumnHelper.accessor("category", {
    header: "Category",
    meta: { hideOnMobile: true },
    cell: (info) => <span className="text-foreground/80">{categoryLabels[info.getValue()]}</span>,
  }),
  ticketColumnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  ticketColumnHelper.accessor((row) => row.assignedTo?.name ?? "Unassigned", {
    id: "assignedTo",
    header: "Assigned To",
    meta: { hideOnMobile: true },
    cell: (info) => <span className="text-foreground/80">{info.getValue()}</span>,
  }),
  ticketColumnHelper.accessor("createdAt", {
    header: "Created",
    meta: { hideOnMobile: true },
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
    ),
  }),
];
