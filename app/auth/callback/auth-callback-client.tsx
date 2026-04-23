"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getRedirectForRole,
  parseOAuthErrorFromUrl,
  ensureFontanaUserExists,
  verifyActiveUserOrThrow,
} from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

/** Serialize PKCE exchange so concurrent handlers (e.g. Strict Mode remount) share one exchange. */
let pkceExchangeInFlight: Promise<void> | null = null;

async function ensurePkceSession(href: string) {
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) return;

  const url = new URL(href);
  if (!url.searchParams.has("code")) return;

  if (!pkceExchangeInFlight) {
    pkceExchangeInFlight = (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(href);
      if (error) throw new Error(error.message);
    })().finally(() => {
      pkceExchangeInFlight = null;
    });
  }
  await pkceExchangeInFlight;
}

/** OAuth return handler: exchanges PKCE code, syncs `fontana_users`, redirects by role. */
export function AuthCallbackClient() {
  const router = useRouter();

  useEffect(() => {
    const finish = async () => {
      const href = window.location.href;

      const oauthErr = parseOAuthErrorFromUrl(href);
      if (oauthErr) {
        router.replace(`/login?oauth_error=${encodeURIComponent(oauthErr)}`);
        return;
      }

      try {
        await ensurePkceSession(href);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login?oauth_error=" + encodeURIComponent("Unable to create session"));
          return;
        }

        await ensureFontanaUserExists(user);
        const dbUser = await verifyActiveUserOrThrow(user.id);
        router.replace(getRedirectForRole(dbUser.role));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Google authentication failed";
        router.replace(`/login?oauth_error=${encodeURIComponent(message)}`);
      }
    };

    void finish();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Completing Google sign in...</p>
    </div>
  );
}
