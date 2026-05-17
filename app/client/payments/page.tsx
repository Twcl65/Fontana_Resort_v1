"use client";

import { useCallback, useEffect, useState, ChangeEvent } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UploadCloud, QrCode, CheckCircle2 } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { listReservationsForUser, upsertPaymentForReservation, type ReservationWithRelations } from "@/lib/fontana-data";

const gcashDetails = {
  name: "Fontana Blue Cold Spring",
  number: "0912-345-6789"
};

export default function ClientPaymentsPage() {
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setLoadError("Please sign in.");
        return;
      }
      const { data, error } = await listReservationsForUser(current.dbUser.id);
      if (error) setLoadError(error);
      const unpaid = (data ?? []).filter(
        (r) => r.payment_status === "Unpaid" && r.reservation_status !== "Cancelled"
      );
      setReservations(unpaid);
      setSelectedId((prev) => prev || unpaid[0]?.id || "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = reservations.find((r) => r.id === selectedId) ?? reservations[0] ?? null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setProofFile(file);
    setUploadError(null);
    setIsSubmitted(false);
  };

  const handleConfirmPayment = () => {
    if (!selected) {
      setUploadError("No unpaid reservation to pay for.");
      return;
    }
    if (!proofFile) {
      setUploadError("Please upload a clear screenshot of your GCash receipt.");
      setIsSubmitted(false);
      return;
    }

    setUploadError(null);
    setShowConfirmDialog(true);
  };

  const submitProof = async () => {
    if (!selected || !proofFile) return;
    setSubmitting(true);
    setUploadError(null);
    const proofDataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(proofFile);
    });
    const { error: payErr } = await upsertPaymentForReservation({
      reservation_id: selected.id,
      amount: Number(selected.total_amount),
      method: "GCash",
      proof_file_name: proofFile.name,
      proof_storage_path: proofDataUrl,
    });
    setSubmitting(false);
    if (payErr) {
      setUploadError(payErr);
      return;
    }
    setIsSubmitted(true);
    setShowConfirmDialog(false);
    setShowSuccessDialog(true);
    await load();
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{loadError}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-md font-semibold tracking-tight">
              My Payments
            </h1>
            <p className="text-xs text-muted-foreground">
              Review your booking and submit proof of payment.
            </p>
          </div>
        </div>

        <Badge className="w-fit rounded-full bg-amber-50 px-3 py-1 text-[0.7rem] font-medium text-amber-800 border border-amber-200">
          {selected ? "Pending · Awaiting proof of payment" : "No unpaid bookings"}
        </Badge>
      </div>

      {reservations.length > 1 ? (
        <div className="max-w-md space-y-1">
          <Label className="text-xs">Reservation to pay</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reference_code} · {r.cottage?.name ?? "Cottage"} · ₱{Number(r.total_amount).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b bg-muted/40">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Booking Summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Check that all details below match your reservation.
            </p>
          </div>
          <Badge className="rounded-full bg-slate-900 px-3 py-1 text-[0.7rem] font-medium text-white">
            Booking: {selected?.reference_code ?? "—"}
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">You have no unpaid reservations.</p>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs sm:text-sm">
            <div className="space-y-0.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Cottage
              </p>
              <p className="font-medium text-foreground">
                {selected.cottage?.name ?? "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Guest Name
              </p>
              <p className="font-medium text-foreground">
                {selected.guest_name}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Number of Guests
              </p>
              <p className="font-medium text-foreground">
                {selected.guest_count} Person
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Stay
              </p>
              <p className="font-medium text-foreground">
                {selected.check_in} → {selected.check_out}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Total Price
              </p>
              <p className="font-semibold text-[#15803D]">
                ₱{Number(selected.total_amount).toLocaleString()}
              </p>
            </div>
          </div>
          )}
        </CardContent>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Scan to Pay via GCash
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row">
            <div className="flex w-full justify-center sm:w-1/2">
              <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <QrCode className="h-10 w-10 text-primary" />
                  <p className="text-xs font-medium text-primary">
                    GCash QR Code
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground max-w-[160px]">
                    Scan using your GCash app to complete payment.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:w-1/2">
              <div>
                <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  GCash Name
                </p>
                <p className="font-medium text-foreground">
                  {gcashDetails.name}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  GCash Number
                </p>
                <p className="font-medium text-foreground">
                  {gcashDetails.number}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Total Amount
                </p>
                <p className="text-base font-semibold text-[#15803D]">
                  {selected ? `₱${Number(selected.total_amount).toLocaleString()}` : "—"}
                </p>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                After payment, take a screenshot of your GCash receipt and
                upload it in the Proof of Payment section.
              </p>
            </div>
          </CardContent>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Upload Proof of Payment
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Please upload a clear screenshot or photo of your GCash
                  receipt.
                </p>
              </div>
              {isSubmitted && (
                <Badge variant="statusCompleted" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Submitted
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label
                htmlFor="proof-upload"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Proof of Payment
              </Label>
              <label
                htmlFor="proof-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-primary hover:bg-primary/5"
              >
                <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  Drag and drop file here or{" "}
                  <span className="text-primary underline">choose file</span>
                </p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  JPG, PNG or PDF up to 10 MB.
                </p>
                {proofFile && (
                  <p className="mt-2 rounded-full bg-white/80 px-3 py-1 text-[0.7rem] font-medium text-foreground shadow-sm">
                    Selected: {proofFile.name}
                  </p>
                )}
              </label>
              <Input
                id="proof-upload"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={handleFileChange}
              />
              {uploadError && (
                <p className="mt-2 text-[0.7rem] text-red-600">
                  {uploadError}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="save" className="w-full sm:w-auto text-sm font-semibold" onClick={handleConfirmPayment}>
                Confirm Payment
              </Button>
            </div>
          </CardContent>
        </div>
      </section>

      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm border border-border bg-card">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold">
                Submit payment proof?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                Make sure the uploaded screenshot clearly shows the GCash reference
                number, date, and paid amount before submitting.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="cancelMuted"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="save"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={submitting}
                  onClick={() => void submitProof()}
                >
                  {submitting ? "Saving…" : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm border border-border bg-card">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                <CardTitle className="text-sm font-semibold">
                  Payment submitted successfully
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                Your proof of payment has been submitted. Our staff will review and
                update your reservation status shortly.
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="save"
                  size="sm"
                  className="h-8 px-4 text-xs"
                  onClick={() => setShowSuccessDialog(false)}
                >
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

