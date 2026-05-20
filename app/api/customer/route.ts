import { NextResponse } from "next/server";
import { syncUserProfileFromAdminDb } from "@/lib/customerDbSync";
import {
  getCalendarDayStatesFromDb,
  listManualEventsInRangeFromDb,
  listUpcomingEventsFromDb,
} from "@/lib/customer-calendar-server";
import { enrichReservations, enrichReviews, fetchAdminProfilesByIds } from "@/lib/server-db-enrichment";
import {
  getAdminServiceClient,
  getAuthAnonClient,
  getCustomerServiceClient,
} from "@/lib/server-supabase";

type CustomerProfile = {
  id: string;
  role: "admin" | "cashier" | "client";
  status: "active" | "inactive";
  email?: string | null;
  full_name?: string | null;
};

type ReservationPayload = {
  cottage_id: string;
  user_id?: string | null;
  guest_name: string;
  guest_email?: string | null;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_amount: number;
  payment_status: string;
  reservation_status: string;
  notes?: string | null;
};

type PaymentPayload = {
  reservation_id: string;
  amount: number;
  method: string;
  proof_file_name: string | null;
  proof_storage_path?: string | null;
};

type MessagePayload = {
  client_user_id: string;
  body: string;
};

type ReviewPayload = {
  user_id?: string;
  cottage_id: string | null;
  rating: number;
  title: string | null;
  comment: string;
};

type CottagePayload = {
  name: string;
  category: string;
  capacity: number;
  rate_night: number;
  status: string;
  amenities: unknown;
  image_url: string | null;
  image_urls: string[];
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function isStaff(profile: CustomerProfile) {
  return profile.role === "admin" || profile.role === "cashier";
}

async function requireAuth(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return { error: jsonResponse({ error: "Unauthorized." }, 401) } as const;
  }

  const { data, error } = await getAuthAnonClient().auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Invalid session." }, 401) } as const;
  }

  const { data: profile, error: profileError } = await getAdminServiceClient()
    .from("fontana_users")
    .select("id,role,status,email,full_name")
    .eq("id", data.user.id)
    .maybeSingle<CustomerProfile>();

  if (profileError || !profile || profile.status !== "active") {
    return { error: jsonResponse({ error: "Forbidden." }, 403) } as const;
  }

  return { user: data.user, profile, token } as const;
}

async function ensureCustomerUserExists(userId: string) {
  await syncUserProfileFromAdminDb(getAdminServiceClient(), userId);
}

async function buildMessageThreads() {
  const customerClient = getCustomerServiceClient();
  const adminClient = getAdminServiceClient();
  const { data: messages, error } = await customerClient
    .from("fontana_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byClient = new Map<string, typeof messages>();
  for (const m of messages ?? []) {
    const arr = byClient.get(m.client_user_id) ?? [];
    arr.push(m);
    byClient.set(m.client_user_id, arr);
  }

  const ids = [...byClient.keys()];
  if (ids.length === 0) return [];

  const profiles = await fetchAdminProfilesByIds(adminClient, ids);
  const pMap = new Map(profiles.map((p) => [p.id, p]));

  return ids
    .map((cid) => {
      const list = [...(byClient.get(cid) ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
      const last = list[list.length - 1];
      const p = pMap.get(cid);
      return {
        clientUserId: cid,
        clientName: p?.full_name?.trim() || p?.email || "Guest",
        clientEmail: p?.email ?? "",
        lastAt: last.created_at,
        preview: last.body,
        messages: list,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { profile, user } = auth;

  const adminClient = getAdminServiceClient();
  const customerClient = getCustomerServiceClient();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  if (!resource) {
    return jsonResponse({ error: "Missing resource parameter." }, 400);
  }

  if (resource === "cottages") {
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    let q = customerClient.from("fontana_cottages").select("*").order("name");
    if (!includeArchived) {
      q = q.neq("status", "Archived");
    }
    const { data, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: data ?? [] });
  }

  if (resource === "reserved-cottage-ids") {
    const { data, error } = await customerClient.rpc("fontana_reserved_cottage_ids");
    if (error) return jsonResponse({ error: error.message }, 500);
    const ids: string[] = [];
    for (const row of data ?? []) {
      if (typeof row === "string") ids.push(row);
      else if (row && typeof row === "object" && "cottage_id" in row) {
        const id = (row as { cottage_id: string }).cottage_id;
        if (id) ids.push(id);
      }
    }
    return jsonResponse({ data: ids });
  }

  if (resource === "client-users") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const { data, error } = await adminClient
      .from("fontana_users")
      .select("id,full_name,email")
      .eq("role", "client")
      .eq("status", "active")
      .order("full_name");
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: data ?? [] });
  }

  if (resource === "dashboard-stats") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const today = new Date().toISOString().slice(0, 10);
    const [cRes, rRes, pRes] = await Promise.all([
      customerClient.from("fontana_cottages").select("id", { count: "exact", head: true }).neq("status", "Archived"),
      customerClient
        .from("fontana_reservations")
        .select("id", { count: "exact", head: true })
        .gte("check_out", today)
        .in("reservation_status", ["Pending", "Confirmed"]),
      customerClient.from("fontana_payments").select("id", { count: "exact", head: true }).eq("status", "Pending"),
    ]);
    if (cRes.error || rRes.error || pRes.error) {
      return jsonResponse(
        {
          error:
            cRes.error?.message ?? rRes.error?.message ?? pRes.error?.message ?? "Failed to load dashboard stats.",
        },
        500
      );
    }
    return jsonResponse({
      data: {
        cottages: cRes.count ?? 0,
        activeReservations: rRes.count ?? 0,
        pendingPayments: pRes.count ?? 0,
      },
    });
  }

  if (resource === "reservations") {
    const all = url.searchParams.get("all") === "1";
    const idsParam = url.searchParams.get("ids");
    const enrich = url.searchParams.get("enrich") !== "0";

    let rows: Record<string, unknown>[] = [];

    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      const { data, error } = await customerClient
        .from("fontana_reservations")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      rows = data ?? [];
    } else {
      if (all && !isStaff(profile)) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const query = customerClient.from("fontana_reservations").select("*").order("created_at", { ascending: false });
      if (!all) {
        query.eq("user_id", user.id);
      }
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      rows = data ?? [];
    }

    if (!enrich) {
      return jsonResponse({ data: rows });
    }

    try {
      const enriched = await enrichReservations(adminClient, customerClient, rows as Parameters<typeof enrichReservations>[2]);
      return jsonResponse({ data: enriched });
    } catch (err: unknown) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  if (resource === "payments") {
    const all = url.searchParams.get("all") === "1";
    const enrich = url.searchParams.get("enrich") !== "0";

    let payments: Record<string, unknown>[] = [];
    if (all) {
      if (!isStaff(profile)) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const { data, error } = await customerClient
        .from("fontana_payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      payments = data ?? [];
    } else {
      const { data: reservations, error: reservationsError } = await customerClient
        .from("fontana_reservations")
        .select("id")
        .eq("user_id", user.id);
      if (reservationsError) return jsonResponse({ error: reservationsError.message }, 500);
      const ids = (reservations ?? []).map((row) => (row as { id: string }).id);
      if (ids.length === 0) {
        return jsonResponse({ data: [] });
      }
      const { data, error } = await customerClient
        .from("fontana_payments")
        .select("*")
        .in("reservation_id", ids)
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      payments = data ?? [];
    }

    if (!enrich || payments.length === 0) {
      return jsonResponse({ data: payments });
    }

    const resIds = [...new Set(payments.map((p) => String((p as { reservation_id: string }).reservation_id)))];
    const { data: reservations, error: resError } = await customerClient
      .from("fontana_reservations")
      .select("*")
      .in("id", resIds);
    if (resError) return jsonResponse({ error: resError.message }, 500);

    try {
      const enrichedRes = await enrichReservations(
        adminClient,
        customerClient,
        (reservations ?? []) as Parameters<typeof enrichReservations>[2]
      );
      const rMap = new Map(
        enrichedRes.map((r) => [(r as Record<string, unknown>).id as string, r])
      );
      const out = payments.map((p) => ({
        ...p,
        reservation: rMap.get(String((p as { reservation_id: string }).reservation_id)) ?? undefined,
      }));
      return jsonResponse({ data: out });
    } catch (err: unknown) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  if (resource === "message-threads") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    try {
      const threads = await buildMessageThreads();
      return jsonResponse({ data: threads });
    } catch (err: unknown) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  if (resource === "messages") {
    const all = url.searchParams.get("all") === "1";
    if (all) {
      if (!isStaff(profile)) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const { data, error } = await customerClient
        .from("fontana_messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data: data ?? [] });
    }
    const { data, error } = await customerClient
      .from("fontana_messages")
      .select("*")
      .eq("client_user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: data ?? [] });
  }

  if (resource === "reviews") {
    const all = url.searchParams.get("all") === "1";
    const enrich = url.searchParams.get("enrich") !== "0";

    let rows: Record<string, unknown>[] = [];
    if (all) {
      if (!isStaff(profile)) {
        return jsonResponse({ error: "Forbidden." }, 403);
      }
      const { data, error } = await customerClient
        .from("fontana_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      rows = data ?? [];
    } else {
      const { data, error } = await customerClient
        .from("fontana_reviews")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      rows = data ?? [];
    }

    if (!enrich) {
      return jsonResponse({ data: rows });
    }

    try {
      const enriched = await enrichReviews(
        adminClient,
        customerClient,
        rows as Parameters<typeof enrichReviews>[2],
        all
      );
      return jsonResponse({ data: enriched });
    } catch (err: unknown) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  if (resource === "calendar-day-states") {
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return jsonResponse({ error: "year and month query parameters are required." }, 400);
    }
    const result = await getCalendarDayStatesFromDb(customerClient, year, month);
    if (result.error) return jsonResponse({ error: result.error }, 500);
    return jsonResponse({ data: result.data });
  }

  if (resource === "calendar-events") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return jsonResponse({ error: "from and to query parameters are required." }, 400);
    }
    const result = await listManualEventsInRangeFromDb(customerClient, from, to);
    if (result.error) return jsonResponse({ error: result.error }, 500);
    return jsonResponse({ data: result.data });
  }

  if (resource === "upcoming-events") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const mode = url.searchParams.get("mode") as "admin" | "cashier" | "client" | null;
    if (!from || !to || !mode) {
      return jsonResponse({ error: "from, to, and mode query parameters are required." }, 400);
    }
    const userId = url.searchParams.get("userId") ?? undefined;
    const result = await listUpcomingEventsFromDb(customerClient, { mode, userId, from, to });
    if (result.error) return jsonResponse({ error: result.error }, 500);
    return jsonResponse({ data: result.data });
  }

  return jsonResponse({ error: "Unsupported resource." }, 400);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { profile, user } = auth;

  const customerClient = getCustomerServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const resource = String(body.resource ?? "");
  if (!resource) {
    return jsonResponse({ error: "Missing resource in request body." }, 400);
  }

  if (resource === "reservations") {
    const payload = body.payload as ReservationPayload | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing reservation payload." }, 400);
    }
    const userId = isStaff(profile) ? payload.user_id ?? user.id : user.id;
    if (!userId) {
      return jsonResponse({ error: "Reservation user_id is required." }, 400);
    }

    try {
      await ensureCustomerUserExists(userId);
    } catch (error: unknown) {
      return jsonResponse({ error: (error as Error).message }, 500);
    }

    const insertPayload: ReservationPayload = {
      cottage_id: payload.cottage_id,
      user_id: userId,
      guest_name: payload.guest_name,
      guest_email: payload.guest_email ?? null,
      check_in: payload.check_in,
      check_out: payload.check_out,
      guest_count: payload.guest_count,
      total_amount: payload.total_amount,
      payment_status: payload.payment_status,
      reservation_status: payload.reservation_status,
      notes: payload.notes ?? null,
    };
    const { data, error } = await customerClient
      .from("fontana_reservations")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data });
  }

  if (resource === "payments") {
    const payload = body.payload as PaymentPayload | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing payment payload." }, 400);
    }
    const { data: reservation, error: reservationError } = await customerClient
      .from("fontana_reservations")
      .select("user_id")
      .eq("id", payload.reservation_id)
      .maybeSingle<{ user_id: string | null }>();
    if (reservationError) return jsonResponse({ error: reservationError.message }, 500);
    if (!reservation) return jsonResponse({ error: "Reservation not found." }, 404);
    if (!isStaff(profile) && reservation.user_id !== user.id) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }

    const upsertData = {
      reservation_id: payload.reservation_id,
      amount: payload.amount,
      method: payload.method,
      proof_file_name: payload.proof_file_name,
      proof_storage_path: payload.proof_storage_path ?? null,
      status: "Pending",
      updated_at: new Date().toISOString(),
    };
    const { error } = await customerClient.from("fontana_payments").upsert(upsertData, { onConflict: "reservation_id" });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "messages") {
    const payload = body.payload as MessagePayload | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing message payload." }, 400);
    }

    try {
      await ensureCustomerUserExists(payload.client_user_id);
      await ensureCustomerUserExists(user.id);
    } catch (error: unknown) {
      return jsonResponse({ error: (error as Error).message }, 500);
    }

    const insertPayload = {
      client_user_id: payload.client_user_id,
      sender_user_id: user.id,
      body: payload.body.trim(),
    };
    const { error } = await customerClient.from("fontana_messages").insert(insertPayload);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "reviews") {
    const payload = body.payload as ReviewPayload | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing review payload." }, 400);
    }

    console.log("[reviews] Creating review for user:", user.id);

    try {
      await ensureCustomerUserExists(user.id);
      console.log("[reviews] User synced successfully:", user.id);
    } catch (error: unknown) {
      console.error("[reviews] User sync failed:", (error as Error).message);
      return jsonResponse({ error: (error as Error).message }, 500);
    }

    const insertPayload = {
      user_id: user.id,
      cottage_id: payload.cottage_id,
      rating: payload.rating,
      title: payload.title,
      comment: payload.comment,
    };
    console.log("[reviews] Inserting review with payload:", insertPayload);
    const { error } = await customerClient.from("fontana_reviews").insert(insertPayload);
    if (error) {
      console.error("[reviews] Insert error:", error.message);
      return jsonResponse({ error: error.message }, 500);
    }
    console.log("[reviews] Review created successfully");
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "cottages") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const payload = body.payload as CottagePayload | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing cottage payload." }, 400);
    }
    const { data, error } = await customerClient.from("fontana_cottages").insert(payload).select("*").single();
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data });
  }

  if (resource === "profile-sync") {
    try {
      await syncUserProfileFromAdminDb(getAdminServiceClient(), user.id);
    } catch (error: unknown) {
      return jsonResponse({ error: (error as Error).message }, 500);
    }
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "events") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const payload = body.payload as
      | {
          title: string;
          description: string;
          event_type: string;
          start_date: string;
          end_date: string;
          cottage_id: string | null;
          visibility: string;
          created_by: string;
        }
      | undefined;
    if (!payload) {
      return jsonResponse({ error: "Missing event payload." }, 400);
    }
    const { data, error } = await customerClient
      .from("fontana_events")
      .insert({
        ...payload,
        status: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      if (error.message.includes("does not exist")) {
        return jsonResponse(
          {
            error:
              "Events table missing. Run supabase/fontana_events_migration.sql in the CUSTOMER Supabase project.",
          },
          500
        );
      }
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ data });
  }

  return jsonResponse({ error: "Unsupported resource." }, 400);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { profile, user } = auth;

  const customerClient = getCustomerServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const resource = String(body.resource ?? "");
  if (!resource) {
    return jsonResponse({ error: "Missing resource in request body." }, 400);
  }

  if (resource === "reservations") {
    const reservationId = String(body.id ?? "").trim();
    if (!reservationId) {
      return jsonResponse({ error: "Missing reservation ID." }, 400);
    }
    const patch = body.payload as Partial<ReservationPayload> | undefined;
    if (!patch) {
      return jsonResponse({ error: "Missing reservation payload." }, 400);
    }

    const { data: existing, error: existingError } = await customerClient
      .from("fontana_reservations")
      .select("user_id")
      .eq("id", reservationId)
      .maybeSingle<{ user_id: string | null }>();
    if (existingError) return jsonResponse({ error: existingError.message }, 500);
    if (!existing) return jsonResponse({ error: "Reservation not found." }, 404);
    if (!isStaff(profile) && existing.user_id !== user.id) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }

    const updatePayload: Record<string, unknown> = {
      ...patch,
      guest_email: patch.guest_email ?? null,
      notes: patch.notes ?? null,
    };
    if (!isStaff(profile)) {
      updatePayload.user_id = user.id;
    }
    const { error } = await customerClient.from("fontana_reservations").update(updatePayload).eq("id", reservationId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "payments") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const paymentId = String(body.id ?? "").trim();
    const payload = body.payload as { status?: string; reservation_id?: string } | undefined;
    const status = String(payload?.status ?? "").trim();
    const reservationId = String(payload?.reservation_id ?? "").trim();
    if (!paymentId || !status || !reservationId) {
      return jsonResponse({ error: "Missing payment update fields." }, 400);
    }
    const { error: paymentError } = await customerClient
      .from("fontana_payments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (paymentError) return jsonResponse({ error: paymentError.message }, 500);
    const payStatus = status === "Verified" ? "Paid" : "Unpaid";
    const { error: reservationError } = await customerClient
      .from("fontana_reservations")
      .update({ payment_status: payStatus, updated_at: new Date().toISOString() })
      .eq("id", reservationId);
    if (reservationError) return jsonResponse({ error: reservationError.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "reviews") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const reviewId = String(body.id ?? "").trim();
    const patch = body.payload as { admin_reply?: string | null } | undefined;
    const adminReply = patch?.admin_reply === null ? null : String(patch?.admin_reply ?? "").trim();
    if (!reviewId) {
      return jsonResponse({ error: "Missing review ID." }, 400);
    }
    const { error } = await customerClient
      .from("fontana_reviews")
      .update({ admin_reply: adminReply })
      .eq("id", reviewId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "events") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const eventId = String(body.id ?? "").trim();
    const patch = body.payload as Record<string, unknown> | undefined;
    if (!eventId || !patch) {
      return jsonResponse({ error: "Missing event ID or payload." }, 400);
    }
    const { error } = await customerClient
      .from("fontana_events")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  if (resource === "cottages") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const cottageId = String(body.id ?? "").trim();
    const patch = body.payload as Partial<CottagePayload> | undefined;
    if (!cottageId || !patch) {
      return jsonResponse({ error: "Missing cottage ID or payload." }, 400);
    }
    const { error } = await customerClient.from("fontana_cottages").update(patch).eq("id", cottageId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  return jsonResponse({ error: "Unsupported resource." }, 400);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const customerClient = getCustomerServiceClient();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const id = url.searchParams.get("id");
  if (!resource || !id) {
    return jsonResponse({ error: "Missing resource or id parameter." }, 400);
  }

  if (resource === "reviews") {
    if (!isStaff(profile)) {
      return jsonResponse({ error: "Forbidden." }, 403);
    }
    const { error } = await customerClient.from("fontana_reviews").delete().eq("id", id);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ data: { success: true } });
  }

  return jsonResponse({ error: "Unsupported resource." }, 400);
}
