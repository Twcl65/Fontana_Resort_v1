/* eslint-disable react-hooks/rules-of-hooks */
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
import { Input } from "@/components/ui/input";
import { Eye, CalendarPlus, CalendarCheck, Wallet, X, Plus } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import {
  listReservationsForUser,
  type ReservationWithRelations,
  type PaymentStatus,
  type ReservationStatus
} from "@/lib/fontana-data";

const ROWS_PER_PAGE = 5;

function formatDateRange(checkIn: string, checkOut: string) {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${new Date(checkIn + "T12:00:00").toLocaleDateString("en-US", o)} – ${new Date(checkOut + "T12:00:00").toLocaleDateString("en-US", o)}`;
}

type DashboardRow = {
  id: string;
  referenceCode: string;
  cottageName: string;
  dateRange: string;
  guests: number;
  payment: PaymentStatus;
  status: ReservationStatus;
};

export default function StudentDashboardPage() {
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [selectedReservation, setSelectedReservation] = useState<DashboardRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setLoadError("Please sign in to view your dashboard.");
        setReservations([]);
        return;
      }
      const { data, error } = await listReservationsForUser(current.dbUser.id);
      if (error) setLoadError(error);
      setReservations(data ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load reservations.");
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    const activeReservation = reservations.filter(
      (r) => r.check_out >= today && r.reservation_status !== "Cancelled"
    ).length;
    const totalBooking = reservations.length;
    const pendingPayments = reservations.filter(
      (r) => r.payment_status === "Unpaid" && r.reservation_status !== "Cancelled"
    ).length;
    return { activeReservation, totalBooking, pendingPayments };
  }, [reservations, today]);

  const rows: DashboardRow[] = useMemo(
    () =>
      reservations.map((r) => ({
        id: r.id,
        referenceCode: r.reference_code,
        cottageName: r.cottage?.name ?? "—",
        dateRange: formatDateRange(r.check_in, r.check_out),
        guests: r.guest_count,
        payment: r.payment_status,
        status: r.reservation_status
      })),
    [reservations]
  );

  const filteredReservations = useMemo(
    () =>
      rows.filter((res) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          res.referenceCode.toLowerCase().includes(q) ||
          res.cottageName.toLowerCase().includes(q) ||
          res.dateRange.toLowerCase().includes(q) ||
          res.payment.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || res.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [rows, search, statusFilter]
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / ROWS_PER_PAGE));
  const paginatedReservations = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredReservations.slice(start, start + ROWS_PER_PAGE);
  }, [filteredReservations, page]);

  const from =
    filteredReservations.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredReservations.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredReservations.length);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{loadError}</p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Fontana Blue Cold Spring Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track your reservations and payment status.</p>
        </div>
        <Button asChild variant="book" className="shrink-0">
          <Link href="/client/cottage" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Book New Cottage
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      ) : null}

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Active Reservation</CardTitle>
            <CalendarCheck className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.activeReservation}</p>
              <p className="text-right text-xs text-muted-foreground">Upcoming & ongoing (not cancelled)</p>
            </div>
          </CardContent>
        </div>
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b-0 bg-white px-4 py-3 pb-2 text-foreground">
            <CardTitle className="text-sm font-medium">Total Booking</CardTitle>
            <CalendarPlus className="h-4 w-4" />
          </CardHeader>
          <CardContent className="px-4 py-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold">{stats.totalBooking}</p>
              <p className="text-right text-xs text-muted-foreground">All-time bookings</p>
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
              <p className="text-right text-xs text-muted-foreground">Unpaid, active bookings</p>
            </div>
          </CardContent>
        </div>
      </section>

      {/* Reservation details table */}
      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Your reservations</CardTitle>
              <p className="text-xs text-muted-foreground">Reference, cottage, dates, and status from your account.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search reference, cottage, dates…"
                className="h-9 w-full text-sm sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-40"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatusFilter(e.target.value === "all" ? "all" : (e.target.value as ReservationStatus))
                }
              >
                <option value="all">All status</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Cottage</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {loadError ?? "No reservations yet."}
                  </TableCell>
                </TableRow>
              ) : filteredReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations match your search or status filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{res.referenceCode}</TableCell>
                    <TableCell className="font-medium">{res.cottageName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{res.dateRange}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{res.guests}</TableCell>
                    <TableCell className="text-sm">{res.payment}</TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={res.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="view"
                        className="h-8 gap-1.5 rounded-sm px-4 text-xs"
                        onClick={() => {
                          setSelectedReservation(res);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!loading && filteredReservations.length > ROWS_PER_PAGE && (
            <div className="mt-4 flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {from}–{to} of {filteredReservations.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </div>

      {showDetailsDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Reservation Details</CardTitle>
                <p className="text-xs text-muted-foreground">Cottage reservation information.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => setShowDetailsDialog(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Reference</p>
                <p className="font-mono text-sm text-muted-foreground">{selectedReservation.referenceCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Cottage</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.cottageName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Dates</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.dateRange}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Guests</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.guests}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Payment</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.payment}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Status</p>
                <ReservationStatusBadge status={selectedReservation.status} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
