import { NextResponse } from "next/server";
import { CUSTOMER_STORAGE_BUCKET, getSupabaseConfigSummary } from "@/lib/supabase-config";
import {
  getAdminServiceClient,
  getAuthAnonClient,
  getCustomerServiceClient,
} from "@/lib/server-supabase";

async function testTable(client: ReturnType<typeof getAdminServiceClient> | null, name: string, table: string) {
  if (!client) {
    return { status: "skipped", name, message: "Client not configured." };
  }
  const { error } = await client.from(table).select("id").limit(1);
  if (error) return { status: "error", name, message: error.message };
  return { status: "ok", name };
}

async function testStorage() {
  try {
    const client = getCustomerServiceClient();
    const { data, error } = await client.storage.getBucket(CUSTOMER_STORAGE_BUCKET);
    if (error) {
      return {
        status: "error",
        name: "customer-storage",
        message: `${error.message} — run supabase/cottage_gallery_migration.sql in the CUSTOMER project.`,
      };
    }
    return { status: "ok", name: "customer-storage", public: data?.public ?? false };
  } catch (e) {
    return { status: "error", name: "customer-storage", message: (e as Error).message };
  }
}

export async function GET() {
  const config = getSupabaseConfigSummary();
  const results = await Promise.all([
    testTable(getAuthAnonClient(), "auth-users", "fontana_users"),
    testTable(getAdminServiceClient(), "admin-users", "fontana_users"),
    testTable(getCustomerServiceClient(), "customer-users", "fontana_users"),
    testTable(getCustomerServiceClient(), "customer-cottages", "fontana_cottages"),
    testStorage(),
  ]);

  const hasError = results.some((r) => r.status === "error");

  return NextResponse.json({
    status: hasError ? "degraded" : "ok",
    projects: config,
    checks: results,
  });
}
