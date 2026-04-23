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
import { generateReceiptPdf } from "@/lib/receipt-pdf";

const ROWS_PER_PAGE = 5;

type Reservation = {
  id: string;
  referenceCode: string;
  dorm: string;
  date: string;
  guest: string;
  guestEmail: string | null;
  payment: "Paid" | "Unpaid" | "Refunded";
  status: ReservationStatus;
  totalAmount: number;
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
    guest: r.guest_profile?.full_name ?? r.guest_name ?? `${r.guest_count} guest(s)`,
    guestEmail: r.guest_profile?.email ?? r.guest_email ?? null,
    payment: r.payment_status,
    status: r.reservation_status,
    totalAmount: Number(r.total_amount ?? 0),
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
      setReservationsData((data ?? []).map(mapRow));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load reservations.");
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

  const downloadReceipt = (res: Reservation) => {
    generateReceiptPdf({
      receiptId: res.id,
      referenceCode: res.referenceCode,
      guestName: res.guest,
      guestEmail: res.guestEmail,
      cottageName: res.dorm,
      reservationDateLabel: res.date,
      paymentMethod: "Client Portal",
      paymentStatus: `${res.payment} / ${res.status}`,
      amount: res.totalAmount,
      paidAt: null,
      issuedBy: "Client Portal",
    });
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{loadError}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading reservations...</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-md font-semibold tracking-tight">
            My Reservations
          </h4>
          <p className="text-sm text-muted-foreground">
            View the status and details of your dorm reservations.
          </p>
        </div>
      </div>

      <PageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reservation ID, cottage, or guest..."
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
          <option value="all">All status</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </PageToolbar>

      <div className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">Reservations</CardTitle>
          <p className="text-xs text-muted-foreground">Current and past reservation requests.</p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
  <TableRow>
    <TableHead>ID</TableHead>
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
              {!loading && reservationsData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && reservationsData.length > 0 && filteredReservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations match your search or status filter.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                paginatedReservations.map((res) => (
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
                    <Button
                      variant="save"
                      size="sm"
                      className="h-8 rounded-sm px-4 text-xs"
                      onClick={() => downloadReceipt(res)}
                    >
                      Download Receipt
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>

          
        </CardContent>
      </div>

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
          <p className="text-sm font-medium">Reservation ID</p>
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

