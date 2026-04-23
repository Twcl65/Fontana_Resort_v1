"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { listMessagesForClient, sendMessage, type FontanaMessageRow } from "@/lib/fontana-data";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ClientMessagesPage() {
  const [messages, setMessages] = useState<FontanaMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setError("Please sign in.");
        setMessages([]);
        return;
      }
      setClientId(current.dbUser.id);
      const { data, error: err } = await listMessagesForClient(current.dbUser.id);
      if (err) setError(err);
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !clientId) return;
    const { error: sendErr } = await sendMessage(clientId, trimmed);
    if (sendErr) {
      setError(sendErr);
      return;
    }
    setInput("");
    await load();
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">Chat with Fontana Blue Resort (saved in your account).</p>
        </div>
        <Badge variant="statusActive" className="w-fit rounded-full px-3 py-1 text-[0.7rem] font-medium">
          Resort messages
        </Badge>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-muted/40 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-semibold text-white">
              FB
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold">Fontana Blue Resort</CardTitle>
              <p className="text-[0.7rem] text-muted-foreground">We typically reply within business hours.</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex h-[350px] flex-col gap-3 p-3 pt-3 sm:p-4">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-3">
            {messages.length === 0 && !loading ? (
              <p className="text-center text-xs text-muted-foreground">No messages yet. Say hello below.</p>
            ) : null}
            {messages.map((m) => {
              const isMe = m.sender_user_id === m.client_user_id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm sm:text-sm ${
                      isMe ? "rounded-br-sm bg-[#3B82F6] text-white" : "rounded-bl-sm bg-white text-slate-900"
                    }`}
                  >
                    <p>{m.body}</p>
                    <p className={`mt-1 text-[0.65rem] ${isMe ? "text-white/75" : "text-muted-foreground"}`}>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button type="button" size="sm" variant="reserve" className="h-9 px-4 text-xs font-semibold" onClick={() => void handleSend()}>
                <Send className="mr-1 h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
