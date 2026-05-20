import { getCustomerAuthToken } from "@/lib/customer-api-client";

export async function patchAdminProfile(payload: {
  full_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  address?: string | null;
}): Promise<void> {
  const token = await getCustomerAuthToken();
  const res = await fetch("/api/admin/profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to update profile.");
  }
}
