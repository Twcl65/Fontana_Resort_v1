"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPaymentsAdmin, type PaymentWithRelations } from "@/lib/fontana-data";

export default function CashierDailyTransactionPage() {
  const [rows, setRows] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listPaymentsAdmin();
    if (err) setError(err);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = useMemo(
    () => rows.filter((r) => r.created_at && r.created_at.slice(0, 10) === today),
    [rows, today]
  );
  const total = todayRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Daily Transaction</h1>
        <p className="text-xs text-muted-foreground">Today&apos;s payment activity and total amount processed.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today&apos;s transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{`P${total.toLocaleString()}`}</p>
          </CardContent>
        </Card>
      </section>

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Transaction list</CardTitle>
          <CardDescription>Date: {today}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : todayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions for today.
                  </TableCell>
                </TableRow>
              ) : (
                todayRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.reservation?.reference_code ?? "—"}</TableCell>
                    <TableCell>{r.reservation?.guest_profile?.full_name ?? r.reservation?.guest_name ?? "—"}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{`P${Number(r.amount).toLocaleString()}`}</TableCell>
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
