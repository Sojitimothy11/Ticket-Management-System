import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./ui/dropdown-menu";

export function FilterDropdown<T extends string>({
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
