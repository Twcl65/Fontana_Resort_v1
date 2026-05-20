"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchAdminProfile } from "@/lib/admin-api-client";
import { fetchCurrentUserWithRole } from "@/lib/auth";

export default function AdminProfilePage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const current = await fetchCurrentUserWithRole();
        if (!current) {
          setError("No active session found.");
          setLoading(false);
          return;
        }

        setUserId(current.dbUser.id);
        setEmail(current.dbUser.email);
        setFullName(current.dbUser.full_name ?? "");
        const avatar =
          (typeof current.authUser.user_metadata?.avatar_url === "string" &&
            current.authUser.user_metadata.avatar_url) ||
          (typeof current.authUser.user_metadata?.picture === "string" &&
            current.authUser.user_metadata.picture) ||
          "";
        setAvatarUrl(avatar);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const initials = useMemo(() => {
    const source = fullName.trim() || email.trim();
    if (!source) return "A";
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? "").join("");
    }
    return source.slice(0, 3).toUpperCase();
  }, [fullName, email]);

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await patchAdminProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || null,
      });

      setMessage("Profile updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-md font-semibold tracking-tight">Profile</h1>
        <p className="text-xs text-muted-foreground">Manage your admin account details.</p>
      </div>

      <Card className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-sm font-semibold">Admin Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName || "Admin avatar"} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <p className="text-xs text-muted-foreground">Set avatar URL or use initials fallback.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input className="h-9 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input className="h-9 text-sm" value={email} disabled />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Avatar URL</Label>
            <Input className="h-9 text-sm" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </div>

          {message && <p className="text-xs text-[#16A34A]">{message}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button onClick={handleSaveProfile} disabled={saving} className="h-9 px-4 text-sm">
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
