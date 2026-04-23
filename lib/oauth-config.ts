/**
 * App URL Supabase redirects to after Google OAuth.
 * Add this to Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function getAppOAuthCallbackUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) {
    return `${site}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}
