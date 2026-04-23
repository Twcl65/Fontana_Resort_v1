"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { Send, MoreHorizontal } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { getAdminMessageThreads, sendMessage, type MessageThread } from "@/lib/fontana-data";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await getAdminMessageThreads();
    if (err) setError(err);
    setThreads(data);
    setSelectedId((prev) => prev ?? (data[0]?.clientUserId ?? null));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => threads.find((t) => t.clientUserId === selectedId) ?? threads[0] ?? null,
    [threads, selectedId]
  );

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.clientEmail.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !selected) return;
    const { error: sendErr } = await sendMessage(selected.clientUserId, trimmed);
    if (sendErr) {
      setError(sendErr);
      return;
    }
    setInput("");
    await load();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">
            All client conversations — loaded from the database. Select a thread to reply.
          </p>
        </div>
        <Badge variant="statusConfirmed" className="hidden w-fit rounded-full px-3 py-1 text-[0.7rem] font-medium sm:inline-flex">
          Replying as resort
        </Badge>
      </div>

      <PageToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search clients or messages..." />

      {loading ? <p className="text-sm text-muted-foreground">Loading conversations...</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px),1fr]">
        <div className="border border-gray-200 bg-white shadow-sm">
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-sm font-semibold">Inbox</CardTitle>
            <p className="text-[0.65rem] text-muted-foreground">{filteredList.length} conversation(s)</p>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-0 divide-y divide-border overflow-y-auto p-0">
            {filteredList.map((t) => {
              const active = t.clientUserId === selected?.clientUserId;
              return (
                <button
                  key={t.clientUserId}
                  type="button"
                  onClick={() => setSelectedId(t.clientUserId)}
                  className={cn(
                    "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                    active && "bg-primary/10"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-semibold text-white">
                    {t.clientName
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{t.clientName}</p>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">{formatTime(t.lastAt)}</span>
                    </div>
                    <p className="truncate text-[0.7rem] text-muted-foreground">{t.preview}</p>
                  </div>
                </button>
              );
            })}
            {!loading && filteredList.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet.</p>
            )}
          </CardContent>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm">
          {selected ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-muted/40 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-semibold text-white">
                    {selected.clientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <CardTitle className="truncate text-sm font-semibold">{selected.clientName}</CardTitle>
                    <p className="truncate text-[0.7rem] text-muted-foreground">{selected.clientEmail}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="More options" type="button">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex h-[350px] flex-col gap-3 p-3 pt-3 sm:p-4">
                <div className="flex-1 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-3">
                  {selected.messages.map((m) => {
                    const isStaff = m.sender_user_id !== m.client_user_id;
                    return (
                      <div key={m.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm sm:text-sm ${
                            isStaff
                              ? "rounded-br-sm bg-[#3B82F6] text-white"
                              : "rounded-bl-sm bg-white text-slate-900"
                          }`}
                        >
                          <p>{m.body}</p>
                          <p className={`mt-1 text-[0.65rem] ${isStaff ? "text-white/75" : "text-muted-foreground"}`}>
                            {formatTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 border-t pt-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Write your message..."
                      className="h-9 text-sm"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Button type="button" size="sm" variant="reserve" className="h-9 px-4 text-xs font-semibold" onClick={() => void handleSend()}>
                      <Send className="mr-1 h-3.5 w-3.5" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {loading ? "Loading..." : "No conversation selected."}
            </CardContent>
          )}
        </div>
      </div>
    </div>
  );
}
