import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  itemLabel,
  onPrevious,
  onNext,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  itemLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span className="font-mono text-xs tabular-nums">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrevious}>
          <ChevronLeft size={14} />
          Previous
        </Button>
        <span className="font-mono text-xs tabular-nums text-foreground/80">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
