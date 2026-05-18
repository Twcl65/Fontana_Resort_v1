import { supabase } from "@/lib/supabaseClient";

export type CalendarDayState = "available" | "booked" | "pending";

export type ResortEventType = "Maintenance" | "Promotion" | "Entertainment" | "Operations" | "Other";
export type ResortEventVisibility = "public" | "staff_only";
export type ResortEventStatus = "scheduled" | "cancelled" | "completed";

export type FontanaManualEventRow = {
  id: string;
  title: string;
  description: string;
  event_type: ResortEventType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  cottage_id: string | null;
  visibility: ResortEventVisibility;
  status: ResortEventStatus;
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

export type CalendarViewMode = "admin" | "cashier" | "client";

export function upcomingRangeDays(days: number): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + days);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

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

export async function getCalendarDayStates(
  year: number,
  monthIndex: number
): Promise<{ data: Map<number, CalendarDayState>; error: string | null }> {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [{ data: resData, error: resErr }, { data: evData, error: evErr }] = await Promise.all([
    supabase
      .from("fontana_reservations")
      .select("check_in, check_out, reservation_status")
      .lte("check_in", endStr)
      .gte("check_out", startStr)
      .in("reservation_status", ["Pending", "Confirmed"]),
    supabase
      .from("fontana_events")
      .select("start_date, end_date")
      .lte("start_date", endStr)
      .gte("end_date", startStr)
      .eq("status", "scheduled"),
  ]);

  if (resErr) return { data: new Map(), error: resErr.message };
  if (evErr && !evErr.message.includes("does not exist")) {
    return { data: new Map(), error: evErr.message };
  }

  const map = new Map<number, CalendarDayState>();
  const daysInMonth = end.getDate();
  for (let d = 1; d <= daysInMonth; d++) map.set(d, "available");

  for (const row of resData ?? []) {
    const ci = new Date(row.check_in + "T12:00:00");
    const co = new Date(row.check_out + "T12:00:00");
    for (let t = ci.getTime(); t <= co.getTime(); t += 86400000) {
      const dt = new Date(t);
      if (dt.getFullYear() !== year || dt.getMonth() !== monthIndex) continue;
      const day = dt.getDate();
      const st = row.reservation_status === "Pending" ? "pending" : ("booked" as CalendarDayState);
      const prev = map.get(day);
      if (prev === "booked" || st === "booked") map.set(day, "booked");
      else map.set(day, st);
    }
  }

  return { data: map, error: null };
}

async function enrichManualEvents(rows: FontanaManualEventRow[]): Promise<FontanaManualEventRow[]> {
  if (rows.length === 0) return [];
  const cIds = [...new Set(rows.map((r) => r.cottage_id).filter(Boolean))] as string[];
  if (cIds.length === 0) return rows;
  const { data: cottages } = await supabase.from("fontana_cottages").select("id,name,category").in("id", cIds);
  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));
  return rows.map((r) => ({
    ...r,
    cottage: r.cottage_id && cMap.get(r.cottage_id) ? cMap.get(r.cottage_id)! : null,
  }));
}

export async function listManualEventsInRange(
  from: string,
  to: string
): Promise<{ data: FontanaManualEventRow[]; error: string | null }> {
  const { data, error } = await supabase
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
  const enriched = await enrichManualEvents((data ?? []) as FontanaManualEventRow[]);
  return { data: enriched, error: null };
}

function manualToUpcoming(row: FontanaManualEventRow, mode: CalendarViewMode): UpcomingEventItem {
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
  from: string,
  to: string
): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { data, error } = await supabase
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
  const { data: cottages } = await supabase.from("fontana_cottages").select("id,name,category").in("id", cIds);
  const cMap = new Map((cottages ?? []).map((c) => [c.id, c]));

  const items: UpcomingEventItem[] = rows.map((r) => {
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
  });
  return { data: items, error: null };
}

async function reservationEventsForClient(
  userId: string,
  from: string,
  to: string
): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { data, error } = await supabase
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
  const { data: cottages } = await supabase.from("fontana_cottages").select("id,name,category").in("id", cIds);
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

export async function listUpcomingEvents(options: {
  mode: CalendarViewMode;
  userId?: string;
  from: string;
  to: string;
}): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  const { mode, userId, from, to } = options;
  const isStaff = mode === "admin" || mode === "cashier";

  const [manualRes, resRes] = await Promise.all([
    listManualEventsInRange(from, to),
    isStaff
      ? reservationEventsForStaff(from, to)
      : userId
        ? reservationEventsForClient(userId, from, to)
        : Promise.resolve({ data: [] as UpcomingEventItem[], error: null }),
  ]);

  if (manualRes.error) return { data: [], error: manualRes.error };
  if (resRes.error) return { data: [], error: resRes.error };

  const manualItems = manualRes.data
    .filter((e) => {
      if (isStaff) return true;
      return e.visibility === "public" && e.status === "scheduled";
    })
    .map((e) => manualToUpcoming(e, mode));

  const merged = [...resRes.data, ...manualItems].sort((a, b) => {
    const d = a.sortDate.localeCompare(b.sortDate);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title);
  });

  return { data: merged, error: null };
}

export async function insertManualEvent(payload: {
  title: string;
  description: string;
  event_type: ResortEventType;
  start_date: string;
  end_date: string;
  cottage_id: string | null;
  visibility: ResortEventVisibility;
  created_by: string;
}): Promise<{ data: FontanaManualEventRow | null; error: string | null }> {
  const { data, error } = await supabase
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
      return { data: null, error: "Events table missing. Run supabase/fontana_events_migration.sql in Supabase." };
    }
    return { data: null, error: error.message };
  }
  return { data: data as FontanaManualEventRow, error: null };
}

export async function updateManualEvent(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    event_type: ResortEventType;
    start_date: string;
    end_date: string;
    cottage_id: string | null;
    visibility: ResortEventVisibility;
    status: ResortEventStatus;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("fontana_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function cancelManualEvent(id: string): Promise<{ error: string | null }> {
  return updateManualEvent(id, { status: "cancelled" });
}
