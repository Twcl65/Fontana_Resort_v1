import type { SupabaseClient } from "@supabase/supabase-js";

export type CalendarDayState = "available" | "booked" | "pending";

export type FontanaManualEventRow = {
  id: string;
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  cottage_id: string | null;
  visibility: string;
  status: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  cottage?: { name: string; category: string } | null;
};

export type UpcomingEventItem = {
  id: string;
  source: "reservation" | "manual";
  sortDate: string;
  title: string;
  eventType: string;
  location: string;
  status: string;
  dateLabel: string;
  description?: string;
  reservationId?: string;
  manualEventId?: string;
  referenceCode?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  endDate?: string;
};

function formatEventDate(start: string, end: string): string {
  if (start === end) {
    return new Date(`${start}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const a = new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = new Date(`${end}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${a} – ${b}`;
}

export async function getCalendarDayStatesFromDb(
  client: SupabaseClient,
  year: number,
  monthIndex: number
): Promise<{ data: Record<number, CalendarDayState>; error: string | null }> {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [{ data: resData, error: resErr }, { data: evData, error: evErr }] = await Promise.all([
    client
      .from("fontana_reservations")
      .select("check_in, check_out, reservation_status")
      .lte("check_in", endStr)
      .gte("check_out", startStr)
      .in("reservation_status", ["Pending", "Confirmed"]),
    client
      .from("fontana_events")
      .select("start_date, end_date")
      .lte("start_date", endStr)
      .gte("end_date", startStr)
      .eq("status", "scheduled"),
  ]);

  if (resErr) return { data: {}, error: resErr.message };
  if (evErr && !evErr.message.includes("does not exist")) {
    return { data: {}, error: evErr.message };
  }

  const map: Record<number, CalendarDayState> = {};
  const daysInMonth = end.getDate();
  for (let d = 1; d <= daysInMonth; d++) map[d] = "available";

  for (const row of resData ?? []) {
    const ci = new Date(row.check_in + "T12:00:00");
    const co = new Date(row.check_out + "T12:00:00");
    for (let t = ci.getTime(); t <= co.getTime(); t += 86400000) {
      const dt = new Date(t);
      if (dt.getFullYear() !== year || dt.getMonth() !== monthIndex) continue;
      const day = dt.getDate();
      const st = row.reservation_status === "Pending" ? "pending" : ("booked" as CalendarDayState);
      const prev = map[day];
      if (prev === "booked" || st === "booked") map[day] = "booked";
      else map[day] = st;
    }
  }

  return { data: map, error: null };
}

async function enrichManualEvents(
  client: SupabaseClient,
  rows: FontanaManualEventRow[]
): Promise<FontanaManualEventRow[]> {
  if (rows.length === 0) return [];
  const cIds = [...new Set(rows.map((r) => r.cottage_id).filter(Boolean))] as string[];
  if (cIds.length === 0) return rows;
  const { data: cottages } = await client.from("fontana_cottages").select("id,name,category").in("id", cIds);
  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));
  return rows.map((r) => ({
    ...r,
    cottage: r.cottage_id && cMap.get(r.cottage_id) ? cMap.get(r.cottage_id)! : null,
  }));
}

export async function listManualEventsInRangeFromDb(
  client: SupabaseClient,
  from: string,
  to: string
): Promise<{ data: FontanaManualEventRow[]; error: string | null }> {
  const { data, error } = await client
    .from("fontana_events")
    .select("*")
    .lte("start_date", to)
    .gte("end_date", from)
    .neq("status", "cancelled")
    .order("start_date", { ascending: true });

  if (error) {
    if (error.message.includes("does not exist")) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  const enriched = await enrichManualEvents(client, (data ?? []) as FontanaManualEventRow[]);
  return { data: enriched, error: null };
}

function manualToUpcoming(row: FontanaManualEventRow): UpcomingEventItem {
  const loc = row.cottage ? `${row.cottage.category} · ${row.cottage.name}` : "Resort-wide";
  return {
    id: `manual-${row.id}`,
    source: "manual",
    sortDate: row.start_date,
    title: row.title,
    eventType: row.event_type,
    location: loc,
    status: row.status === "scheduled" ? "Scheduled" : row.status,
    dateLabel: formatEventDate(row.start_date, row.end_date),
    description: row.description || undefined,
    manualEventId: row.id,
    endDate: row.end_date,
  };
}

async function reservationEventsForStaff(
  client: SupabaseClient,
  from: string,
  to: string
): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { data, error } = await client
    .from("fontana_reservations")
    .select("id, reference_code, guest_name, check_in, check_out, reservation_status, cottage_id")
    .lte("check_in", to)
    .gte("check_out", from)
    .in("reservation_status", ["Pending", "Confirmed"])
    .order("check_in", { ascending: true });

  if (error) return { data: [], error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const cIds = [...new Set(rows.map((r) => r.cottage_id))];
  const { data: cottages } = await client.from("fontana_cottages").select("id,name,category").in("id", cIds);
  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));

  return {
    data: rows.map((r) => {
      const cottage = cMap.get(r.cottage_id);
      const cat = cottage?.category ?? "Cottage";
      const cName = cottage?.name ?? "Cottage";
      const isFn = cat === "Function Hall";
      const st = r.reservation_status;
      return {
        id: `res-${r.id}`,
        source: "reservation",
        sortDate: r.check_in,
        title: `${r.guest_name} — ${cName}`,
        eventType: isFn ? `Function · ${st}` : `Booking · ${st}`,
        location: `${cat} · ${cName}`,
        status: st,
        dateLabel: formatEventDate(r.check_in, r.check_out),
        reservationId: r.id,
        referenceCode: r.reference_code,
        guestName: r.guest_name,
        checkIn: r.check_in,
        checkOut: r.check_out,
        endDate: r.check_out,
      };
    }),
    error: null,
  };
}

async function reservationEventsForClient(
  client: SupabaseClient,
  userId: string,
  from: string,
  to: string
): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { data, error } = await client
    .from("fontana_reservations")
    .select("id, reference_code, guest_name, check_in, check_out, reservation_status, cottage_id")
    .eq("user_id", userId)
    .lte("check_in", to)
    .gte("check_out", from)
    .in("reservation_status", ["Pending", "Confirmed"])
    .order("check_in", { ascending: true });

  if (error) return { data: [], error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const cIds = [...new Set(rows.map((r) => r.cottage_id))];
  const { data: cottages } = await client.from("fontana_cottages").select("id,name,category").in("id", cIds);
  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));

  return {
    data: rows.map((r) => {
      const cottage = cMap.get(r.cottage_id);
      const cat = cottage?.category ?? "Cottage";
      const cName = cottage?.name ?? "Cottage";
      const st = r.reservation_status;
      return {
        id: `res-${r.id}`,
        source: "reservation",
        sortDate: r.check_in,
        title: `Your stay — ${cName}`,
        eventType: cat === "Function Hall" ? `Function · ${st}` : `Booking · ${st}`,
        location: `${cat} · ${cName}`,
        status: st,
        dateLabel: formatEventDate(r.check_in, r.check_out),
        reservationId: r.id,
        referenceCode: r.reference_code,
        checkIn: r.check_in,
        checkOut: r.check_out,
        endDate: r.check_out,
      };
    }),
    error: null,
  };
}

export async function listUpcomingEventsFromDb(
  client: SupabaseClient,
  options: {
    mode: "admin" | "cashier" | "client";
    userId?: string;
    from: string;
    to: string;
  }
): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { mode, userId, from, to } = options;
  const isStaff = mode === "admin" || mode === "cashier";

  const [manualRes, resRes] = await Promise.all([
    listManualEventsInRangeFromDb(client, from, to),
    isStaff
      ? reservationEventsForStaff(client, from, to)
      : userId
        ? reservationEventsForClient(client, userId, from, to)
        : Promise.resolve({ data: [] as UpcomingEventItem[], error: null }),
  ]);

  if (manualRes.error) return { data: [], error: manualRes.error };
  if (resRes.error) return { data: [], error: resRes.error };

  const manualItems = manualRes.data
    .filter((e) => {
      if (isStaff) return true;
      return e.visibility === "public" && e.status === "scheduled";
    })
    .map((e) => manualToUpcoming(e));

  const merged = [...resRes.data, ...manualItems].sort((a, b) => {
    const d = a.sortDate.localeCompare(b.sortDate);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title);
  });

  return { data: merged, error: null };
}
