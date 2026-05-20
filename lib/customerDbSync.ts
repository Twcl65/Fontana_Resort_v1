import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomerServiceClient } from "@/lib/server-supabase";

export type CustomerUserProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role: "admin" | "cashier" | "client";
  status: "active" | "inactive";
};

export async function syncUserProfileToCustomerDb(profile: CustomerUserProfile): Promise<void> {
  const client = getCustomerServiceClient();
  const syncData = {
    id: profile.id,
    email: profile.email || `user-${profile.id}@fontana.local`,
    full_name: profile.full_name ?? null,
    role: profile.role,
    status: profile.status,
  };

  console.log("[syncUserProfileToCustomerDb] Syncing user:", syncData.id, "email:", syncData.email);

  const { error, data } = await client.from("fontana_users").upsert(syncData, { onConflict: "id" });

  if (error) {
    console.error("[syncUserProfileToCustomerDb] Upsert error:", error.message, error.code);
    throw new Error(`Customer DB user sync failed: ${error.message} (${error.code})`);
  }

  console.log("[syncUserProfileToCustomerDb] Upsert returned data:", data);

  // Verify the user actually exists
  const { data: verifyUser, error: verifyError } = await client
    .from("fontana_users")
    .select("id, email")
    .eq("id", profile.id)
    .maybeSingle();

  if (verifyError) {
    console.error("[syncUserProfileToCustomerDb] Verify error:", verifyError.message);
    throw new Error(`Failed to verify user after sync: ${verifyError.message}`);
  }

  if (!verifyUser) {
    console.error("[syncUserProfileToCustomerDb] User does not exist after sync!", profile.id);
    throw new Error(`User ${profile.id} was not found in customer DB after sync. RLS policies may be blocking the upsert.`);
  }

  console.log("[syncUserProfileToCustomerDb] Verified user exists:", verifyUser.id, verifyUser.email);
}

export async function syncUserProfileFromAdminDb(
  adminClient: SupabaseClient,
  userId: string
): Promise<void> {
  console.log("[syncUserProfileFromAdminDb] Fetching user from admin DB:", userId);

  const { data: adminProfile, error: adminError } = await adminClient
    .from("fontana_users")
    .select("id,email,full_name,role,status")
    .eq("id", userId)
    .maybeSingle<CustomerUserProfile>();

  if (adminError) {
    console.error("[syncUserProfileFromAdminDb] Admin lookup error:", adminError.message);
    throw new Error(`Admin profile lookup failed: ${adminError.message}`);
  }
  if (!adminProfile) {
    console.error("[syncUserProfileFromAdminDb] User not found in admin DB:", userId);
    throw new Error(`Admin profile for user ${userId} was not found. User may not be registered in the admin database.`);
  }

  console.log("[syncUserProfileFromAdminDb] Found admin profile:", adminProfile.id, adminProfile.email);

  try {
    await syncUserProfileToCustomerDb(adminProfile);
  } catch (syncError) {
    console.error("[syncUserProfileFromAdminDb] Customer sync error:", (syncError as Error).message);
    throw new Error(`Failed to sync user to customer database: ${(syncError as Error).message}`);
  }
}
