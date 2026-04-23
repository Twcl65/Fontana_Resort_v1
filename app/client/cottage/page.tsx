/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fetchCurrentUserWithRole, getDefaultFullName } from "@/lib/auth";
import {
  insertReservation,
  listCottages,
  listReservedCottageIds,
  listReservationsForUser,
  nightsBetween,
  normalizeCottageAmenities,
  type CottageAmenity,
  type FontanaCottageRow
} from "@/lib/fontana-data";

type Cottage = {
  id: string;
  name: string;
  category: string;
  capacity: string;
  /** Maximum guests allowed (same as DB `capacity`). */
  capacityMax: number;
  price: number;
  /** All gallery image URLs (cover first). */
  images: string[];
  description: string;
  /** Listing status from the resort (e.g. Available). */
  status: string;
  amenities: CottageAmenity[];
};

function formatBookingDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

/** Cottage gallery first, then unique amenity image URLs (for details dialog carousel). */
function cottageLightboxUrls(cottage: Cottage): string[] {
  const out: string[] = [...cottage.images];
  for (const a of cottage.amenities) {
    const u = a.image_url?.trim();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

function mapRow(row: FontanaCottageRow): Cottage {
  const imgs =
    row.image_urls && row.image_urls.length > 0
      ? row.image_urls
      : row.image_url
        ? [row.image_url]
        : [];
  const am = normalizeCottageAmenities(row.amenities);
  const cap = Math.max(1, Number(row.capacity) || 1);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    capacity: `Good for ${cap} people`,
    capacityMax: cap,
    price: Number(row.rate_night),
    images: imgs,
    description: `${row.category} · ${row.status}`,
    status: row.status,
    amenities: am.length ? am : [{ name: "—", image_url: null }]
  };
}

type DialogStep = "details" | "form" | "confirmation";

export default function CottagePage() {
  const [cottageList, setCottageList] = useState<Cottage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState("2026-02-27");
  const [checkOutDate, setCheckOutDate] = useState("2026-02-27");
  const [cottageType, setCottageType] = useState("any");
  /** Filter list: All, Available (not reserved), or Reserved (has Confirmed booking). */
  const [statusFilter, setStatusFilter] = useState<"all" | "Available" | "Reserved">("all");
  const [reservedCottageIds, setReservedCottageIds] = useState<Set<string>>(() => new Set());
  const [selectedCottage, setSelectedCottage] = useState<Cottage | null>(null);
  const [dialogStep, setDialogStep] = useState<DialogStep | null>(null);
  const [detailPhotoIdx, setDetailPhotoIdx] = useState(0);

  const [formCottageId, setFormCottageId] = useState("");
  const [timeCheckIn, setTimeCheckIn] = useState("");
  const [timeCheckOut, setTimeCheckOut] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [numGuests, setNumGuests] = useState("10");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  /** Which gallery slide is shown per cottage card (client home list). */
  const [gallerySlideById, setGallerySlideById] = useState<Record<string, number>>({});
  /** Per cottage: pending = request sent; confirmed = successfully booked. Confirmed wins if both exist. */
  const [cottageBookingById, setCottageBookingById] = useState<
    Map<string, "pending" | "confirmed">
  >(() => new Map());

  const loadMyBookings = useCallback(async () => {
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setCottageBookingById(new Map());
        return;
      }
      const { data, error } = await listReservationsForUser(current.dbUser.id);
      if (error) return;
      const next = new Map<string, "pending" | "confirmed">();
      for (const r of data ?? []) {
        if (r.reservation_status === "Cancelled") continue;
        const cid = r.cottage_id;
        const prev = next.get(cid);
        if (r.reservation_status === "Confirmed") {
          next.set(cid, "confirmed");
        } else if (r.reservation_status === "Pending") {
          if (prev !== "confirmed") next.set(cid, "pending");
        }
      }
      setCottageBookingById(next);
    } catch {
      setCottageBookingById(new Map());
    }
  }, []);

  const loadReservedIds = useCallback(async () => {
    const { data, error } = await listReservedCottageIds();
    if (error) {
      setReservedCottageIds(new Set());
      return;
    }
    setReservedCottageIds(new Set(data ?? []));
  }, []);

  const loadCottages = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const { data, error } = await listCottages();
    if (error) setListError(error);
    const mapped = (data ?? []).filter((c) => c.status === "Available").map(mapRow);
    setCottageList(mapped);
    setListLoading(false);
    void loadReservedIds();
  }, [loadReservedIds]);

  useEffect(() => {
    void loadCottages();
  }, [loadCottages]);

  useEffect(() => {
    void loadMyBookings();
  }, [loadMyBookings]);

  useEffect(() => {
    if (cottageList.length && !formCottageId) setFormCottageId(cottageList[0].id);
  }, [cottageList, formCottageId]);

  useEffect(() => {
    if (!cottageList.length || !formCottageId) return;
    if (!cottageBookingById.has(formCottageId)) return;
    const next = cottageList.find((c) => !cottageBookingById.has(c.id));
    if (next) setFormCottageId(next.id);
  }, [cottageBookingById, cottageList, formCottageId]);

  const getDisplayStatus = useCallback(
    (c: Cottage) => (reservedCottageIds.has(c.id) ? "Reserved" : c.status),
    [reservedCottageIds]
  );

  const filteredCottages = useMemo(() => {
    let list =
      cottageType === "any" ? cottageList : cottageList.filter((c) => c.category === cottageType);
    if (statusFilter === "Available") {
      list = list.filter((c) => getDisplayStatus(c) === "Available");
    } else if (statusFilter === "Reserved") {
      list = list.filter((c) => getDisplayStatus(c) === "Reserved");
    }
    return list;
  }, [cottageList, cottageType, statusFilter, getDisplayStatus]);

  const getBookingUi = useCallback(
    (cottageId: string): { booked: boolean; label: string; variant: "success" | "pending" } | null => {
      const s = cottageBookingById.get(cottageId);
      if (!s) return null;
      if (s === "confirmed") {
        return { booked: true, label: "Successfully booked", variant: "success" };
      }
      return { booked: true, label: "Sent booking request", variant: "pending" };
    },
    [cottageBookingById]
  );

  const bookingCottage = useMemo(
    () => selectedCottage ?? cottageList.find((c) => c.id === formCottageId) ?? null,
    [selectedCottage, cottageList, formCottageId]
  );

  const detailLightboxUrls = useMemo(
    () => (selectedCottage ? cottageLightboxUrls(selectedCottage) : []),
    [selectedCottage]
  );

  const bookingGuestOptions = useMemo(() => {
    const max = Math.max(1, bookingCottage?.capacityMax ?? 1);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [bookingCottage]);

  const openDetailsDialog = (cottage: Cottage) => {
    setSelectedCottage(cottage);
    setDetailPhotoIdx(0);
    setDialogStep("details");
  };

  const openFormDialog = () => {
    if (!selectedCottage) return;
    setFormCottageId(selectedCottage.id);
    setTimeCheckIn("");
    setTimeCheckOut("");
    setSpecialRequest("");
    setNumGuests(String(selectedCottage.capacityMax));
    setDialogStep("form");
    void (async () => {
      try {
        const current = await fetchCurrentUserWithRole();
        if (current) {
          const name =
            current.dbUser.full_name?.trim() || getDefaultFullName(current.authUser) || "";
          setFullName(name);
          setEmail((current.dbUser.email || current.authUser.email || "").trim());
        }
      } catch {
        /* keep existing name/email if profile load fails */
      }
    })();
  };

  const closeDialog = () => {
    setDialogStep(null);
    setSelectedCottage(null);
  };

  const handleSubmitBooking = async (e: FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setBookingError("Please sign in to book.");
        return;
      }
      const cottage = cottageList.find((c) => c.id === formCottageId) ?? selectedCottage;
      if (!cottage || !checkInDate || !checkOutDate) {
        setBookingError("Choose dates and a cottage.");
        return;
      }
      if (cottageBookingById.has(formCottageId)) {
        setBookingError("You already have a booking for this cottage.");
        return;
      }
      if (reservedCottageIds.has(formCottageId)) {
        setBookingError("This cottage is reserved and cannot be booked.");
        return;
      }
      const n = nightsBetween(checkInDate, checkOutDate);
      const total = n * cottage.price;
      const noteParts = [
        specialRequest.trim(),
        timeCheckIn ? `Check-in time: ${timeCheckIn}` : "",
        timeCheckOut ? `Check-out time: ${timeCheckOut}` : "",
        phone ? `Phone: ${phone}` : ""
      ].filter(Boolean);
      const cap = Math.max(1, cottage.capacityMax || 1);
      const guestCount = Math.min(Math.max(1, Number(numGuests) || 1), cap);
      const { error } = await insertReservation({
        cottage_id: formCottageId,
        user_id: current.dbUser.id,
        guest_name: fullName.trim(),
        guest_email: email.trim() || null,
        check_in: checkInDate,
        check_out: checkOutDate,
        guest_count: guestCount,
        total_amount: total,
        payment_status: "Unpaid",
        reservation_status: "Pending",
        notes: noteParts.length ? noteParts.join("\n") : null
      });
      if (error) {
        setBookingError(error);
        return;
      }
      await loadMyBookings();
      setDialogStep("confirmation");
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed.");
    }
  };

  return (
    <div className="space-y-5">
      {listError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{listError}</p>
      )}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Book New Cottages</h1>
        <p className="text-sm text-muted-foreground">
          Book a cottage for your stay at Fontana Blue Resort.
        </p>
      </div>

      <div className="border border-gray-300 bg-white">
        <CardContent className="pt-2">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Check-in Date</Label>
              <Input
                type="date"
                className="h-9"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Check-out Date</Label>
              <Input
                type="date"
                className="h-9"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "Available" | "Reserved")}
              >
                <option value="all">All statuses</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={cottageType}
                onChange={(e) => setCottageType(e.target.value)}
              >
                <option value="any">All categories</option>
                <option value="A-House">A-House</option>
                <option value="Cottages">Cottages</option>
                <option value="Function Hall">Function Hall</option>
              </select>
            </div>
          </div>
        </CardContent>
      </div>

      <section>
        {listLoading ? <p className="text-sm text-muted-foreground">Loading cottages...</p> : null}
        {!listLoading && cottageList.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No available cottages yet.</p>
        ) : !listLoading && filteredCottages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No cottages match your category or status filters.
          </p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCottages.map((cottage) => (
            <Card
              key={cottage.id}
              className="flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                {(() => {
                  const imgs = cottage.images.length ? cottage.images : [""];
                  const idx = Math.min(gallerySlideById[cottage.id] ?? 0, imgs.length - 1);
                  const src = imgs[idx];
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                  );
                })()}
                {cottage.images.length > 1 ? (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 px-2">
                    {cottage.images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Photo ${i + 1}`}
                        className={`h-2 rounded-full transition-all ${(gallerySlideById[cottage.id] ?? 0) === i ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGallerySlideById((prev) => ({ ...prev, [cottage.id]: i }));
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <CardHeader className="space-y-1 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{cottage.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{cottage.capacity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    ₱{cottage.price.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground"> / night</span>
                  </p>
                </div>
                <p className="text-xs text-foreground/90 line-clamp-2">
                  {cottage.category} · {getDisplayStatus(cottage)}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cottage.amenities.slice(0, 4).map((a, i) => (
                    <span
                      key={`${cottage.id}-am-${i}-${a.name}`}
                      className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="mt-auto p-4 pt-0">
                {(() => {
                  const ui = getBookingUi(cottage.id);
                  const reserved = getDisplayStatus(cottage) === "Reserved";
                  if (ui) {
                    return (
                      <Button
                        type="button"
                        variant={ui.variant === "success" ? "bookingSuccess" : "bookingPending"}
                        className="h-9 w-full rounded-sm"
                        size="sm"
                        disabled
                      >
                        {ui.label}
                      </Button>
                    );
                  }
                  if (reserved) {
                    return (
                      <Button type="button" variant="archive" className="h-9 w-full cursor-default rounded-sm" size="sm" disabled>
                        Reserved
                      </Button>
                    );
                  }
                  return (
                    <Button variant="book" className="h-9 w-full rounded-sm" size="sm" onClick={() => openDetailsDialog(cottage)}>
                      Book Now
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </section>

      {/* Dialog 1: Cottage details */}
      {dialogStep === "details" && selectedCottage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-4">
          <Card className="flex w-full max-w-md max-h-[min(92vh,640px)] flex-col overflow-hidden shadow-lg">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-0.5 pr-1 text-left">
                <CardTitle className="text-base font-semibold leading-snug">{selectedCottage.name}</CardTitle>
                <p className="text-xs leading-tight text-muted-foreground">{selectedCottage.capacity}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full hover:bg-muted"
                onClick={closeDialog}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
              {detailLightboxUrls.length > 0 ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detailLightboxUrls[Math.min(detailPhotoIdx, detailLightboxUrls.length - 1)]}
                    alt=""
                    className="max-h-[32vh] w-full rounded-md border border-input object-cover sm:max-h-[220px]"
                  />
                  {detailLightboxUrls.length > 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white"
                        onClick={() =>
                          setDetailPhotoIdx((i) => {
                            const n = detailLightboxUrls.length;
                            return (i - 1 + n) % n;
                          })
                        }
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white"
                        onClick={() =>
                          setDetailPhotoIdx((i) => {
                            const n = detailLightboxUrls.length;
                            return (i + 1) % n;
                          })
                        }
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="flex max-h-40 min-h-[120px] items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-xs text-muted-foreground">
                  No photos
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={`font-semibold capitalize ${
                        getDisplayStatus(selectedCottage) === "Reserved"
                          ? "text-[#F59E0B]"
                          : getDisplayStatus(selectedCottage) === "Available"
                            ? "text-[#22C55E]"
                            : "text-foreground"
                      }`}
                    >
                      {getDisplayStatus(selectedCottage)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-primary">
                    ₱{selectedCottage.price.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground"> / night</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_auto]">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:col-start-1 sm:row-start-1">
                    Amenities
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:col-start-1 sm:row-start-2">
                    {selectedCottage.amenities.map((a, i) => (
                      <span
                        key={`detail-am-${i}-${a.name}`}
                        className="rounded border border-border bg-background px-2 py-0.5 text-[11px] leading-tight"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs leading-snug sm:col-start-2 sm:row-start-1 sm:text-right">
                    <span className="text-muted-foreground">Check-in </span>
                    <span className="font-medium text-foreground">{formatBookingDate(checkInDate)}</span>
                  </p>
                  <p className="text-xs leading-snug sm:col-start-2 sm:row-start-2 sm:text-right">
                    <span className="text-muted-foreground">Check-out </span>
                    <span className="font-medium text-foreground">{formatBookingDate(checkOutDate)}</span>
                  </p>
                </div>
              </div>
            </div>
            <CardContent className="shrink-0 border-t px-3 py-2.5">
              {getBookingUi(selectedCottage.id) ? (
                <Button
                  type="button"
                  variant={
                    getBookingUi(selectedCottage.id)?.variant === "success" ? "bookingSuccess" : "bookingPending"
                  }
                  className="h-10 w-full cursor-default"
                  disabled
                >
                  {getBookingUi(selectedCottage.id)?.label}
                </Button>
              ) : getDisplayStatus(selectedCottage) === "Reserved" ? (
                <Button type="button" variant="archive" className="h-10 w-full cursor-default" disabled>
                  Reserved
                </Button>
              ) : (
                <Button type="button" variant="book" className="h-10 w-full" onClick={openFormDialog}>
                  Book now
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog 2: Booking form */}
      {dialogStep === "form" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[85vh] w-full max-w-xl overflow-y-auto">
            <CardHeader className="border-b p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-left">
                  <CardTitle className="text-base">Booking Details</CardTitle>
                  <p className="text-xs text-muted-foreground">Fill in your reservation details.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full hover:bg-muted"
                  onClick={closeDialog}
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <form onSubmit={(e) => void handleSubmitBooking(e)}>
              <CardContent className="space-y-3 p-3 pt-3">
                {bookingError ? <p className="text-xs text-red-600">{bookingError}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cottage</Label>
                    <Input readOnly className="h-8 text-sm" value={bookingCottage?.name ?? ""} tabIndex={-1} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Number of Guests</Label>
                    <select
                      required
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                      value={bookingGuestOptions.includes(Number(numGuests)) ? numGuests : String(bookingGuestOptions.at(-1) ?? 1)}
                      onChange={(e) => setNumGuests(e.target.value)}
                    >
                      {bookingGuestOptions.map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "person" : "people"}
                          {bookingCottage && n === bookingCottage.capacityMax ? " (max)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Check-in Date</Label>
                    <Input
                      type="date"
                      required
                      className="h-8 text-sm"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Check-out Date</Label>
                    <Input
                      type="date"
                      required
                      className="h-8 text-sm"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Time Check In</Label>
                    <Input
                      type="time"
                      required
                      className="h-8 text-sm"
                      value={timeCheckIn}
                      onChange={(e) => setTimeCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Time Check Out</Label>
                    <Input
                      type="time"
                      required
                      className="h-8 text-sm"
                      value={timeCheckOut}
                      onChange={(e) => setTimeCheckOut(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      required
                      placeholder="Your full name"
                      className="h-8 text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      required
                      type="tel"
                      placeholder="09XX XXX XXXX"
                      className="h-8 text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Email Address</Label>
                  <Input
                    required
                    type="email"
                    placeholder="you@example.com"
                    className="h-8 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Special Request (Optional)</Label>
                  <Textarea
                    placeholder="Any special requests..."
                    className="min-h-[60px] resize-none py-2 text-sm"
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="cancelMuted"
                    size="sm"
                    className="h-8 flex-1 text-xs"
                    onClick={() => setDialogStep("details")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="save" size="sm" className="h-8 flex-1 text-xs">
                    Submit
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Dialog 3: Confirmation */}
      {dialogStep === "confirmation" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-base">Booking Confirmed</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your reservation has been submitted. You will receive a confirmation email shortly.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full hover:bg-muted" onClick={closeDialog} aria-label="Close">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <Button variant="save" size="sm" className="h-8 w-full text-xs" onClick={closeDialog}>
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
