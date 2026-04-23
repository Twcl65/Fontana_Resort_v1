import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge";
import type { PaymentVerification, ReservationStatus } from "@/lib/fontana-data";

export function ReservationStatusBadge({
  status,
  className
}: {
  status: ReservationStatus;
  className?: string;
}) {
  const variant =
    status === "Confirmed"
      ? "statusConfirmed"
      : status === "Pending"
        ? "statusPending"
        : status === "Archived"
          ? "statusArchived"
          : "statusCancelled";
  return (
    <Badge variant={variant} className={cn("rounded-full px-3 py-1 text-xs font-medium", className)}>
      {status}
    </Badge>
  );
}

export function PaymentVerificationBadge({ status }: { status: PaymentVerification }) {
  const variant =
    status === "Verified"
      ? "statusCompleted"
      : status === "Rejected"
        ? "statusRejected"
        : "statusPending";
  return (
    <Badge variant={variant} className="gap-1 rounded-full px-3 py-1 text-xs font-medium">
      {status}
    </Badge>
  );
}
