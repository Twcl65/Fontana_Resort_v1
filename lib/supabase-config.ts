/**
 * Supabase split-database layout:
 *
 * - Auth + Admin DB (NEXT_PUBLIC_SUPABASE_URL): login, fontana_users (roles/profiles)
 * - Customer DB (NEXT_PUBLIC_SUPABASE_CUSTOMER_URL): cottages, reservations, payments,
 *   messages, reviews, events, storage (cottage-images), mirrored fontana_users for FKs
 */

export const supabaseConfig = {
  auth: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  admin: {
    url: process.env.NEXT_PUBLIC_SUPABASE_ADMIN_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ADMIN_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey:
      process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  customer: {
    url: process.env.NEXT_PUBLIC_SUPABASE_CUSTOMER_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_CUSTOMER_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_CUSTOMER_SERVICE_ROLE_KEY ?? "",
  },
} as const;

export const CUSTOMER_STORAGE_BUCKET = "cottage-images";

export function isCustomerDbConfigured(): boolean {
  return Boolean(supabaseConfig.customer.url && supabaseConfig.customer.serviceRoleKey);
}

export function isAdminDbConfigured(): boolean {
  return Boolean(supabaseConfig.admin.url && supabaseConfig.admin.serviceRoleKey);
}

export function getSupabaseConfigSummary() {
  return {
    authUrl: supabaseConfig.auth.url,
    adminUrl: supabaseConfig.admin.url,
    customerUrl: supabaseConfig.customer.url,
  };
}
