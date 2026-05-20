import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUserSnippet = {
  id: string;
  full_name: string | null;
  email: string;
};

export async function fetchAdminProfilesByIds(
  adminClient: SupabaseClient,
  userIds: string[]
): Promise<AdminUserSnippet[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await adminClient
    .from("fontana_users")
    .select("id,full_name,email")
    .in("id", userIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserSnippet[];
}

export async function fetchCustomerCottagesByIds(
  customerClient: SupabaseClient,
  cottageIds: string[],
  fields = "id,name,rate_night"
): Promise<{ id: string; name: string; rate_night?: number }[]> {
  if (cottageIds.length === 0) return [];
  const { data, error } = await customerClient.from("fontana_cottages").select(fields).in("id", cottageIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { id: string; name: string; rate_night?: number }[];
}

export async function enrichReservations<
  T extends { cottage_id: string; user_id: string | null }
>(adminClient: SupabaseClient, customerClient: SupabaseClient, rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, cottage: null, guest_profile: null }));

  const cottageIds = [...new Set(rows.map((r) => r.cottage_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];

  const [cottages, profiles] = await Promise.all([
    fetchCustomerCottagesByIds(customerClient, cottageIds),
    fetchAdminProfilesByIds(adminClient, userIds),
  ]);

  const cMap = new Map(cottages.map((c) => [c.id, c]));
  const uMap = new Map(profiles.map((u) => [u.id, u]));

  return rows.map((r) => ({
    ...r,
    cottage: cMap.get(r.cottage_id)
      ? {
          name: cMap.get(r.cottage_id)!.name,
          rate_night: Number(cMap.get(r.cottage_id)!.rate_night ?? 0),
        }
      : null,
    guest_profile: r.user_id && uMap.get(r.user_id) ? uMap.get(r.user_id)! : null,
  }));
}

export async function enrichReviews<
  T extends { cottage_id: string | null; user_id: string }
>(adminClient: SupabaseClient, customerClient: SupabaseClient, rows: T[], includeAuthors: boolean) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, cottage: null, author: null }));

  const cIds = [...new Set(rows.map((r) => r.cottage_id).filter(Boolean))] as string[];
  const uIds = includeAuthors ? [...new Set(rows.map((r) => r.user_id))] : [];

  const [cottages, users] = await Promise.all([
    cIds.length
      ? customerClient.from("fontana_cottages").select("id,name").in("id", cIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    includeAuthors && uIds.length
      ? adminClient.from("fontana_users").select("id,full_name,email").in("id", uIds)
      : Promise.resolve({ data: [] as AdminUserSnippet[], error: null }),
  ]);

  if (cottages.error) throw new Error(cottages.error.message);
  if (users.error) throw new Error(users.error.message);

  const cMap = new Map((cottages.data ?? []).map((c) => [c.id, c]));
  const uMap = new Map((users.data ?? []).map((u) => [u.id, u]));

  return rows.map((r) => ({
    ...r,
    cottage: r.cottage_id && cMap.get(r.cottage_id) ? { name: cMap.get(r.cottage_id)!.name } : null,
    author: includeAuthors ? (uMap.get(r.user_id) ?? null) : null,
  }));
}
