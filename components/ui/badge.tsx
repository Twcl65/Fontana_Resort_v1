import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-300",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        /** Entity / workflow status (recommended palette) */
        statusActive:
          "border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#15803D]",
        statusPending:
          "border border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#B45309]",
        statusConfirmed:
          "border border-[#3B82F6]/40 bg-[#3B82F6]/15 text-[#1D4ED8]",
        statusCompleted:
          "border border-[#16A34A]/40 bg-[#16A34A]/15 text-[#15803D]",
        statusCancelled:
          "border border-[#EF4444]/40 bg-[#EF4444]/12 text-[#DC2626]",
        statusRejected:
          "border border-[#DC2626]/50 bg-[#DC2626]/12 text-[#991B1B]",
        statusArchived:
          "border border-[#6B7280]/40 bg-[#6B7280]/12 text-[#4B5563]",
        statusExpired:
          "border border-[#F97316]/40 bg-[#F97316]/15 text-[#C2410C]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

