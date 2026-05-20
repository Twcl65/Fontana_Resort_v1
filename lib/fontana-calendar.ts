import {
  customerApiGet,
  customerApiPatch,
  customerApiPost,
} from "@/lib/customer-api-client";

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

export async function getCalendarDayStates(
  year: number,
  monthIndex: number
): Promise<{ data: Map<number, CalendarDayState>; error: string | null }> {
  try {
    const response = await customerApiGet("calendar-day-states", {
      year: String(year),
      month: String(monthIndex),
    });
    const map = new Map<number, CalendarDayState>();
    const raw = (response.data ?? {}) as Record<string, CalendarDayState>;
    for (const [day, state] of Object.entries(raw)) {
      map.set(Number(day), state);
    }
    return { data: map, error: null };
  } catch (err) {
    return {
      data: new Map(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listManualEventsInRange(
  from: string,
  to: string
): Promise<{ data: FontanaManualEventRow[]; error: string | null }> {
  try {
    const response = await customerApiGet("calendar-events", { from, to });
    return { data: (response.data ?? []) as FontanaManualEventRow[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listUpcomingEvents(options: {
  mode: CalendarViewMode;
  userId?: string;
  from: string;
  to: string;
}): Promise<{ data: UpcomingEventItem[]; error: string | null }> {
  try {
    const params: Record<string, string> = {
      from: options.from,
      to: options.to,
      mode: options.mode,
    };
    if (options.userId) {
      params.userId = options.userId;
    }
    const response = await customerApiGet("upcoming-events", params);
    return { data: (response.data ?? []) as UpcomingEventItem[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
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
  try {
    const response = await customerApiPost("events", payload);
    return { data: response.data as FontanaManualEventRow, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
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
  try {
    await customerApiPatch("events", id, patch);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelManualEvent(id: string): Promise<{ error: string | null }> {
  return updateManualEvent(id, { status: "cancelled" });
}
