"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, MessageSquare, WalletCards } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { getAdminMessageThreads, listPaymentsAdmin, listReservationsAdmin, type PaymentWithRelations } from "@/lib/fontana-data";

export default function CashierDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cashier, setCashier] = useState({ fullName: "Cashier", email: "", role: "cashier" });
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [todayReservations, setTodayReservations] = useState(0);
  const [messageThreads, setMessageThreads] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [current, paymentsRes, reservationsRes, messageRes] = await Promise.all([
      fetchCurrentUserWithRole(),
      listPaymentsAdmin(),
      listReservationsAdmin(),
      getAdminMessageThreads(),
    ]);

    if (!current) {
      setError("Unable to load cashier account.");
    } else {
      setCashier({
        fullName: current.dbUser.full_name?.trim() || "Cashier",
        email: current.dbUser.email,
        role: current.dbUser.role,
      });
    }

    if (paymentsRes.error) setError(paymentsRes.error);
    setPayments(paymentsRes.data);

    if (reservationsRes.error) setError(reservationsRes.error);
    const today = new Date().toISOString().slice(0, 10);
    setTodayReservations(
      reservationsRes.data.filter((r) => r.check_in <= today && r.check_out >= today && r.reservation_status !== "Cancelled")
        .length
    );

    if (messageRes.error) setError(messageRes.error);
    setMessageThreads(messageRes.data.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayPayments = payments.filter((p) => p.created_at?.slice(0, 10) === today);
    const pending = payments.filter((p) => p.status === "Pending").length;
    const verified = payments.filter((p) => p.status === "Verified").length;
    const totalAmount = todayPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    return {
      pendingPayments: pending,
      verifiedPayments: verified,
      todayTransactions: todayPayments.length,
      todayAmount: totalAmount,
    };
  }, [payments]);

  const recentTransactions = useMemo(() => payments.slice(0, 6), [payments]);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 className="text-md font-semibold tracking-tight">Cashier Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track totals, transactions, and cashier account information in one place.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today&apos;s Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.todayTransactions}</p>
            <p className="text-xs text-muted-foreground">{`P${stats.todayAmount.toLocaleString()}`}</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingPayments}</p>
            <p className="text-xs text-muted-foreground">Need verification</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Verified Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.verifiedPayments}</p>
            <p className="text-xs text-muted-foreground">Successfully confirmed</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today&apos;s Stay-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayReservations}</p>
            <p className="text-xs text-muted-foreground">Guests currently booked</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cashier Profile</CardTitle>
            <CardDescription className="text-xs">Current logged-in staff details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {cashier.fullName}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {cashier.email || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Role:</span> {cashier.role}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Guest Messages</CardTitle>
            <CardDescription className="text-xs">Customer conversation threads requiring attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{messageThreads}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Operations Shortcuts</CardTitle>
            <CardDescription className="text-xs">Common cashier tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/cashier/reservations">
                <CalendarClock className="mr-1 h-3.5 w-3.5" />
                Reservations
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/cashier/payments">
                <WalletCards className="mr-1 h-3.5 w-3.5" />
                Payments
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
          <CardDescription>Latest payment records in the system.</CardDescription>
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
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((r) => (
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
