"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ReservationStatusBadge } from "@/components/ui/status-badges";
import { Building2, CalendarClock, Wallet, Plus, Eye } from "lucide-react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { getDashboardStats, listReservationsAdmin, type ReservationWithRelations } from "@/lib/fontana-data";

function formatDateRange(checkIn: string, checkOut: string) {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${new Date(checkIn + "T12:00:00").toLocaleDateString("en-US", o)} – ${new Date(checkOut + "T12:00:00").toLocaleDateString("en-US", o)}`;
}

function guestLabel(r: ReservationWithRelations) {
  return r.guest_profile?.full_name?.trim() || r.guest_name;
}

export default function AdminDashboardPage() {
  const [dashSearch, setDashSearch] = useState("");
  const [stats, setStats] = useState({ cottages: 0, activeReservations: 0, pendingPayments: 0 });
  const [recent, setRecent] = useState<ReservationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, r] = await Promise.all([getDashboardStats(), listReservationsAdmin()]);
    if (s.error) setError(s.error);
    setStats(s.data);
    if (r.error) setError(r.error);
    setRecent(r.data.slice(0, 8));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRecent = useMemo(() => {
    const q = dashSearch.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter(
      (row) =>
        row.reference_code.toLowerCase().includes(q) ||
        (row.cottage?.name ?? "").toLowerCase().includes(q) ||
        guestLabel(row).toLowerCase().includes(q)
    );
  }, [dashSearch, recent]);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of cottages, reservations, and payments.</p>
        </div>
        <Button asChild variant="save" className="shrink-0">
          <Link href="/admin/reservations" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Reservation
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Manage Cottage</CardTitle>
            <Building2 className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.cottages}</p>
              <p className="text-right text-xs text-muted-foreground">Listed cottages</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Active Reservations</CardTitle>
            <CalendarClock className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.activeReservations}</p>
              <p className="text-right text-xs text-muted-foreground">Upcoming & ongoing</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              <p className="text-right text-xs text-muted-foreground">Awaiting verification</p>
            </div>
          </CardContent>
        </div>
      </section>

      <PageToolbar searchValue={dashSearch} onSearchChange={setDashSearch} searchPlaceholder="Search recent reservations..." />

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Recent reservations</CardTitle>
          <p className="text-xs text-muted-foreground">Latest bookings across all guests.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cottage</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && recent.length > 0 && filteredRecent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations match your search.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredRecent.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.reference_code}</TableCell>
                  <TableCell className="font-medium">{row.cottage?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{guestLabel(row)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateRange(row.check_in, row.check_out)}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={row.reservation_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="view" className="h-8 gap-1.5 rounded-sm px-3 text-xs" asChild>
                      <Link href="/admin/reservations">
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
