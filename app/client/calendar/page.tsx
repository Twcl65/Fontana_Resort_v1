"use client";

import { useEffect, useMemo, useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarDayStates, type CalendarDayState } from "@/lib/fontana-data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function ClientCalendarPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [dayMap, setDayMap] = useState<Map<number, CalendarDayState>>(new Map());
  const [calError, setCalError] = useState<string | null>(null);

  const slots = useMemo(() => buildMonthSlots(cursor.year, cursor.month), [cursor.year, cursor.month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getCalendarDayStates(cursor.year, cursor.month);
      if (cancelled) return;
      if (error) setCalError(error);
      else setCalError(null);
      setDayMap(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [cursor.year, cursor.month]);

  const goPrev = () => {
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goNext = () => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-md font-semibold tracking-tight">Availability Calendar</h1>
        <p className="text-xs text-muted-foreground">
          Check booked and available dates before creating a reservation request.
        </p>
        {calError ? <p className="mt-1 text-xs text-red-600">{calError}</p> : null}
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/40 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={goPrev}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={goNext}
              aria-label="Next month"
            >
              Next month
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div>
              <CardTitle className="text-sm font-semibold">{monthLabel(cursor.year, cursor.month)}</CardTitle>
              <p className="text-xs text-muted-foreground">All cottages · customer view</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
              return (
                <div
                  key={`${cursor.year}-${cursor.month}-${day}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border text-xs font-medium",
                    isBooked
                      ? "border-[#EF4444] bg-[#EF4444] text-white"
                      : isPending
                        ? "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#B45309]"
                        : "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#15803D]"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </CardContent>
      </div>
    </div>
  );
}
