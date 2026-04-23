import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type AppUserRole = "admin" | "cashier" | "client";
export type AppUserStatus = "active" | "inactive";

export type FontanaUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppUserRole;
  status: AppUserStatus;
  created_at?: string;
};

export const AUTH_ROUTES = {
  admin: "/admin/dashboard",
  cashier: "/cashier/dashboard",
  client: "/client/home",
};

function mapSignupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Email is already registered. Please log in instead.";
  }
  return message;
}

export function getDefaultFullName(user: User): string {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return "";
}

export function getRedirectForRole(role: AppUserRole): string {
  if (role === "admin") return AUTH_ROUTES.admin;
  if (role === "cashier") return AUTH_ROUTES.cashier;
  return AUTH_ROUTES.client;
}

export async function getFontanaUserById(userId: string) {
  return supabase
    .from("fontana_users")
    .select("id,email,full_name,role,status,created_at")
    .eq("id", userId)
    .maybeSingle<FontanaUserRow>();
}

export async function insertFontanaUser(payload: {
  id: string;
  email: string;
  full_name: string;
  role?: AppUserRole;
  status?: AppUserStatus;
}) {
  return supabase.from("fontana_users").insert({
    id: payload.id,
    email: payload.email,
    full_name: payload.full_name || null,
    role: payload.role ?? "client",
    status: payload.status ?? "active",
  });
}

export async function ensureFontanaUserExists(authUser: User): Promise<FontanaUserRow> {
  const { data: existingUser, error: fetchError } = await getFontanaUserById(authUser.id);
  if (fetchError) {
    throw new Error(`Failed reading profile: ${fetchError.message}`);
  }
  if (existingUser) {
    return existingUser;
  }

  const email = authUser.email?.trim();
  if (!email) {
    throw new Error("Authenticated user email is missing.");
  }

  const { error: insertError } = await insertFontanaUser({
    id: authUser.id,
    email,
    full_name: getDefaultFullName(authUser),
    role: "client",
    status: "active",
  });

  if (insertError) {
    throw new Error(`Failed creating profile: ${insertError.message}`);
  }

  const { data: createdUser, error: createdFetchError } = await getFontanaUserById(authUser.id);
  if (createdFetchError || !createdUser) {
    throw new Error("Failed to load user profile after creation.");
  }
  return createdUser;
}

export async function verifyActiveUserOrThrow(userId: string): Promise<FontanaUserRow> {
  const { data: dbUser, error } = await getFontanaUserById(userId);
  if (error) {
    throw new Error(`Failed loading user access: ${error.message}`);
  }
  if (!dbUser) {
    throw new Error("User profile not found. Please contact support.");
  }
  if (!dbUser.role) {
    throw new Error("Account role is missing. Please contact support.");
  }
  if (dbUser.status !== "active") {
    await supabase.auth.signOut();
    throw new Error("Account is inactive");
  }
  return dbUser;
}

export async function fetchCurrentUserWithRole() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(authError.message);
  }
  if (!authData.user) {
    return null;
  }
  const dbUser = await verifyActiveUserOrThrow(authData.user.id);
  return { authUser: authData.user, dbUser };
}

export async function signUpWithEmail(input: {
  full_name: string;
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { full_name: input.full_name.trim() },
    },
  });

  if (error) {
    throw new Error(mapSignupError(error.message));
  }

  return data;
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data.user) {
    throw new Error("Login succeeded but session user is unavailable.");
  }

  const dbUser = await verifyActiveUserOrThrow(data.user.id);
  return { authUser: data.user, dbUser, redirectTo: getRedirectForRole(dbUser.role) };
}

export async function signInWithGoogle(redirectTo: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function exchangeCodeForSession(currentUrl: string) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(currentUrl);
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

/** Parse OAuth error from Supabase/Google redirect (query or hash). */
export function parseOAuthErrorFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const q = u.searchParams.get("error_description") ?? u.searchParams.get("error");
    if (q) return decodeURIComponent(q.replace(/\+/g, " "));
    if (u.hash.length > 1) {
      const hp = new URLSearchParams(u.hash.slice(1));
      return hp.get("error_description") ?? hp.get("error");
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function handleOAuthSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session?.user) {
    return null;
  }

  await ensureFontanaUserExists(data.session.user);
  const dbUser = await verifyActiveUserOrThrow(data.session.user.id);
  return { authUser: data.session.user, dbUser, redirectTo: getRedirectForRole(dbUser.role) };
}

export function onAuthStateChanged(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}
