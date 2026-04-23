"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listPaymentsAdmin, type PaymentWithRelations } from "@/lib/fontana-data";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

export default function CashierInvoicesReceiptsPage() {
  const [rows, setRows] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [issuerName, setIssuerName] = useState("Front Desk Cashier");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listPaymentsAdmin();
    if (err) setError(err);
    setRows((data ?? []).filter((p) => p.status === "Verified"));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const current = await fetchCurrentUserWithRole();
        if (!current) return;
        const name = current.dbUser.full_name?.trim();
        if (name) setIssuerName(name);
      } catch {
        // keep default issuer label if profile lookup fails
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const ref = r.reservation?.reference_code ?? "";
      const guest = r.reservation?.guest_profile?.full_name ?? r.reservation?.guest_name ?? "";
      const cottage = r.reservation?.cottage?.name ?? "";
      return ref.toLowerCase().includes(q) || guest.toLowerCase().includes(q) || cottage.toLowerCase().includes(q);
    });
  }, [rows, search]);

  const generateReceipt = (r: PaymentWithRelations) => {
    generateReceiptPdf({
      receiptId: r.id,
      referenceCode: r.reservation?.reference_code ?? "N/A",
      guestName: r.reservation?.guest_profile?.full_name ?? r.reservation?.guest_name ?? "N/A",
      guestEmail: r.reservation?.guest_profile?.email ?? r.reservation?.guest_email ?? null,
      cottageName: r.reservation?.cottage?.name ?? "N/A",
      reservationDateLabel: r.created_at ? new Date(r.created_at).toLocaleDateString() : "N/A",
      paymentMethod: r.method,
      paymentStatus: r.status,
      amount: Number(r.amount ?? 0),
      paidAt: r.created_at ?? null,
      issuedBy: issuerName,
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Invoices and Receipts</h1>
        <p className="text-xs text-muted-foreground">Verified payments ready for invoice or receipt issuance.</p>
      </div>

      <div className="w-full max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference, guest, or cottage..."
          className="h-9 text-sm"
        />
      </div>

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Verified transactions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Cottage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading verified payments...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No verified transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.reservation?.reference_code ?? "—"}</TableCell>
                    <TableCell>{r.reservation?.guest_profile?.full_name ?? r.reservation?.guest_name ?? "—"}</TableCell>
                    <TableCell>{r.reservation?.cottage?.name ?? "—"}</TableCell>
                    <TableCell>{`P${Number(r.amount).toLocaleString()}`}</TableCell>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="save" onClick={() => generateReceipt(r)}>
                        Download Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </div>
    </div>
  );
}
