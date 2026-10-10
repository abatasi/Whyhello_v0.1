import * as React from "react";
import { Briefcase, Building, Handshake, Sparkles, TrendingUp, User, Users, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface InsightCategoryOption {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const INSIGHT_CATEGORY_OPTIONS: readonly InsightCategoryOption[] = [
  { value: "personal", label: "Personal", icon: User, color: "text-indigo-600 dark:text-indigo-400" },
  { value: "company", label: "Company", icon: Building, color: "text-amber-600 dark:text-amber-400" },
  { value: "industry", label: "Industry", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  { value: "role", label: "Role", icon: Briefcase, color: "text-violet-600 dark:text-violet-400" },
  { value: "colleagues", label: "Colleagues", icon: Users, color: "text-sky-600 dark:text-sky-400" },
  { value: "counterparts", label: "Counterparts", icon: Handshake, color: "text-rose-600 dark:text-rose-400" },
];

export const LEGACY_INSIGHT_CATEGORY_OPTIONS: readonly InsightCategoryOption[] = [
  { value: "Automatic", label: "Automatic", icon: Sparkles, color: "text-primary" },
  ...INSIGHT_CATEGORY_OPTIONS.map(option => {
    const label = option.value === "colleagues" ? "Colleague" : option.value === "counterparts" ? "Counterpart" : option.label;
    return { ...option, value: label, label };
  }),
];

function CategoryLabel({ option }: { option: InsightCategoryOption }) {
  const Icon = option.icon;
  return <span className="flex min-w-0 items-center gap-2.5">
    <Icon aria-hidden="true" data-insight-category-icon={option.value} className={cn("size-4 shrink-0", option.color)} />
    <span className="truncate">{option.label}</span>
  </span>;
}

export function InsightCategorySelect({ id, value, onValueChange, disabled, className, options = INSIGHT_CATEGORY_OPTIONS }: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  options?: readonly InsightCategoryOption[];
}) {
  const selected = options.find(option => option.value === value);
  return <Select value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger id={id} data-testid="select-insight-category" aria-label="Insight category"
      className={cn("min-h-10 cursor-pointer gap-3 bg-background text-left text-foreground shadow-none disabled:cursor-not-allowed", className)}>
      <SelectValue placeholder="Choose an insight category">
        {selected ? <CategoryLabel option={selected} /> : "Choose an insight category"}
      </SelectValue>
    </SelectTrigger>
    <SelectContent data-testid="insight-category-menu" position="popper"
      className="z-[220] max-h-[min(20rem,var(--radix-select-content-available-height))] max-w-[calc(100vw-2rem)] rounded-lg border-border bg-background text-foreground shadow-lg">
      {options.map(option => <SelectItem key={option.value} value={option.value} textValue={option.label}
        className="cursor-pointer rounded-md py-2.5 pl-3 pr-10 text-sm focus:bg-accent focus:text-accent-foreground">
        <CategoryLabel option={option} />
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
