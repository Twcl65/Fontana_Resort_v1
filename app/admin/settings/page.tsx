"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchAdminProfile } from "@/lib/admin-api-client";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

type Tab = "general" | "password" | "notifications" | "booking";
const ADMIN_SETTINGS_KEY = "fontana_admin_settings";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [profile, setProfile] = useState({
    id: "",
    fullName: "",
    email: "",
    avatarUrl: "",
  });
  const [generalForm, setGeneralForm] = useState({
    contactNumber: "",
    address: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [notificationSettings, setNotificationSettings] = useState({
    newReservationAlert: true,
    reservationApprovalNotification: true,
    paymentConfirmationAlert: true,
    pendingPaymentAlert: true,
    paymentFailureAlert: true,
    newGuestMessageAlert: true,
    adminReplyNotification: true,
    newReviewAlert: true,
    lowRatingAlert: true,
  });
  const [bookingSettings, setBookingSettings] = useState({
    onlineBookingEnabled: true,
    openTime: "07:00",
    closeTime: "17:00",
    cancellationPolicy: "48 Hours Notice",
    paymentGcash: true,
    paymentPayOnSite: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        generalForm?: typeof generalForm;
        notificationSettings?: typeof notificationSettings;
        bookingSettings?: typeof bookingSettings;
      };
      if (parsed.generalForm) setGeneralForm(parsed.generalForm);
      if (parsed.notificationSettings) setNotificationSettings(parsed.notificationSettings);
      if (parsed.bookingSettings) setBookingSettings(parsed.bookingSettings);
    } catch {
      // ignore malformed saved settings
    }
  }, []);

  const saveLocalAdminSettings = (payload: {
    generalForm?: typeof generalForm;
    notificationSettings?: typeof notificationSettings;
    bookingSettings?: typeof bookingSettings;
  }) => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    let current: {
      generalForm?: typeof generalForm;
      notificationSettings?: typeof notificationSettings;
      bookingSettings?: typeof bookingSettings;
    } = {};
    if (raw) {
      try {
        current = JSON.parse(raw);
      } catch {
        current = {};
      }
    }
    window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify({ ...current, ...payload }));
  };

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
        const avatar =
          (typeof current.authUser.user_metadata?.avatar_url === "string" &&
            current.authUser.user_metadata.avatar_url) ||
          (typeof current.authUser.user_metadata?.picture === "string" &&
            current.authUser.user_metadata.picture) ||
          "";
        setProfile({
          id: current.dbUser.id,
          fullName: current.dbUser.full_name ?? "",
          email: current.dbUser.email,
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
      await patchAdminProfile({
        full_name: profile.fullName.trim(),
        avatar_url: profile.avatarUrl.trim() || null,
      });
      saveLocalAdminSettings({ generalForm });
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

  const saveNotificationPreferences = async () => {
    setSavingNotifications(true);
    setError("");
    setMessage("");
    try {
      saveLocalAdminSettings({ notificationSettings });
      setMessage("Notification settings saved successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notification settings.");
    } finally {
      setSavingNotifications(false);
    }
  };

  const saveBookingPreferences = async () => {
    setSavingBooking(true);
    setError("");
    setMessage("");
    try {
      saveLocalAdminSettings({ bookingSettings });
      setMessage("Booking settings saved successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save booking settings.");
    } finally {
      setSavingBooking(false);
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
          Manage resort administration settings and account security.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px,1fr]">
        <div className="space-y-2">
          <Button
            variant={activeTab === "general" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("general")}
          >
            General Settings
          </Button>
          <Button
            variant={activeTab === "password" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("password")}
          >
            Change Password
          </Button>
          <Button
            variant={activeTab === "notifications" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("notifications")}
          >
            Notification Settings
          </Button>
          <Button
            variant={activeTab === "booking" ? "default" : "outline"}
            className="w-full justify-start"
            size="sm"
            onClick={() => setActiveTab("booking")}
          >
            Booking Settings
          </Button>
        </div>

        {activeTab === "general" ? (
          <ResortForm
            profile={profile}
            setProfile={setProfile}
            generalForm={generalForm}
            setGeneralForm={setGeneralForm}
            onSave={saveProfile}
            saving={savingProfile}
            message={message}
            error={error}
          />
        ) : activeTab === "password" ? (
          <PasswordForm
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            onUpdate={updatePassword}
            saving={savingPassword}
            message={message}
            error={error}
          />
        ) : activeTab === "notifications" ? (
          <NotificationSettingsForm
            value={notificationSettings}
            onChange={setNotificationSettings}
            onSave={saveNotificationPreferences}
            saving={savingNotifications}
            message={message}
            error={error}
          />
        ) : (
          <BookingSettingsForm
            value={bookingSettings}
            onChange={setBookingSettings}
            onSave={saveBookingPreferences}
            saving={savingBooking}
            message={message}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function ResortForm({
  profile,
  setProfile,
  generalForm,
  setGeneralForm,
  onSave,
  saving,
  message,
  error,
}: {
  profile: { id: string; fullName: string; email: string; avatarUrl: string };
  setProfile: Dispatch<SetStateAction<{ id: string; fullName: string; email: string; avatarUrl: string }>>;
  generalForm: { contactNumber: string; address: string };
  setGeneralForm: Dispatch<SetStateAction<{ contactNumber: string; address: string }>>;
  onSave: () => Promise<void>;
  saving: boolean;
  message: string;
  error: string;
}) {
  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-muted/40 pb-3">
        <CardTitle className="text-sm font-semibold">Account settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Full name</Label>
            <Input
              value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={profile.email} className="h-9 text-sm" type="email" disabled />
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
            <Label className="text-xs">Contact Number</Label>
            <Input
              value={generalForm.contactNumber}
              onChange={(e) => setGeneralForm((p) => ({ ...p, contactNumber: e.target.value }))}
              className="h-9 text-sm"
              placeholder="09XX XXX XXXX"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <Input
              value={generalForm.address}
              onChange={(e) => setGeneralForm((p) => ({ ...p, address: e.target.value }))}
              className="h-9 text-sm"
              placeholder="Resort address"
            />
          </div>
        </div>
        {message && <p className="text-xs text-[#16A34A]">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="pt-1">
          <Button className="h-9 px-4 text-sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function NotificationSettingsForm({
  value,
  onChange,
  onSave,
  saving,
  message,
  error,
}: {
  value: {
    newReservationAlert: boolean;
    reservationApprovalNotification: boolean;
    paymentConfirmationAlert: boolean;
    pendingPaymentAlert: boolean;
    paymentFailureAlert: boolean;
    newGuestMessageAlert: boolean;
    adminReplyNotification: boolean;
    newReviewAlert: boolean;
    lowRatingAlert: boolean;
  };
  onChange: Dispatch<
    SetStateAction<{
      newReservationAlert: boolean;
      reservationApprovalNotification: boolean;
      paymentConfirmationAlert: boolean;
      pendingPaymentAlert: boolean;
      paymentFailureAlert: boolean;
      newGuestMessageAlert: boolean;
      adminReplyNotification: boolean;
      newReviewAlert: boolean;
      lowRatingAlert: boolean;
    }>
  >;
  onSave: () => Promise<void>;
  saving: boolean;
  message: string;
  error: string;
}) {
  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-muted/40 pb-3">
        <CardTitle className="text-sm font-semibold">Notification settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <ToggleRow label="New Reservation Alert" checked={value.newReservationAlert} onChange={(v) => onChange((p) => ({ ...p, newReservationAlert: v }))} />
        <ToggleRow label="Reservation Approval Notification" checked={value.reservationApprovalNotification} onChange={(v) => onChange((p) => ({ ...p, reservationApprovalNotification: v }))} />
        <ToggleRow label="Payment Confirmation Alert" checked={value.paymentConfirmationAlert} onChange={(v) => onChange((p) => ({ ...p, paymentConfirmationAlert: v }))} />
        <ToggleRow label="Pending Payment Alert" checked={value.pendingPaymentAlert} onChange={(v) => onChange((p) => ({ ...p, pendingPaymentAlert: v }))} />
        <ToggleRow label="Payment Failure Alert" checked={value.paymentFailureAlert} onChange={(v) => onChange((p) => ({ ...p, paymentFailureAlert: v }))} />
        <ToggleRow label="New Guest Message Alert" checked={value.newGuestMessageAlert} onChange={(v) => onChange((p) => ({ ...p, newGuestMessageAlert: v }))} />
        <ToggleRow label="Admin Reply Notification" checked={value.adminReplyNotification} onChange={(v) => onChange((p) => ({ ...p, adminReplyNotification: v }))} />
        <ToggleRow label="New Review Alert" checked={value.newReviewAlert} onChange={(v) => onChange((p) => ({ ...p, newReviewAlert: v }))} />
        <ToggleRow label="Low Rating Alert" checked={value.lowRatingAlert} onChange={(v) => onChange((p) => ({ ...p, lowRatingAlert: v }))} />
        {message && <p className="text-xs text-[#16A34A]">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button className="h-9 px-4 text-sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save notification settings"}
        </Button>
      </CardContent>
    </div>
  );
}

function BookingSettingsForm({
  value,
  onChange,
  onSave,
  saving,
  message,
  error,
}: {
  value: {
    onlineBookingEnabled: boolean;
    openTime: string;
    closeTime: string;
    cancellationPolicy: string;
    paymentGcash: boolean;
    paymentPayOnSite: boolean;
  };
  onChange: Dispatch<
    SetStateAction<{
      onlineBookingEnabled: boolean;
      openTime: string;
      closeTime: string;
      cancellationPolicy: string;
      paymentGcash: boolean;
      paymentPayOnSite: boolean;
    }>
  >;
  onSave: () => Promise<void>;
  saving: boolean;
  message: string;
  error: string;
}) {
  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-muted/40 pb-3">
        <CardTitle className="text-sm font-semibold">Booking settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <ToggleRow label="Online Booking Enabled" checked={value.onlineBookingEnabled} onChange={(v) => onChange((p) => ({ ...p, onlineBookingEnabled: v }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Opening Time</Label>
            <Input type="time" value={value.openTime} onChange={(e) => onChange((p) => ({ ...p, openTime: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Closing Time</Label>
            <Input type="time" value={value.closeTime} onChange={(e) => onChange((p) => ({ ...p, closeTime: e.target.value }))} className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cancellation Policy</Label>
          <Input
            value={value.cancellationPolicy}
            onChange={(e) => onChange((p) => ({ ...p, cancellationPolicy: e.target.value }))}
            className="h-9 text-sm"
            placeholder="e.g. 48 Hours Notice"
          />
        </div>
        <ToggleRow label="Allow GCash" checked={value.paymentGcash} onChange={(v) => onChange((p) => ({ ...p, paymentGcash: v }))} />
        <ToggleRow label="Allow Pay on Site" checked={value.paymentPayOnSite} onChange={(v) => onChange((p) => ({ ...p, paymentPayOnSite: v }))} />
        {message && <p className="text-xs text-[#16A34A]">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button className="h-9 px-4 text-sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save booking settings"}
        </Button>
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
      <CardHeader className="border-b bg-muted/40 pb-3">
        <CardTitle className="text-sm font-semibold">Change password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <Label className="text-xs">New password</Label>
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
          <Label className="text-xs">Confirm new password</Label>
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
            {saving ? "Updating..." : "Update password"}
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
