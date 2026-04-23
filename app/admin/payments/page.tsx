"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { CheckCircle2, Clock, Image as ImageIcon, XCircle } from "lucide-react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import {
  listPaymentsAdmin,
  updatePaymentVerification,
  type PaymentVerification,
  type PaymentWithRelations
} from "@/lib/fontana-data";

function formatMoney(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentVerification>("all");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithRelations | null>(null);
  const [verifyBusy, setVerifyBusy] = useState<PaymentVerification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listPaymentsAdmin();
    if (err) setError(err);
    setPayments(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openReviewDialog = (payment: PaymentWithRelations) => {
    setSelectedPayment(payment);
    setIsReviewOpen(true);
  };

  const totalPayments = payments.length;
  const pendingPayments = payments.filter((item) => item.status === "Pending").length;
  const rejectedPayments = payments.filter((item) => item.status === "Rejected").length;

  const updatePaymentStatus = async (status: PaymentVerification) => {
    if (!selectedPayment?.reservation) return;
    setVerifyBusy(status);
    const { error: verifyErr } = await updatePaymentVerification(
      selectedPayment.id,
      selectedPayment.reservation_id,
      status
    );
    setVerifyBusy(null);
    if (verifyErr) {
      setError(verifyErr);
      return;
    }
    setIsReviewOpen(false);
    setSelectedPayment(null);
    await load();
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const res = p.reservation;
      const booking = res?.reference_code ?? "";
      const guest =
        res?.guest_profile?.full_name ?? res?.guest_name ?? "";
      const cottage = res?.cottage?.name ?? "";
      return (
        p.id.toLowerCase().includes(q) ||
        booking.toLowerCase().includes(q) ||
        guest.toLowerCase().includes(q) ||
        cottage.toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter]);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading payments...</p> : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Payments</h1>
        <p className="text-xs text-muted-foreground">Verify proofs and track settlements across bookings.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CheckCircle2 className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{totalPayments}</p>
              <p className="text-right text-xs text-muted-foreground">All payment records</p>
            </div>
          </CardContent>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{pendingPayments}</p>
              <p className="text-right text-xs text-muted-foreground">Awaiting verification</p>
            </div>
          </CardContent>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Rejected Payments</CardTitle>
            <XCircle className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{rejectedPayments}</p>
              <p className="text-right text-xs text-muted-foreground">Marked as rejected</p>
            </div>
          </CardContent>
        </div>
      </section>

      <PageToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search payments, guest, booking...">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "Pending", "Verified", "Rejected"] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={statusFilter === s ? "reserve" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All statuses" : s}
            </Button>
          ))}
        </div>
      </PageToolbar>

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Payment log</CardTitle>
          <p className="text-xs text-muted-foreground">Recent transactions from guests.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No payment records yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && payments.length > 0 && filteredPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No payments match your search or status filter.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredPayments.map((p) => {
                const res = p.reservation;
                const guest =
                  res?.guest_profile?.full_name?.trim() || res?.guest_name || "—";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">{res?.reference_code ?? "—"}</TableCell>
                    <TableCell className="text-sm">{guest}</TableCell>
                    <TableCell className="text-sm">{formatMoney(Number(p.amount))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.method}</TableCell>
                    <TableCell>
                      {p.status === "Verified" ? (
                        <Badge variant="statusCompleted" className="gap-1 rounded-full px-3 py-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : p.status === "Rejected" ? (
                        <Badge variant="statusRejected" className="gap-1 rounded-full px-3 py-1">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="statusPending" className="gap-1 rounded-full px-3 py-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="reserve"
                        className="h-8 text-xs"
                        onClick={() => openReviewDialog(p)}
                        disabled={p.status === "Verified" || p.status === "Rejected"}
                      >
                        Verify
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </div>

      <Dialog
        open={isReviewOpen}
        onOpenChange={(open) => {
          setIsReviewOpen(open);
          if (!open) setSelectedPayment(null);
        }}
      >
        <DialogContent className="max-w-2xl gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
            <DialogDescription>Review proof of payment and client booking details.</DialogDescription>
          </DialogHeader>

          {selectedPayment && selectedPayment.reservation && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Proof of payment</p>
                <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                  {selectedPayment.proof_storage_path?.startsWith("data:image/") ||
                  selectedPayment.proof_storage_path?.startsWith("http") ? (
                    <img
                      src={selectedPayment.proof_storage_path}
                      alt={selectedPayment.proof_file_name ?? "Payment proof"}
                      className="h-full w-full rounded-md object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-xs font-medium">{selectedPayment.proof_file_name ?? "No file name recorded"}</p>
                      <p className="text-[0.7rem] text-muted-foreground">No preview available for this file type.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Client information</p>
                <div className="grid gap-2 text-xs">
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Booking ID</p>
                    <p className="font-medium text-foreground">{selectedPayment.reservation.reference_code}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Guest</p>
                    <p className="font-medium text-foreground">
                      {selectedPayment.reservation.guest_profile?.full_name ?? selectedPayment.reservation.guest_name}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Cottage</p>
                    <p className="font-medium text-foreground">{selectedPayment.reservation.cottage?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Guests</p>
                    <p className="font-medium text-foreground">{selectedPayment.reservation.guest_count}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Total (reservation)</p>
                    <p className="font-semibold text-[#15803D]">
                      {formatMoney(Number(selectedPayment.reservation.total_amount))}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Payment method</p>
                    <p className="font-medium text-foreground">{selectedPayment.method}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="reject"
              onClick={() => void updatePaymentStatus("Rejected")}
              disabled={verifyBusy !== null}
            >
              {verifyBusy === "Rejected" ? "Rejecting..." : "Reject"}
            </Button>
            <Button
              type="button"
              variant="approve"
              onClick={() => void updatePaymentStatus("Verified")}
              disabled={verifyBusy !== null}
            >
              {verifyBusy === "Verified" ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
