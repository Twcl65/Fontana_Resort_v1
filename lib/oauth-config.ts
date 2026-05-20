/**
 * App URL Supabase redirects to after Google OAuth.
 * Add this to Supabase → Authentication → URL Configuration → Redirect URLs.
 */
function appOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return site ?? "";
}

export function getAppOAuthCallbackUrl(): string {
  const origin = appOrigin();
  if (!origin) return "";
  return `${origin}/auth/callback`;
}

/** Add to Supabase → Authentication → URL Configuration → Redirect URLs */
export function getPasswordResetRedirectUrl(): string {
  const origin = appOrigin();
  if (!origin) return "";
  return `${origin}/auth/reset-password`;
}
