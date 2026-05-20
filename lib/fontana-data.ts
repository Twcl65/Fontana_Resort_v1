import {
  customerApiDelete,
  customerApiGet,
  customerApiPatch,
  customerApiPost,
} from "@/lib/customer-api-client";

export type CottageCategory = "A-House" | "Cottages" | "Function Hall";
export type CottageStatus = "Available" | "Maintenance" | "Archived";
export type ReservationStatus = "Pending" | "Confirmed" | "Cancelled" | "Archived";
export type PaymentStatus = "Paid" | "Unpaid" | "Refunded";
export type PaymentVerification = "Pending" | "Verified" | "Rejected";

/** Amenity stored as JSON: `{ "name": "Fan", "image_url": "https://..." }` or legacy string in array. */
export type CottageAmenity = { name: string; image_url: string | null };

export type FontanaCottageRow = {
  id: string;
  name: string;
  category: CottageCategory;
  capacity: number;
  rate_night: number;
  status: CottageStatus;
  amenities: CottageAmenity[] | unknown;
  image_url: string | null;
  /** Ordered gallery URLs; falls back to [image_url] when column missing. */
  image_urls?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

export type FontanaReservationRow = {
  id: string;
  reference_code: string;
  cottage_id: string;
  user_id: string | null;
  guest_name: string;
  guest_email: string | null;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_amount: number;
  payment_status: PaymentStatus;
  reservation_status: ReservationStatus;
  notes: string | null;
  created_at?: string;
};

export type ReservationWithRelations = FontanaReservationRow & {
  cottage?: { name: string; rate_night?: number } | null;
  guest_profile?: { full_name: string | null; email: string } | null;
};

export type FontanaPaymentRow = {
  id: string;
  reservation_id: string;
  amount: number;
  method: string;
  status: PaymentVerification;
  proof_file_name: string | null;
  proof_storage_path: string | null;
  created_at?: string;
};

export type PaymentWithRelations = FontanaPaymentRow & {
  reservation?: FontanaReservationRow & {
    cottage?: { name: string } | null;
    guest_profile?: { full_name: string | null; email: string } | null;
  };
};

export type FontanaMessageRow = {
  id: string;
  client_user_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export type FontanaReviewRow = {
  id: string;
  user_id: string;
  cottage_id: string | null;
  rating: number;
  title: string | null;
  comment: string;
  admin_reply: string | null;
  created_at: string;
};

export function normalizeCottageAmenities(raw: unknown): CottageAmenity[] {
  if (!Array.isArray(raw)) return [];
  const out: CottageAmenity[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ name: item.trim(), image_url: null });
      continue;
    }
    if (item && typeof item === "object" && "name" in item) {
      const o = item as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) continue;
      const img = typeof o.image_url === "string" && o.image_url.trim() ? o.image_url.trim() : null;
      out.push({ name, image_url: img });
    }
  }
  return out;
}

export function cottageAmenityNames(amenities: unknown): string[] {
  return normalizeCottageAmenities(amenities).map((a) => a.name);
}

function amenitiesToJsonb(amenities: unknown): CottageAmenity[] {
  return normalizeCottageAmenities(amenities);
}

function parseImageUrlsRow(row: Record<string, unknown>): string[] {
  const urls = row.image_urls;
  if (Array.isArray(urls)) {
    const list = urls.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (list.length > 0) return list;
  }
  const legacy = row.image_url;
  if (typeof legacy === "string" && legacy.trim()) return [legacy.trim()];
  return [];
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + "T12:00:00");
  const b = new Date(checkOut + "T12:00:00");
  const diff = (b.getTime() - a.getTime()) / 86400000;
  return Math.max(1, Math.ceil(diff));
}

/** Cottage IDs that have at least one Confirmed reservation (for client UI). Customer DB via API. */
export async function listReservedCottageIds(): Promise<{ data: string[]; error: string | null }> {
  try {
    const response = await customerApiGet("reserved-cottage-ids");
    return { data: (response.data ?? []) as string[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listCottages(options?: {
  /** Admin lists pass true; client booking uses default (excludes archived). */
  includeArchived?: boolean;
}): Promise<{ data: FontanaCottageRow[]; error: string | null }> {
  const includeArchived = options?.includeArchived ?? false;
  try {
    const response = await customerApiGet("cottages", includeArchived ? { includeArchived: "1" } : undefined);
    const rows = ((response.data ?? []) as Record<string, unknown>[]).map((r) => {
      const rec = r as Record<string, unknown>;
      const image_urls = parseImageUrlsRow(rec);
      return {
        ...r,
        amenities: normalizeCottageAmenities(r.amenities),
        image_urls,
        image_url: (typeof r.image_url === "string" && r.image_url) || image_urls[0] || null,
        rate_night: Number(r.rate_night),
      } as FontanaCottageRow;
    });
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function insertCottage(
  row: Omit<FontanaCottageRow, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<{ data: FontanaCottageRow | null; error: string | null }> {
  const gallery =
    row.image_urls && row.image_urls.length > 0
      ? row.image_urls
      : row.image_url
        ? [row.image_url]
        : [];
  const primary = gallery[0] ?? row.image_url ?? null;
  const payload: Record<string, unknown> = {
    name: row.name,
    category: row.category,
    capacity: row.capacity,
    rate_night: row.rate_night,
    status: row.status,
    amenities: amenitiesToJsonb(row.amenities),
    image_url: primary,
    image_urls: gallery,
  };
  const response = await customerApiPost("cottages", payload);
  const data = response.data as Record<string, unknown>;
  const image_urls = parseImageUrlsRow(data);
  return {
    data: {
      ...data,
      amenities: normalizeCottageAmenities(data.amenities),
      image_urls,
      image_url: (data as { image_url?: string | null }).image_url ?? image_urls[0] ?? null,
      rate_night: Number(data.rate_night),
    } as FontanaCottageRow,
    error: null,
  };
}

export async function updateCottage(
  id: string,
  patch: Partial<Omit<FontanaCottageRow, "id" | "created_at" | "updated_at">>
): Promise<{ error: string | null }> {
  try {
    await customerApiPatch("cottages", id, patch);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Soft-remove: hides cottage from guests; admins can set status back in Edit. */
export async function archiveCottage(id: string): Promise<{ error: string | null }> {
  return updateCottage(id, { status: "Archived" });
}

/** Active client accounts from Admin DB (staff only). */
export async function listClientUsers(): Promise<
  { data: { id: string; full_name: string | null; email: string }[]; error: string | null }
> {
  try {
    const response = await customerApiGet("client-users");
    return { data: (response.data ?? []) as { id: string; full_name: string | null; email: string }[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listReservationsAdmin(): Promise<{ data: ReservationWithRelations[]; error: string | null }> {
  try {
    const response = await customerApiGet("reservations", { all: "1" });
    return { data: (response.data ?? []) as ReservationWithRelations[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listReservationsForUser(_userId: string): Promise<{
  data: ReservationWithRelations[];
  error: string | null;
}> {
  try {
    const response = await customerApiGet("reservations");
    return { data: (response.data ?? []) as ReservationWithRelations[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function insertReservation(payload: {
  cottage_id: string;
  user_id: string | null;
  guest_name: string;
  guest_email: string | null;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_amount: number;
  payment_status: PaymentStatus;
  reservation_status: ReservationStatus;
  notes: string | null;
}): Promise<{ data: FontanaReservationRow | null; error: string | null }> {
  try {
    const response = await customerApiPost("reservations", payload);
    return { data: response.data as FontanaReservationRow, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateReservation(
  id: string,
  patch: Partial<
    Pick<
      FontanaReservationRow,
      | "cottage_id"
      | "user_id"
      | "guest_name"
      | "guest_email"
      | "check_in"
      | "check_out"
      | "guest_count"
      | "total_amount"
      | "payment_status"
      | "reservation_status"
      | "notes"
    >
  >
): Promise<{ error: string | null }> {
  try {
    await customerApiPatch("reservations", id, patch);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Soft-remove for admin list; row kept for history / recovery via Edit. */
export async function archiveReservation(id: string): Promise<{ error: string | null }> {
  return updateReservation(id, { reservation_status: "Archived" });
}

export async function listPaymentsAdmin(): Promise<{ data: PaymentWithRelations[]; error: string | null }> {
  try {
    const response = await customerApiGet("payments", { all: "1" });
    return { data: (response.data ?? []) as PaymentWithRelations[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listPaymentsForUser(_userId: string): Promise<{ data: PaymentWithRelations[]; error: string | null }> {
  try {
    const response = await customerApiGet("payments");
    return { data: (response.data ?? []) as PaymentWithRelations[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upsertPaymentForReservation(payload: {
  reservation_id: string;
  amount: number;
  method: string;
  proof_file_name: string | null;
  proof_storage_path?: string | null;
}): Promise<{ error: string | null }> {
  try {
    await customerApiPost("payments", payload);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePaymentVerification(
  paymentId: string,
  reservationId: string,
  status: PaymentVerification
): Promise<{ error: string | null }> {
  try {
    await customerApiPatch("payments", paymentId, { status, reservation_id: reservationId });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listAllMessages(): Promise<{ data: FontanaMessageRow[]; error: string | null }> {
  try {
    const response = await customerApiGet("messages", { all: "1" });
    return { data: (response.data ?? []) as FontanaMessageRow[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export type MessageThread = {
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  lastAt: string;
  preview: string;
  messages: FontanaMessageRow[];
};

export async function getAdminMessageThreads(): Promise<{ data: MessageThread[]; error: string | null }> {
  try {
    const response = await customerApiGet("message-threads");
    return { data: (response.data ?? []) as MessageThread[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listMessagesForClient(clientUserId: string): Promise<{ data: FontanaMessageRow[]; error: string | null }> {
  try {
    const response = await customerApiGet("messages");
    return { data: (response.data ?? []) as FontanaMessageRow[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendMessage(clientUserId: string, body: string): Promise<{ error: string | null }> {
  try {
    await customerApiPost("messages", { client_user_id: clientUserId, body: body.trim() });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listReviews(): Promise<{
  data: (FontanaReviewRow & { cottage?: { name: string } | null; author?: { full_name: string | null; email: string } | null })[];
  error: string | null;
}> {
  try {
    const response = await customerApiGet("reviews", { all: "1" });
    return {
      data: (response.data ?? []) as (FontanaReviewRow & {
        cottage?: { name: string } | null;
        author?: { full_name: string | null; email: string } | null;
      })[],
      error: null,
    };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listReviewsForUser(_userId: string): Promise<{
  data: (FontanaReviewRow & { cottage?: { name: string } | null })[];
  error: string | null;
}> {
  try {
    const response = await customerApiGet("reviews");
    return {
      data: (response.data ?? []) as (FontanaReviewRow & { cottage?: { name: string } | null })[],
      error: null,
    };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function insertReview(payload: {
  user_id: string;
  cottage_id: string | null;
  rating: number;
  title: string | null;
  comment: string;
}): Promise<{ error: string | null }> {
  try {
    await customerApiPost("reviews", payload);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateReviewAdminReply(reviewId: string, adminReply: string | null): Promise<{ error: string | null }> {
  try {
    await customerApiPatch("reviews", reviewId, { admin_reply: adminReply });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteReview(reviewId: string): Promise<{ error: string | null }> {
  try {
    await customerApiDelete("reviews", reviewId);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getDashboardStats(): Promise<{
  data: { cottages: number; activeReservations: number; pendingPayments: number };
  error: string | null;
}> {
  try {
    const response = await customerApiGet("dashboard-stats");
    return { data: response.data, error: null };
  } catch (err) {
    return {
      data: { cottages: 0, activeReservations: 0, pendingPayments: 0 },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type { CalendarDayState } from "@/lib/fontana-calendar";
export { getCalendarDayStates } from "@/lib/fontana-calendar";
