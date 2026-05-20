"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FontanaLogo from "@/components/assets/fontana_logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export function ResetPasswordClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        const href = window.location.href;
        const url = new URL(href);

        if (url.searchParams.has("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw new Error(error.message);
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);

        if (sessionData.session) {
          if (!cancelled) setReady(true);
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY" || session) {
            setReady(true);
          }
        });
        unsub = () => authListener.subscription.unsubscribe();

        window.setTimeout(() => {
          void (async () => {
            if (cancelled) return;
            const { data } = await supabase.auth.getSession();
            if (!data.session && !cancelled) {
              setInitError("This reset link is invalid or has expired. Request a new one from the login page.");
            }
          })();
        }, 8000);
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : "Unable to verify reset link.");
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      await supabase.auth.signOut();
      router.replace("/login?reset=success");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <Image src={FontanaLogo} alt="Fontana Blue Resort" width={72} height={72} className="mx-auto h-16 w-16 rounded-xl object-contain" />
          <CardTitle className="text-lg">Set a new password</CardTitle>
          <p className="text-xs text-muted-foreground">Choose a new password for your account.</p>
        </CardHeader>
        <CardContent>
          {initError ? (
            <div className="space-y-3 text-center">
              <p className="text-xs text-red-600">{initError}</p>
              <Button asChild variant="save" className="w-full">
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-muted-foreground">Verifying reset link...</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    className="h-9 pr-9 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="h-9 text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-9 w-full" disabled={busy}>
                {busy ? "Saving..." : "Update password"}
              </Button>
              <Button type="button" variant="outline" className="h-9 w-full" asChild>
                <Link href="/login">Cancel</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
