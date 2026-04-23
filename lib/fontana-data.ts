import { supabase } from "@/lib/supabaseClient";

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

/** Cottage IDs that have at least one Confirmed reservation (for client UI). */
export async function listReservedCottageIds(): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase.rpc("fontana_reserved_cottage_ids");
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as unknown[];
  const ids: string[] = [];
  for (const row of rows) {
    if (typeof row === "string") {
      ids.push(row);
      continue;
    }
    if (row && typeof row === "object" && "cottage_id" in row) {
      const id = (row as { cottage_id: string }).cottage_id;
      if (id) ids.push(id);
    }
  }
  return { data: ids, error: null };
}

export async function listCottages(options?: {
  /** Admin lists pass true; client booking uses default (excludes archived). */
  includeArchived?: boolean;
}): Promise<{ data: FontanaCottageRow[]; error: string | null }> {
  const includeArchived = options?.includeArchived ?? false;
  let q = supabase.from("fontana_cottages").select("*").order("name");
  if (!includeArchived) {
    q = q.neq("status", "Archived");
  }
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).map((r) => {
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
  const { data, error } = await supabase.from("fontana_cottages").insert(payload).select("*").single();
  if (error) return { data: null, error: error.message };
  const rec = data as Record<string, unknown>;
  const image_urls = parseImageUrlsRow(rec);
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
  const { error } = await supabase.from("fontana_cottages").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}

/** Soft-remove: hides cottage from guests; admins can set status back in Edit. */
export async function archiveCottage(id: string): Promise<{ error: string | null }> {
  return updateCottage(id, { status: "Archived" });
}

export async function listClientUsers(): Promise<
  { data: { id: string; full_name: string | null; email: string }[]; error: string | null }
> {
  const { data, error } = await supabase
    .from("fontana_users")
    .select("id,full_name,email")
    .eq("role", "client")
    .eq("status", "active")
    .order("full_name");
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

async function enrichReservations(rows: FontanaReservationRow[]): Promise<ReservationWithRelations[]> {
  if (rows.length === 0) return [];
  const cottageIds = [...new Set(rows.map((r) => r.cottage_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];

  const [{ data: cottages }, { data: profiles }] = await Promise.all([
    supabase.from("fontana_cottages").select("id,name,rate_night").in("id", cottageIds),
    userIds.length
      ? supabase.from("fontana_users").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);

  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));
  const uMap = new Map((profiles ?? []).map((u) => [u.id, u]));

  return rows.map((r) => ({
    ...r,
    cottage: cMap.get(r.cottage_id) ? { name: cMap.get(r.cottage_id)!.name, rate_night: Number(cMap.get(r.cottage_id)!.rate_night) } : null,
    guest_profile: r.user_id && uMap.get(r.user_id) ? uMap.get(r.user_id)! : null,
  }));
}

export async function listReservationsAdmin(): Promise<{ data: ReservationWithRelations[]; error: string | null }> {
  const { data, error } = await supabase.from("fontana_reservations").select("*").order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  const enriched = await enrichReservations((data ?? []) as FontanaReservationRow[]);
  return { data: enriched, error: null };
}

export async function listReservationsForUser(userId: string): Promise<{
  data: ReservationWithRelations[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("fontana_reservations")
    .select("*")
    .eq("user_id", userId)
    .order("check_in", { ascending: false });

  if (error) return { data: [], error: error.message };
  const enriched = await enrichReservations((data ?? []) as FontanaReservationRow[]);
  return { data: enriched, error: null };
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
  const { data, error } = await supabase.from("fontana_reservations").insert(payload).select("*").single();
  if (error) return { data: null, error: error.message };
  return { data: data as FontanaReservationRow, error: null };
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
  const { error } = await supabase.from("fontana_reservations").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}

/** Soft-remove for admin list; row kept for history / recovery via Edit. */
export async function archiveReservation(id: string): Promise<{ error: string | null }> {
  return updateReservation(id, { reservation_status: "Archived" });
}

export async function listPaymentsAdmin(): Promise<{ data: PaymentWithRelations[]; error: string | null }> {
  const { data, error } = await supabase.from("fontana_payments").select("*").order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const payments = (data ?? []) as FontanaPaymentRow[];
  const resIds = [...new Set(payments.map((p) => p.reservation_id))];
  if (resIds.length === 0) return { data: [], error: null };

  const { data: resRows, error: resErr } = await supabase.from("fontana_reservations").select("*").in("id", resIds);
  if (resErr) return { data: [], error: resErr.message };
  const enrichedRes = await enrichReservations((resRows ?? []) as FontanaReservationRow[]);
  const rMap = new Map(enrichedRes.map((r) => [r.id, r]));

  const out: PaymentWithRelations[] = payments.map((p) => ({
    ...p,
    reservation: rMap.get(p.reservation_id) ?? undefined,
  }));
  return { data: out, error: null };
}

export async function listPaymentsForUser(userId: string): Promise<{ data: PaymentWithRelations[]; error: string | null }> {
  const { data: resData, error: resErr } = await supabase
    .from("fontana_reservations")
    .select("id")
    .eq("user_id", userId);
  if (resErr) return { data: [], error: resErr.message };
  const ids = (resData ?? []).map((r) => r.id);
  if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase.from("fontana_payments").select("*").in("reservation_id", ids).order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const payments = (data ?? []) as FontanaPaymentRow[];
  const { data: fullRes } = await supabase.from("fontana_reservations").select("*").in("id", ids);
  const enrichedRes = await enrichReservations((fullRes ?? []) as FontanaReservationRow[]);
  const rMap = new Map(enrichedRes.map((r) => [r.id, r]));
  const out: PaymentWithRelations[] = payments.map((p) => ({
    ...p,
    reservation: rMap.get(p.reservation_id) ?? undefined,
  }));
  return { data: out, error: null };
}

export async function upsertPaymentForReservation(payload: {
  reservation_id: string;
  amount: number;
  method: string;
  proof_file_name: string | null;
  proof_storage_path?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("fontana_payments").upsert(
    {
      reservation_id: payload.reservation_id,
      amount: payload.amount,
      method: payload.method,
      proof_file_name: payload.proof_file_name,
      proof_storage_path: payload.proof_storage_path ?? null,
      status: "Pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "reservation_id" }
  );
  return { error: error?.message ?? null };
}

export async function updatePaymentVerification(
  paymentId: string,
  reservationId: string,
  status: PaymentVerification
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("fontana_payments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  if (status === "Verified" || status === "Rejected") {
    const payStatus: PaymentStatus = status === "Verified" ? "Paid" : "Unpaid";
    const { error: rErr } = await supabase
      .from("fontana_reservations")
      .update({ payment_status: payStatus, updated_at: new Date().toISOString() })
      .eq("id", reservationId);
    if (rErr) return { error: rErr.message };
  }
  return { error: null };
}

export async function listAllMessages(): Promise<{ data: FontanaMessageRow[]; error: string | null }> {
  const { data, error } = await supabase.from("fontana_messages").select("*").order("created_at", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FontanaMessageRow[], error: null };
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
  const { data: msgs, error } = await listAllMessages();
  if (error) return { data: [], error };
  const byClient = new Map<string, FontanaMessageRow[]>();
  for (const m of msgs) {
    const arr = byClient.get(m.client_user_id) ?? [];
    arr.push(m);
    byClient.set(m.client_user_id, arr);
  }
  const ids = [...byClient.keys()];
  if (ids.length === 0) return { data: [], error: null };

  const { data: profiles, error: pErr } = await supabase
    .from("fontana_users")
    .select("id,full_name,email")
    .in("id", ids);
  if (pErr) return { data: [], error: pErr.message };

  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const threads: MessageThread[] = ids
    .map((cid) => {
      const list = [...(byClient.get(cid) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = list[list.length - 1];
      const p = pMap.get(cid);
      return {
        clientUserId: cid,
        clientName: p?.full_name?.trim() || p?.email || "Guest",
        clientEmail: p?.email ?? "",
        lastAt: last.created_at,
        preview: last.body,
        messages: list
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return { data: threads, error: null };
}

export async function listMessagesForClient(clientUserId: string): Promise<{ data: FontanaMessageRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("fontana_messages")
    .select("*")
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FontanaMessageRow[], error: null };
}

export async function sendMessage(clientUserId: string, body: string): Promise<{ error: string | null }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return { error: userErr?.message ?? "Not signed in" };
  const { error } = await supabase.from("fontana_messages").insert({
    client_user_id: clientUserId,
    sender_user_id: userData.user.id,
    body: body.trim(),
  });
  return { error: error?.message ?? null };
}

export async function listReviews(): Promise<{
  data: (FontanaReviewRow & { cottage?: { name: string } | null; author?: { full_name: string | null; email: string } | null })[];
  error: string | null;
}> {
  const { data, error } = await supabase.from("fontana_reviews").select("*").order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as FontanaReviewRow[];
  if (rows.length === 0) return { data: [], error: null };

  const cIds = [...new Set(rows.map((r) => r.cottage_id).filter(Boolean))] as string[];
  const uIds = [...new Set(rows.map((r) => r.user_id))];

  const [{ data: cottages }, { data: users }] = await Promise.all([
    cIds.length ? supabase.from("fontana_cottages").select("id,name").in("id", cIds) : Promise.resolve({ data: [] }),
    supabase.from("fontana_users").select("id,full_name,email").in("id", uIds),
  ]);

  const cMap = new Map((cottages ?? []).map((c: { id: string; name: string }) => [c.id, c]));
  const uMap = new Map((users ?? []).map((u: { id: string; full_name: string | null; email: string }) => [u.id, u]));

  const enriched = rows.map((r) => ({
    ...r,
    cottage: r.cottage_id && cMap.get(r.cottage_id) ? { name: cMap.get(r.cottage_id)!.name } : null,
    author: uMap.get(r.user_id) ?? null,
  }));
  return { data: enriched, error: null };
}

export async function listReviewsForUser(userId: string): Promise<{
  data: (FontanaReviewRow & { cottage?: { name: string } | null })[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("fontana_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as FontanaReviewRow[];
  if (rows.length === 0) return { data: [], error: null };

  const cIds = [...new Set(rows.map((r) => r.cottage_id).filter(Boolean))] as string[];
  const { data: cottages } = cIds.length
    ? await supabase.from("fontana_cottages").select("id,name").in("id", cIds)
    : { data: [] };
  const cMap = new Map((cottages ?? []).map((c: { id: string; name: string }) => [c.id, c]));
  const enriched = rows.map((r) => ({
    ...r,
    cottage: r.cottage_id && cMap.get(r.cottage_id) ? { name: cMap.get(r.cottage_id)!.name } : null,
  }));
  return { data: enriched, error: null };
}

export async function insertReview(payload: {
  user_id: string;
  cottage_id: string | null;
  rating: number;
  title: string | null;
  comment: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("fontana_reviews").insert(payload);
  return { error: error?.message ?? null };
}

export async function updateReviewAdminReply(reviewId: string, adminReply: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase.from("fontana_reviews").update({ admin_reply: adminReply }).eq("id", reviewId);
  return { error: error?.message ?? null };
}

export async function deleteReview(reviewId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("fontana_reviews").delete().eq("id", reviewId);
  return { error: error?.message ?? null };
}

export async function getDashboardStats(): Promise<{
  data: { cottages: number; activeReservations: number; pendingPayments: number };
  error: string | null;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const [cRes, rRes, pRes] = await Promise.all([
    supabase.from("fontana_cottages").select("id", { count: "exact", head: true }).neq("status", "Archived"),
    supabase
      .from("fontana_reservations")
      .select("id", { count: "exact", head: true })
      .gte("check_out", today)
      .in("reservation_status", ["Pending", "Confirmed"]),
    supabase.from("fontana_payments").select("id", { count: "exact", head: true }).eq("status", "Pending"),
  ]);

  if (cRes.error) return { data: { cottages: 0, activeReservations: 0, pendingPayments: 0 }, error: cRes.error.message };
  if (rRes.error) return { data: { cottages: 0, activeReservations: 0, pendingPayments: 0 }, error: rRes.error.message };
  if (pRes.error) return { data: { cottages: 0, activeReservations: 0, pendingPayments: 0 }, error: pRes.error.message };

  return {
    data: {
      cottages: cRes.count ?? 0,
      activeReservations: rRes.count ?? 0,
      pendingPayments: pRes.count ?? 0,
    },
    error: null,
  };
}

export type CalendarDayState = "available" | "booked" | "pending";

export async function getCalendarDayStates(
  year: number,
  monthIndex: number
): Promise<{ data: Map<number, CalendarDayState>; error: string | null }> {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("fontana_reservations")
    .select("check_in, check_out, reservation_status")
    .lte("check_in", endStr)
    .gte("check_out", startStr)
    .in("reservation_status", ["Pending", "Confirmed"]);

  if (error) return { data: new Map(), error: error.message };

  const map = new Map<number, CalendarDayState>();
  const daysInMonth = end.getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    map.set(d, "available");
  }

  for (const row of data ?? []) {
    const ci = new Date(row.check_in + "T12:00:00");
    const co = new Date(row.check_out + "T12:00:00");
    for (let t = ci.getTime(); t <= co.getTime(); t += 86400000) {
      const dt = new Date(t);
      if (dt.getFullYear() !== year || dt.getMonth() !== monthIndex) continue;
      const day = dt.getDate();
      const st =
        row.reservation_status === "Pending" ? "pending" : ("booked" as CalendarDayState);
      const prev = map.get(day);
      if (prev === "booked" || st === "booked") map.set(day, "booked");
      else map.set(day, st);
    }
  }

  return { data: map, error: null };
}
