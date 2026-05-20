import { supabase } from "@/lib/supabaseClient";

export async function getCustomerAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Authentication required.");
  }
  return token;
}

export async function customerApiRequest(
  resource: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  params?: Record<string, string>,
  body?: unknown
) {
  if (typeof window === "undefined") {
    throw new Error("Customer API can only be called from the browser.");
  }

  const token = await getCustomerAuthToken();
  const queryParams = new URLSearchParams({ resource, ...(params ?? {}) });
  const url = `/api/customer?${queryParams.toString()}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? data?.message ?? `Request failed with status ${res.status}`);
  }
  return data;
}

export async function customerApiGet(resource: string, params?: Record<string, string>) {
  return customerApiRequest(resource, "GET", params);
}

export async function customerApiPost(resource: string, payload: unknown) {
  return customerApiRequest(resource, "POST", undefined, { resource, payload });
}

export async function customerApiPatch(resource: string, id: string, payload: unknown) {
  return customerApiRequest(resource, "PATCH", undefined, { resource, id, payload });
}

export async function customerApiDelete(resource: string, id: string) {
  return customerApiRequest(resource, "DELETE", { id });
}

/** Best-effort sync of the signed-in user's profile from admin DB to customer DB. */
export async function syncProfileToCustomerDb(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await customerApiPost("profile-sync", {});
  } catch {
    // Non-fatal; customer DB sync happens on next write if this fails.
  }
}
