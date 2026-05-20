import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase-config";

function createServiceClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let authAnonClient: SupabaseClient | null = null;
let adminServiceClient: SupabaseClient | null = null;
let customerServiceClient: SupabaseClient | null = null;

/** Validates JWTs from the admin/auth project. */
export function getAuthAnonClient(): SupabaseClient {
  if (!authAnonClient) {
    const { url, anonKey } = supabaseConfig.auth;
    if (!url || !anonKey) throw new Error("Auth Supabase env vars are missing.");
    authAnonClient = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return authAnonClient;
}

/** Admin DB: fontana_users, auth.admin.* */
export function getAdminServiceClient(): SupabaseClient {
  if (!adminServiceClient) {
    const { url, serviceRoleKey } = supabaseConfig.admin;
    if (!url || !serviceRoleKey) throw new Error("Admin Supabase env vars are missing.");
    adminServiceClient = createServiceClient(url, serviceRoleKey);
  }
  return adminServiceClient;
}

/** Customer DB: resort data + storage */
export function getCustomerServiceClient(): SupabaseClient {
  if (!customerServiceClient) {
    const { url, serviceRoleKey } = supabaseConfig.customer;
    if (!url || !serviceRoleKey) throw new Error("Customer Supabase env vars are missing.");
    customerServiceClient = createServiceClient(url, serviceRoleKey);
  }
  return customerServiceClient;
}

export async function requireBearerUser(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: "Unauthorized." as const };
  }
  const token = header.slice(7);
  const { data, error } = await getAuthAnonClient().auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid session." as const };
  }
  return { user: data.user, token };
}

export async function requireActiveStaffOrSelf(userId: string, allowClient = false) {
  const admin = getAdminServiceClient();
  const { data, error } = await admin
    .from("fontana_users")
    .select("id,role,status,email,full_name")
    .eq("id", userId)
    .maybeSingle<{
      id: string;
      role: "admin" | "cashier" | "client";
      status: "active" | "inactive";
      email: string;
      full_name: string | null;
    }>();
  if (error || !data || data.status !== "active") {
    return { error: "Forbidden." as const };
  }
  if (!allowClient && data.role === "client") {
    return { error: "Forbidden." as const };
  }
  return { profile: data };
}

export function isStaffRole(role: string) {
  return role === "admin" || role === "cashier";
}
