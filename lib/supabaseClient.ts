/**
 * Browser Supabase clients.
 *
 * - `supabase` / `supabaseAuth`: Admin project — login session + auth.* only
 * - `supabaseAdmin`: Admin project — same URL; use for fontana_users reads that share the session
 * - `supabaseCustomer`: Avoid for data access — customer DB JWT does not match admin auth.
 *   All resort data goes through `/api/customer` (see lib/customer-api-client.ts).
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase-config";

const authUrl = supabaseConfig.auth.url;
const authAnonKey = supabaseConfig.auth.anonKey;
const adminUrl = supabaseConfig.admin.url || authUrl;
const adminAnonKey = supabaseConfig.admin.anonKey || authAnonKey;
const customerUrl = supabaseConfig.customer.url || authUrl;
const customerAnonKey = supabaseConfig.customer.anonKey || authAnonKey;

if (!authUrl || !authAnonKey) {
  throw new Error("Supabase environment variables are missing.");
}

const authOptions = {
  auth: {
    flowType: "pkce" as const,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};

/** Admin DB session (login, OAuth, password reset). */
export const supabase = createClient(authUrl, authAnonKey, authOptions);

export const supabaseAuth = supabase;

/** Admin DB data client (fontana_users with user session). Prefer /api/admin/* for writes. */
export const supabaseAdmin = createClient(adminUrl, adminAnonKey, authOptions);

/**
 * @deprecated Direct customer DB access from the browser breaks with split auth.
 * Use customerApiGet/Post from lib/customer-api-client.ts instead.
 */
export const supabaseCustomer = createClient(customerUrl, customerAnonKey, authOptions);
