import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        /**
         * `!` on solid fills ensures backgrounds win over Radix `Slot` (child) class
         * concatenation and other accidental `bg-*` utilities.
         */
        destructive:
          "!bg-action-danger !text-white shadow hover:!bg-action-danger-hover",
        link: "text-primary underline-offset-4 hover:underline",
        /** Semantic actions — colors from `theme.action.*` in tailwind.config */
        reserve:
          "!bg-action-reserve !text-white shadow hover:!bg-action-reserve-hover",
        book: "!bg-action-book !text-white shadow hover:!bg-action-book-hover",
        edit: "!bg-action-edit !text-white shadow hover:!bg-action-edit-hover",
        archive:
          "!bg-action-archive !text-white shadow hover:!bg-action-archive-hover",
        view: "!bg-action-view !text-white shadow hover:!bg-action-view-hover",
        cancelMuted:
          "!bg-action-cancel !text-gray-900 shadow hover:!bg-action-cancel-hover",
        save: "!bg-action-save !text-white shadow hover:!bg-action-save-hover",
        update:
          "!bg-action-update !text-white shadow hover:!bg-action-update-hover",
        approve:
          "!bg-action-approve !text-white shadow hover:!bg-action-approve-hover",
        reject: "!bg-action-reject !text-white shadow hover:!bg-action-reject-hover",
        bookingSuccess:
          "cursor-default !border !border-action-approve/40 !bg-action-approve/10 !text-action-ink-ok hover:!bg-action-approve/10",
        bookingPending:
          "cursor-default !border !border-action-edit/40 !bg-action-edit/10 !text-action-ink-pending hover:!bg-action-edit/10"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Merges variant + user classes with tailwind-merge. (Do not pass `className`
 * into `buttonVariants` — cva only uses `clsx`; conflicts must be resolved here.)
 * When `asChild`, prepends a merge-friendly base so `Slot` + child `className` still
 * de-duplicate with `!bg-*` on semantic variants.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
