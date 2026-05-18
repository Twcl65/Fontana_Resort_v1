"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { listCottages, type FontanaCottageRow } from "@/lib/fontana-data";
import {
  cancelManualEvent,
  getCalendarDayStates,
  insertManualEvent,
  listManualEventsInRange,
  listUpcomingEvents,
  upcomingRangeDays,
  updateManualEvent,
  type CalendarDayState,
  type CalendarViewMode,
  type FontanaManualEventRow,
  type ResortEventType,
  type ResortEventVisibility,
  type UpcomingEventItem,
} from "@/lib/fontana-calendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGE_OPTIONS = [
  { label: "Next 7 days", days: 7 },
  { label: "Next 14 days", days: 14 },
  { label: "Next 30 days", days: 30 },
  { label: "Next 90 days", days: 90 },
];

function monthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthSlots(year: number, monthIndex: number): (number | null)[] {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const slots: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) slots.push(null);
  for (let d = 1; d <= daysInMonth; d++) slots.push(d);
  while (slots.length % 7 !== 0) slots.push(null);
  return slots;
}

function isoDay(year: number, monthIndex: number, day: number) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

const MODE_COPY: Record<
  CalendarViewMode,
  { title: string; subtitle: string; calendarNote: string }
> = {
  admin: {
    title: "Availability Calendar",
    subtitle: "Resort schedule, bookings, and upcoming events for management.",
    calendarNote: "All cottages · consolidated view",
  },
  cashier: {
    title: "Availability Calendar",
    subtitle: "Track check-ins, bookings, and resort events for daily operations.",
    calendarNote: "All cottages · staff view",
  },
  client: {
    title: "Availability Calendar",
    subtitle: "Check booked dates and upcoming resort activities before you book.",
    calendarNote: "All cottages · customer view",
  },
};

type Props = { mode: CalendarViewMode };

export function CalendarWithEventsPage({ mode }: Props) {
  const copy = MODE_COPY[mode];
  const isAdmin = mode === "admin";
  const isStaff = mode === "admin" || mode === "cashier";

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [dayMap, setDayMap] = useState<Map<number, CalendarDayState>>(new Map());
  const [calError, setCalError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [rangeDays, setRangeDays] = useState(30);
  const [events, setEvents] = useState<UpcomingEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<"all" | "reservation" | "manual">("all");
  const [search, setSearch] = useState("");

  const [cottages, setCottages] = useState<FontanaCottageRow[]>([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FontanaManualEventRow | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_type: "Other" as ResortEventType,
    start_date: "",
    end_date: "",
    cottage_id: "",
    visibility: "public" as ResortEventVisibility,
  });
  const [eventSaveError, setEventSaveError] = useState<string | null>(null);
  const [eventBusy, setEventBusy] = useState(false);

  const slots = useMemo(() => buildMonthSlots(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const range = useMemo(() => upcomingRangeDays(rangeDays), [rangeDays]);

  const loadMonth = useCallback(async () => {
    const { data, error } = await getCalendarDayStates(cursor.year, cursor.month);
    if (error) setCalError(error);
    else setCalError(null);
    setDayMap(data);
  }, [cursor.year, cursor.month]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      const { from, to } = upcomingRangeDays(rangeDays);
      const { data, error } = await listUpcomingEvents({
        mode,
        userId: current?.dbUser.id,
        from,
        to,
      });
      if (error) {
        setEventsError(error);
        setEvents([]);
      } else {
        setEvents(data);
      }
    } catch (e) {
      setEventsError(e instanceof Error ? e.message : "Failed to load events.");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [mode, rangeDays]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const { data } = await listCottages({ includeArchived: true });
      setCottages(data ?? []);
    })();
  }, [isAdmin]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (filterSource !== "all") {
      list = list.filter((e) => e.source === filterSource);
    }
    if (selectedDay != null) {
      const dayIso = isoDay(cursor.year, cursor.month, selectedDay);
      list = list.filter((e) => {
        const end = e.endDate ?? e.checkOut ?? e.sortDate;
        return dayIso >= e.sortDate && dayIso <= end;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q) ||
          (e.referenceCode?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [events, filterSource, search, selectedDay, cursor.year, cursor.month]);

  const openCreateEvent = () => {
    setEditingEvent(null);
    const today = new Date().toISOString().slice(0, 10);
    setEventForm({
      title: "",
      description: "",
      event_type: "Other",
      start_date: today,
      end_date: today,
      cottage_id: "",
      visibility: "public",
    });
    setEventSaveError(null);
    setEventDialogOpen(true);
  };

  const openEditEvent = async (manualId: string) => {
    setEventSaveError(null);
    const row = events.find((e) => e.manualEventId === manualId);
    if (!row) return;
    const { data: manualList } = await listManualEventsInRange(range.from, range.to);
    const full = manualList.find((x) => x.id === manualId);
    if (!full) return;
    setEditingEvent(full);
    setEventForm({
      title: full.title,
      description: full.description,
      event_type: full.event_type,
      start_date: full.start_date,
      end_date: full.end_date,
      cottage_id: full.cottage_id ?? "",
      visibility: full.visibility,
    });
    setEventDialogOpen(true);
  };

  const saveEvent = async () => {
    setEventSaveError(null);
    setEventBusy(true);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setEventSaveError("Not signed in.");
        return;
      }
      if (!eventForm.title.trim()) {
        setEventSaveError("Title is required.");
        return;
      }
      if (!eventForm.start_date || !eventForm.end_date) {
        setEventSaveError("Start and end dates are required.");
        return;
      }
      if (eventForm.end_date < eventForm.start_date) {
        setEventSaveError("End date must be on or after start date.");
        return;
      }
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        event_type: eventForm.event_type,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date,
        cottage_id: eventForm.cottage_id || null,
        visibility: eventForm.visibility,
      };
      if (editingEvent) {
        const { error } = await updateManualEvent(editingEvent.id, payload);
        if (error) {
          setEventSaveError(error);
          return;
        }
      } else {
        const { error } = await insertManualEvent({
          ...payload,
          created_by: current.dbUser.id,
        });
        if (error) {
          setEventSaveError(error);
          return;
        }
      }
      setEventDialogOpen(false);
      await loadEvents();
      await loadMonth();
    } finally {
      setEventBusy(false);
    }
  };

  const handleCancelEvent = async (manualId: string) => {
    if (!confirm("Cancel this resort event?")) return;
    setEventBusy(true);
    try {
      const { error } = await cancelManualEvent(manualId);
      if (error) setEventsError(error);
      else {
        await loadEvents();
        await loadMonth();
      }
    } finally {
      setEventBusy(false);
    }
  };

  const goPrev = () => {
    setSelectedDay(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goNext = () => {
    setSelectedDay(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const reservationsHref = mode === "admin" ? "/admin/reservations" : "/cashier/reservations";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-md font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        {calError ? <p className="mt-1 text-xs text-red-600">{calError}</p> : null}
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/40 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
              Previous month
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={goNext}>
              Next month
              <ChevronRight className="h-4 w-4" />
            </Button>
            {selectedDay != null ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedDay(null)}>
                Clear day filter
              </Button>
            ) : null}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div>
              <CardTitle className="text-sm font-semibold">{monthLabel(cursor.year, cursor.month)}</CardTitle>
              <p className="text-xs text-muted-foreground">{copy.calendarNote}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-md border border-[#22C55E]/50 bg-[#22C55E]/25" />
                Available
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-md border border-[#EF4444] bg-[#EF4444]" />
                Booked
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-md border border-[#F59E0B]/50 bg-[#F59E0B]/25" />
                Pending
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-md border border-[#3B82F6]/50 bg-[#3B82F6]/25" />
                Resort event
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium text-muted-foreground">
            {DAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {slots.map((day, idx) => {
              if (day == null) {
                return <div key={`e-${idx}`} className="aspect-square rounded-md bg-muted/30" />;
              }
              const state = dayMap.get(day) ?? "available";
              const isBooked = state === "booked";
              const isPending = state === "pending";
              const isSelected = selectedDay === day;
              return (
                <button
                  key={`${cursor.year}-${cursor.month}-${day}`}
                  type="button"
                  onClick={() => setSelectedDay((prev) => (prev === day ? null : day))}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border text-xs font-medium transition ring-offset-2 hover:ring-2 hover:ring-primary/30",
                    isBooked
                      ? "border-[#EF4444] bg-[#EF4444] text-white"
                      : isPending
                        ? "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#B45309]"
                        : "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#15803D]",
                    isSelected && "ring-2 ring-primary"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </CardContent>
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/40 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Upcoming Events</CardTitle>
            <p className="text-xs text-muted-foreground">
              {range.from} to {range.to} · bookings and resort activities
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
            >
              <option value="all">All sources</option>
              <option value="reservation">Bookings only</option>
              <option value="manual">Resort events only</option>
            </select>
            <Input
              className="h-8 w-36 text-xs"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isAdmin ? (
              <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={openCreateEvent}>
                <Plus className="h-3.5 w-3.5" />
                Add resort event
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {eventsError ? (
            <p className="px-4 py-3 text-xs text-red-600">{eventsError}</p>
          ) : null}
          {eventsLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading upcoming events…</p>
          ) : filteredEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No upcoming events in this period
              {selectedDay != null ? " for the selected day" : ""}.
            </p>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  {isStaff ? <TableHead className="whitespace-nowrap">Reference</TableHead> : null}
                  {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap text-xs">{ev.dateLabel}</TableCell>
                    <TableCell className="text-sm font-medium">{ev.title}</TableCell>
                    <TableCell>
                      <Badge variant={ev.source === "manual" ? "default" : "secondary"} className="text-[10px]">
                        {ev.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ev.location}</TableCell>
                    <TableCell className="text-xs">{ev.status}</TableCell>
                    {isStaff ? (
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {ev.referenceCode ?? "—"}
                      </TableCell>
                    ) : null}
                    {isAdmin ? (
                      <TableCell className="text-right">
                        {ev.manualEventId ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px]"
                              disabled={eventBusy}
                              onClick={() => void openEditEvent(ev.manualEventId!)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="archive"
                              size="sm"
                              className="h-7 text-[10px]"
                              disabled={eventBusy}
                              onClick={() => void handleCancelEvent(ev.manualEventId!)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : ev.reservationId ? (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" asChild>
                            <Link href={reservationsHref}>View booking</Link>
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </div>

      {isAdmin ? (
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="text-base">{editingEvent ? "Edit resort event" : "Add resort event"}</DialogTitle>
              <DialogDescription className="text-xs">
                Public events appear for customers; staff-only events are visible to admin and cashiers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-4 py-4">
              {eventSaveError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{eventSaveError}</p>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  className="h-9 text-sm"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  className="min-h-[70px] text-sm"
                  value={eventForm.description}
                  onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={eventForm.event_type}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, event_type: e.target.value as ResortEventType }))
                    }
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Operations">Operations</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Visibility</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={eventForm.visibility}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, visibility: e.target.value as ResortEventVisibility }))
                    }
                  >
                    <option value="public">Public (guests)</option>
                    <option value="staff_only">Staff only</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start date</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End date</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cottage (optional)</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={eventForm.cottage_id}
                  onChange={(e) => setEventForm((f) => ({ ...f, cottage_id: e.target.value }))}
                >
                  <option value="">Resort-wide</option>
                  {cottages.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 border-t px-4 py-3">
              <Button type="button" variant="cancelMuted" size="sm" disabled={eventBusy} onClick={() => setEventDialogOpen(false)}>
                Close
              </Button>
              <Button type="button" variant="save" size="sm" disabled={eventBusy} onClick={() => void saveEvent()}>
                {eventBusy ? "Saving…" : "Save event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
