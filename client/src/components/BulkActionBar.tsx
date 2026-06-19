import type { ReactNode } from "react";
import { Button, type buttonVariants } from "./ui/button";
import type { VariantProps } from "class-variance-authority";

export type BulkAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  disabled?: boolean;
};

export function BulkActionBar({
  selectedCount,
  actions,
  onClear,
}: {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk ticket actions"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-harbor/30 bg-harbor/5 px-4 py-2.5"
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} ticket{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant={action.variant ?? "outline"}
            size="sm"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}
