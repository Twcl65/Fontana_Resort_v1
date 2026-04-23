/* eslint-disable react-hooks/rules-of-hooks */
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
import { Button } from "@/components/ui/button";
import { ReservationStatusBadge } from "@/components/ui/status-badges";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { X, Eye } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import {
  listReservationsForUser,
  type ReservationStatus,
  type ReservationWithRelations
} from "@/lib/fontana-data";

const ROWS_PER_PAGE = 5;

type Reservation = {
  id: string;
  referenceCode: string;
  dorm: string;
  date: string;
  guest: string;
  payment: "Paid" | "Unpaid" | "Refunded";
  status: ReservationStatus;
};

function formatDateRange(checkIn: string, checkOut: string) {
  const o: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  return `${new Date(checkIn + "T12:00:00").toLocaleDateString("en-US", o)} – ${new Date(checkOut + "T12:00:00").toLocaleDateString("en-US", o)}`;
}

function mapRow(r: ReservationWithRelations): Reservation {
  return {
    id: r.id,
    referenceCode: r.reference_code,
    dorm: r.cottage?.name ?? "—",
    date: formatDateRange(r.check_in, r.check_out),
    guest: `${r.guest_count} guest(s)`,
    payment: r.payment_status,
    status: r.reservation_status
  };
}

export default function StudentReservationsPage() {
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReservationStatus | "all">("all");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setLoadError("Please sign in.");
        setReservationsData([]);
        return;
      }
      const { data, error } = await listReservationsForUser(current.dbUser.id);
      if (error) setLoadError(error);
      const today = new Date().toISOString().slice(0, 10);
      const past = (data ?? []).filter((r) => r.check_out < today);
      setReservationsData(past.map(mapRow));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredReservations = useMemo(
    () =>
      reservationsData.filter((res) => {
        const q = search.trim().toLowerCase();
  
        const matchesSearch =
          q.length === 0 ||
          res.referenceCode.toLowerCase().includes(q) ||
          res.dorm.toLowerCase().includes(q) ||
          res.guest.toLowerCase().includes(q);
  
        const matchesStatus =
          statusFilter === "all" || res.status === statusFilter;
  
        return matchesSearch && matchesStatus;
      }),
    [reservationsData, search, statusFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReservations.length / ROWS_PER_PAGE)
  );

  const paginatedReservations = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredReservations.slice(start, end);
  }, [filteredReservations, page]);

  const from =
    filteredReservations.length === 0
      ? 0
      : (page - 1) * ROWS_PER_PAGE + 1;
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
      <div className="flex flex-col gap-0 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">
            Booking History
          </h1>
          <p className="text-sm text-muted-foreground">
            View the booking history and details of your reservations.
          </p>
        </div>
      </div>

      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <PageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reference, cottage, or guest count..."
      >
        <select
          className="h-9 w-full min-w-[8rem] rounded-md border border-input bg-background px-2 text-xs sm:w-40"
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setStatusFilter(
              e.target.value === "all" ? "all" : (e.target.value as ReservationStatus)
            )
          }
        >
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </PageToolbar>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">History</CardTitle>
          <p className="text-xs text-muted-foreground">
            Past stays only (check-out before today).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading history…</p>
          ) : reservationsData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No past reservations yet.
            </p>
          ) : filteredReservations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No past reservations match your search or status filter.
            </p>
          ) : (
          <Table bordered={false}>
            <TableHeader>
  <TableRow>
    <TableHead>Reference</TableHead>
    <TableHead>Cottage Name</TableHead>
    <TableHead>Reservation Date</TableHead>
    <TableHead>Guest</TableHead>
    <TableHead>Payment</TableHead>
    <TableHead>Status</TableHead>
    <TableHead className="text-right pr-4 font-semibold text-slate-600">
      Actions
    </TableHead>
  </TableRow>
</TableHeader>
            <TableBody>
              {paginatedReservations.map((res) => (
                <TableRow key={res.id}>
                <TableCell className="text-xs font-mono text-slate-500">
                  {res.referenceCode}
                </TableCell>
              
                <TableCell className="text-sm font-medium text-slate-800">
                  {res.dorm}
                </TableCell>
              
                <TableCell className="text-xs text-slate-700">
                  {res.date}
                </TableCell>
              
                <TableCell className="text-xs text-slate-700">
                  {res.guest}
                </TableCell>
              
                <TableCell className="text-xs text-slate-700">
                  {res.payment}
                </TableCell>
              
                <TableCell>
                  <ReservationStatusBadge status={res.status} />
                </TableCell>
              
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="view"
                      size="sm"
                      className="h-8 gap-1.5 rounded-sm px-4 text-xs"
                      onClick={() => {
                        setSelectedReservation(res);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Reservation details dialog */}
{showDetailsDialog && selectedReservation && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <Card className="w-full max-w-md border border-border bg-card">
      
      <CardHeader className="flex flex-row items-start justify-between border-b pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Reservation Details
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            View the details of your reservation.
          </p>
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
          <p className="font-mono text-sm text-muted-foreground">
            {selectedReservation.referenceCode}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Cottage Name</p>
          <p className="text-sm text-muted-foreground">
            {selectedReservation.dorm}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Reservation Date</p>
          <p className="text-sm text-muted-foreground">
            {selectedReservation.date}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Guest</p>
          <p className="text-sm text-muted-foreground">
            {selectedReservation.guest}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Payment</p>
          <p className="text-sm text-muted-foreground">
            {selectedReservation.payment}
          </p>
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

