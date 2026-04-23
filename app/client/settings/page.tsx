"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type Tab = "profile" | "password";

type ProfileState = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl: string;
};

function readMetaString(meta: Record<string, unknown> | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

export default function ClientSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<ProfileState>({
    id: "",
    fullName: "",
    email: "",
    phone: "",
    address: "",
    avatarUrl: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
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
          return;
        }
        const meta = current.authUser.user_metadata as Record<string, unknown> | undefined;
        const avatar =
          (typeof meta?.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta?.picture === "string" && meta.picture) ||
          "";
        setProfile({
          id: current.dbUser.id,
          fullName: current.dbUser.full_name ?? "",
          email: current.dbUser.email,
          phone: readMetaString(meta, "phone"),
          address: readMetaString(meta, "address"),
          avatarUrl: avatar,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const { error: dbError } = await supabase
        .from("fontana_users")
        .update({ full_name: profile.fullName.trim() || null })
        .eq("id", profile.id);
      if (dbError) throw dbError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName.trim(),
          avatar_url: profile.avatarUrl.trim() || null,
          phone: profile.phone.trim() || null,
          address: profile.address.trim() || null,
        },
      });
      if (authError) throw authError;

      setMessage("Settings updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async () => {
    setSavingPassword(true);
    setError("");
    setMessage("");
    try {
      if (passwordForm.newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters.");
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("Password confirmation does not match.");
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (authError) throw authError;

      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setMessage("Password updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-md font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Manage your personal information and account security.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px,1fr]">
        <div className="space-y-2">
          <Button
            variant={activeTab === "profile" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("profile")}
          >
            Personal Info
          </Button>
          <Button
            variant={activeTab === "password" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("password")}
          >
            Change Password
          </Button>
        </div>

        {activeTab === "profile" ? (
          <ProfileForm
            profile={profile}
            setProfile={setProfile}
            onSave={saveProfile}
            saving={savingProfile}
            message={message}
            error={error}
          />
        ) : (
          <PasswordForm
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            onUpdate={updatePassword}
            saving={savingPassword}
            message={message}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  setProfile,
  onSave,
  saving,
  message,
  error,
}: {
  profile: ProfileState;
  setProfile: Dispatch<SetStateAction<ProfileState>>;
  onSave: () => Promise<void>;
  saving: boolean;
  message: string;
  error: string;
}) {
  const initials = useMemo(() => {
    const source = profile.fullName.trim() || profile.email.trim();
    if (!source) return "U";
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
    }
    return source.slice(0, 2).toUpperCase();
  }, [profile.fullName, profile.email]);

  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/40">
        <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-semibold text-white">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-medium">{profile.fullName || profile.email || "Your profile"}</p>
            <p className="text-[0.65rem] text-muted-foreground">
              Set an image URL below, or sign in with Google to use your account photo.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Avatar URL</Label>
          <Input
            value={profile.avatarUrl}
            onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
            className="h-9 text-sm"
            placeholder="https://..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Full Name</Label>
            <Input
              value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              className="h-9 text-sm"
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact Number</Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="h-9 text-sm"
              placeholder="09XX XXX XXXX"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Email Address</Label>
            <Input value={profile.email} className="h-9 text-sm" type="email" disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <Input
              value={profile.address}
              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              className="h-9 text-sm"
              placeholder="Your address"
            />
          </div>
        </div>

        {message && <p className="text-xs text-[#16A34A]">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="pt-1">
          <Button className="h-9 px-4 text-sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </div>
  );
}

function PasswordForm({
  passwordForm,
  setPasswordForm,
  onUpdate,
  saving,
  message,
  error,
}: {
  passwordForm: { newPassword: string; confirmPassword: string };
  setPasswordForm: Dispatch<SetStateAction<{ newPassword: string; confirmPassword: string }>>;
  onUpdate: () => Promise<void>;
  saving: boolean;
  message: string;
  error: string;
}) {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/40">
        <CardTitle className="text-sm font-semibold">Change Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <Label className="text-xs">New Password</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              className="h-9 pr-9 text-sm"
              placeholder="••••••••"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowNew((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Confirm New Password</Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              className="h-9 pr-9 text-sm"
              placeholder="••••••••"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {message && <p className="text-xs text-[#16A34A]">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button className="h-9 px-4 text-sm" onClick={onUpdate} disabled={saving}>
            {saving ? "Updating..." : "Update Password"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-4 text-sm"
            onClick={() => setPasswordForm({ newPassword: "", confirmPassword: "" })}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </div>
  );
}
