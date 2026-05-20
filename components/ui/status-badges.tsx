import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
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
  if (status === "Verified") {
    return (
      <Badge variant="statusCompleted" className="gap-1 rounded-full px-3 py-1 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </Badge>
    );
  }
  if (status === "Rejected") {
    return (
      <Badge variant="statusRejected" className="gap-1 rounded-full px-3 py-1 text-xs font-medium">
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="statusPending" className="gap-1 rounded-full px-3 py-1 text-xs font-medium">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}
