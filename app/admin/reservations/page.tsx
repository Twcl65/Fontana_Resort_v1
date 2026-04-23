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
import { ReservationStatusBadge } from "@/components/ui/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Pencil, Archive, Plus } from "lucide-react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import {
  archiveReservation,
  insertReservation,
  listClientUsers,
  listCottages,
  listReservationsAdmin,
  nightsBetween,
  updateReservation,
  type FontanaCottageRow,
  type ReservationWithRelations,
  type PaymentStatus,
  type ReservationStatus
} from "@/lib/fontana-data";

const ROWS_PER_PAGE = 5;

function formatDateRange(checkIn: string, checkOut: string) {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${new Date(checkIn + "T12:00:00").toLocaleDateString("en-US", o)} – ${new Date(checkOut + "T12:00:00").toLocaleDateString("en-US", o)}`;
}

function guestLabel(r: ReservationWithRelations) {
  const name = r.guest_profile?.full_name?.trim() || r.guest_name;
  const email = r.guest_profile?.email || r.guest_email;
  return email ? `${name} (${email})` : name;
}

type ReservationForm = {
  cottage_id: string;
  user_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  guest_count: string;
  payment: PaymentStatus;
  status: ReservationStatus;
  notes: string;
};

export default function AdminReservationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [cottages, setCottages] = useState<FontanaCottageRow[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ReservationWithRelations | null>(null);
  const [actionBusy, setActionBusy] = useState<"add" | "edit" | "archive" | "unarchive" | null>(null);
  const [form, setForm] = useState<ReservationForm>({
    cottage_id: "",
    user_id: "",
    guest_name: "",
    guest_email: "",
    check_in: "",
    check_out: "",
    guest_count: "2",
    payment: "Unpaid",
    status: "Pending",
    notes: ""
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [r, c, u] = await Promise.all([
      listReservationsAdmin(),
      listCottages({ includeArchived: true }),
      listClientUsers()
    ]);
    if (r.error) setError(r.error);
    setReservations(r.data);
    setCottages(c.data);
    if (c.error) setError(c.error);
    setClients(u.data);
    if (u.error) setError(u.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const resetForm = () => {
    const firstCottage = cottages.find((c) => c.status !== "Archived")?.id ?? cottages[0]?.id ?? "";
    setForm({
      cottage_id: firstCottage,
      user_id: "",
      guest_name: "",
      guest_email: "",
      check_in: "",
      check_out: "",
      guest_count: "2",
      payment: "Unpaid",
      status: "Pending",
      notes: ""
    });
  };

  useEffect(() => {
    if (cottages.length && !form.cottage_id) {
      const id = cottages.find((c) => c.status !== "Archived")?.id ?? cottages[0].id;
      setForm((f) => ({ ...f, cottage_id: id }));
    }
  }, [cottages, form.cottage_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (!q) return true;
      const cottageName = r.cottage?.name ?? "";
      return (
        r.reference_code.toLowerCase().includes(q) ||
        cottageName.toLowerCase().includes(q) ||
        guestLabel(r).toLowerCase().includes(q)
      );
    });
  }, [search, reservations]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const rows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const openAddDialog = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditDialog = (reservation: ReservationWithRelations) => {
    setEditTargetId(reservation.id);
    setForm({
      cottage_id: reservation.cottage_id,
      user_id: reservation.user_id ?? "",
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email ?? "",
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      guest_count: String(reservation.guest_count),
      payment: reservation.payment_status,
      status: reservation.reservation_status,
      notes: reservation.notes ?? ""
    });
    setIsEditOpen(true);
  };

  const openArchiveDialog = (reservation: ReservationWithRelations) => {
    setArchiveTarget(reservation);
    setIsArchiveOpen(true);
  };

  const computeTotal = () => {
    const cottage = cottages.find((c) => c.id === form.cottage_id);
    if (!cottage || !form.check_in || !form.check_out) return 0;
    const n = nightsBetween(form.check_in, form.check_out);
    return n * Number(cottage.rate_night);
  };

  const handleAddReservation = async () => {
    setActionBusy("add");
    if (!form.cottage_id || !form.check_in || !form.check_out || !form.guest_name.trim()) {
      setError("Cottage, dates, and guest name are required.");
      setActionBusy(null);
      return;
    }
    const total = computeTotal();
    const { error: insErr } = await insertReservation({
      cottage_id: form.cottage_id,
      user_id: form.user_id.trim() || null,
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email.trim() || null,
      check_in: form.check_in,
      check_out: form.check_out,
      guest_count: Math.max(1, Number(form.guest_count) || 1),
      total_amount: total,
      payment_status: form.payment,
      reservation_status: form.status,
      notes: form.notes.trim() || null
    });
    if (insErr) {
      setError(insErr);
      setActionBusy(null);
      return;
    }
    await loadAll();
    setIsAddOpen(false);
    resetForm();
    setPage(1);
    setActionBusy(null);
  };

  const handleUpdateReservation = async () => {
    if (!editTargetId) return;
    setActionBusy("edit");
    const cottage = cottages.find((c) => c.id === form.cottage_id);
    const n =
      form.check_in && form.check_out && cottage
        ? nightsBetween(form.check_in, form.check_out) * Number(cottage.rate_night)
        : 0;
    const { error: updateErr } = await updateReservation(editTargetId, {
      cottage_id: form.cottage_id,
      user_id: form.user_id.trim() || null,
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email.trim() || null,
      check_in: form.check_in,
      check_out: form.check_out,
      guest_count: Math.max(1, Number(form.guest_count) || 1),
      total_amount: n,
      payment_status: form.payment,
      reservation_status: form.status,
      notes: form.notes.trim() || null
    });
    if (updateErr) {
      setError(updateErr);
      setActionBusy(null);
      return;
    }
    await loadAll();
    setIsEditOpen(false);
    setEditTargetId(null);
    setActionBusy(null);
  };

  const confirmArchiveReservation = async () => {
    if (!archiveTarget) return;
    setActionBusy("archive");
    const { error: archErr } = await archiveReservation(archiveTarget.id);
    if (archErr) {
      setError(archErr);
      setActionBusy(null);
      return;
    }
    await loadAll();
    setIsArchiveOpen(false);
    setArchiveTarget(null);
    setActionBusy(null);
  };

  const unarchiveReservation = async (reservation: ReservationWithRelations) => {
    setActionBusy("unarchive");
    const { error: upErr } = await updateReservation(reservation.id, { reservation_status: "Pending" });
    if (upErr) setError(upErr);
    await loadAll();
    setActionBusy(null);
  };

  const bookableCottages = useMemo(() => cottages.filter((c) => c.status !== "Archived"), [cottages]);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading reservations...</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Reservations</h1>
          <p className="text-xs text-muted-foreground">View and manage all guest reservations.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="save"
          className="w-fit"
          onClick={openAddDialog}
          disabled={loading || bookableCottages.length === 0}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Reservation
        </Button>
      </div>

      <PageToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by ID, cottage, or guest..."
      />

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">All reservations</CardTitle>
          <p className="text-xs text-muted-foreground">Search by ID, cottage, or guest name.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cottage</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && reservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && reservations.length > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reservations match your search.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.reservation_status === "Archived" ? "bg-muted/60 text-muted-foreground" : ""}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.reference_code}</TableCell>
                  <TableCell className="font-medium">{r.cottage?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{guestLabel(r)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateRange(r.check_in, r.check_out)}</TableCell>
                  <TableCell className="text-sm">{r.payment_status}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.reservation_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="edit"
                        className="h-8 gap-1.5 rounded-sm px-3 text-xs"
                        onClick={() => openEditDialog(r)}
                        disabled={r.reservation_status === "Archived"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="archive"
                        className="h-8 gap-1.5 rounded-sm px-3 text-xs"
                        disabled={r.reservation_status === "Archived" || actionBusy !== null}
                        onClick={() => openArchiveDialog(r)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                      {r.reservation_status === "Archived" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-sm px-3 text-xs"
                          disabled={actionBusy !== null}
                          onClick={() => void unarchiveReservation(r)}
                        >
                          {actionBusy === "unarchive" ? "Unarchiving..." : "Unarchive"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && filtered.length > ROWS_PER_PAGE && (
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Add Reservation</DialogTitle>
            <DialogDescription>Cottage, dates, and guest details. Total is computed from nightly rate × nights.</DialogDescription>
          </DialogHeader>
          <ReservationFormFields
            form={form}
            setForm={setForm}
            cottages={cottages}
            clients={clients}
            showArchivedReservationStatus={false}
          />
          <p className="text-xs text-muted-foreground">Estimated total: ₱{computeTotal().toLocaleString()}</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="save"
              onClick={() => void handleAddReservation()}
              disabled={actionBusy !== null}
            >
              {actionBusy === "add" ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
            <DialogDescription>Update reservation details.</DialogDescription>
          </DialogHeader>
          <ReservationFormFields
            form={form}
            setForm={setForm}
            cottages={cottages}
            clients={clients}
            showArchivedReservationStatus
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="save"
              onClick={() => void handleUpdateReservation()}
              disabled={actionBusy !== null}
            >
              {actionBusy === "edit" ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveOpen}
        onOpenChange={(open) => {
          setIsArchiveOpen(open);
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Archive reservation?</DialogTitle>
            <DialogDescription>
              This marks{" "}
              <span className="font-medium text-foreground">{archiveTarget?.reference_code ?? "this reservation"}</span>{" "}
              as archived. You can change status back from Edit if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="cancelMuted"
              onClick={() => {
                setIsArchiveOpen(false);
                setArchiveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="archive"
              onClick={() => void confirmArchiveReservation()}
              disabled={actionBusy !== null}
            >
              {actionBusy === "archive" ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReservationFormFields({
  form,
  setForm,
  cottages,
  clients,
  showArchivedReservationStatus
}: {
  form: ReservationForm;
  setForm: React.Dispatch<React.SetStateAction<ReservationForm>>;
  cottages: FontanaCottageRow[];
  clients: { id: string; full_name: string | null; email: string }[];
  showArchivedReservationStatus: boolean;
}) {
  const cottageOptions = cottages.filter(
    (c) => c.status !== "Archived" || c.id === form.cottage_id
  );

  return (
    <div className="grid max-h-[60vh] gap-2.5 overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label className="text-xs">Cottage</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.cottage_id}
          onChange={(e) => setForm((prev) => ({ ...prev, cottage_id: e.target.value }))}
        >
          {cottageOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status === "Archived" ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Guest account (optional)</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.user_id}
          onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))}
        >
          <option value="">Walk-in / no portal account</option>
          {clients.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.full_name ?? u.email) + ` (${u.email})`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Guest name</Label>
        <Input
          className="h-9 text-sm"
          value={form.guest_name}
          onChange={(e) => setForm((prev) => ({ ...prev, guest_name: e.target.value }))}
          placeholder="Name on the booking"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Guest email</Label>
        <Input
          className="h-9 text-sm"
          type="email"
          value={form.guest_email}
          onChange={(e) => setForm((prev) => ({ ...prev, guest_email: e.target.value }))}
          placeholder="email@example.com"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Check-in</Label>
          <Input
            className="h-9 text-sm"
            type="date"
            value={form.check_in}
            onChange={(e) => setForm((prev) => ({ ...prev, check_in: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Check-out</Label>
          <Input
            className="h-9 text-sm"
            type="date"
            value={form.check_out}
            onChange={(e) => setForm((prev) => ({ ...prev, check_out: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Number of guests</Label>
        <Input
          className="h-9 text-sm"
          type="number"
          min={1}
          value={form.guest_count}
          onChange={(e) => setForm((prev) => ({ ...prev, guest_count: e.target.value }))}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Input
          className="h-9 text-sm"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Payment status</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.payment}
          onChange={(e) => setForm((prev) => ({ ...prev, payment: e.target.value as PaymentStatus }))}
        >
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Reservation status</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ReservationStatus }))}
        >
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
          {showArchivedReservationStatus ? <option value="Archived">Archived</option> : null}
        </select>
      </div>
    </div>
  );
}
