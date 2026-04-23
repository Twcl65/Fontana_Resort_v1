"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type PageToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
  children?: ReactNode;
};

export function PageToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  className,
  children,
}: PageToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-9 text-sm"
        />
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
