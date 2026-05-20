"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { PaymentVerificationBadge } from "@/components/ui/status-badges";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  User,
  Wallet,
  WalletCards,
} from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { getAdminMessageThreads, listPaymentsAdmin, listReservationsAdmin, type PaymentWithRelations } from "@/lib/fontana-data";

export default function CashierDashboardPage() {
  const [dashSearch, setDashSearch] = useState("");
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

  const recentTransactions = useMemo(() => payments.slice(0, 8), [payments]);

  const filteredTransactions = useMemo(() => {
    const q = dashSearch.trim().toLowerCase();
    if (!q) return recentTransactions;
    return recentTransactions.filter((row) => {
      const ref = row.reservation?.reference_code?.toLowerCase() ?? "";
      const guest = (row.reservation?.guest_profile?.full_name ?? row.reservation?.guest_name ?? "").toLowerCase();
      const method = row.method.toLowerCase();
      const status = row.status.toLowerCase();
      return ref.includes(q) || guest.includes(q) || method.includes(q) || status.includes(q);
    });
  }, [dashSearch, recentTransactions]);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Cashier Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track totals, transactions, and cashier account information in one place.
          </p>
        </div>
        <Button asChild variant="save" className="shrink-0">
          <Link href="/cashier/payments" className="inline-flex items-center gap-2">
            <WalletCards className="h-4 w-4" />
            Open Payments
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Today&apos;s Transactions</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.todayTransactions}</p>
              <p className="text-right text-xs text-muted-foreground">{`P${stats.todayAmount.toLocaleString()}`}</p>
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
              <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              <p className="text-right text-xs text-muted-foreground">Need verification</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Verified Payments</CardTitle>
            <CheckCircle2 className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.verifiedPayments}</p>
              <p className="text-right text-xs text-muted-foreground">Successfully confirmed</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Today&apos;s Stay-ins</CardTitle>
            <CalendarClock className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{todayReservations}</p>
              <p className="text-right text-xs text-muted-foreground">Guests currently booked</p>
            </div>
          </CardContent>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Cashier Profile</CardTitle>
            <User className="h-4 w-4 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2 px-4 py-3 pt-1 text-sm">
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
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Open Guest Messages</CardTitle>
            <MessageSquare className="h-4 w-4 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{messageThreads}</p>
              <p className="text-right text-xs text-muted-foreground">Threads needing attention</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Operations Shortcuts</CardTitle>
            <CalendarClock className="h-4 w-4 shrink-0" />
          </CardHeader>
          <CardContent className="flex flex-col gap-0 px-4 py-3 pt-0">
            <Button asChild size="sm" variant="outline" className="h-8 w-full justify-center text-xs">
              <Link href="/cashier/reservations">Reservations</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 w-full justify-center text-xs">
              <Link href="/cashier/payments">Payments</Link>
            </Button>
          </CardContent>
        </div>
      </section>

      <PageToolbar
        searchValue={dashSearch}
        onSearchChange={setDashSearch}
        searchPlaceholder="Search recent transactions..."
      />

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
          <p className="text-xs text-muted-foreground">Latest payment records in the system.</p>
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
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && recentTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
              {!loading && recentTransactions.length > 0 && filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions match your search.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredTransactions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.reservation?.reference_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.reservation?.guest_profile?.full_name ?? r.reservation?.guest_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.method}</TableCell>
                    <TableCell>
                      <PaymentVerificationBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm">{`P${Number(r.amount).toLocaleString()}`}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="view" className="h-8 gap-1.5 rounded-sm px-3 text-xs" asChild>
                        <Link href="/cashier/payments">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </div>
    </div>
  );
}
