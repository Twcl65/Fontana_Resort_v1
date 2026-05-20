import { NextResponse } from "next/server";
import { syncUserProfileToCustomerDb } from "@/lib/customerDbSync";
import { getAdminServiceClient, isStaffRole, requireBearerUser } from "@/lib/server-supabase";

type PatchProfileBody = {
  full_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  address?: string | null;
};

export async function PATCH(req: Request) {
  const auth = await requireBearerUser(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === "Unauthorized." ? 401 : 401 });
  }

  const adminClient = getAdminServiceClient();
  const { data: profile, error: profileError } = await adminClient
    .from("fontana_users")
    .select("id,email,full_name,role,status")
    .eq("id", auth.user.id)
    .maybeSingle<{
      id: string;
      email: string;
      full_name: string | null;
      role: "admin" | "cashier" | "client";
      status: "active" | "inactive";
    }>();

  if (profileError || !profile || profile.status !== "active") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: PatchProfileBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fullName = body.full_name?.trim();
  if (fullName !== undefined) {
    const { error: dbError } = await adminClient
      .from("fontana_users")
      .update({ full_name: fullName || null })
      .eq("id", profile.id);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
  }

  const metadata: Record<string, unknown> = {};
  if (fullName !== undefined) metadata.full_name = fullName;
  if (body.avatar_url !== undefined) metadata.avatar_url = body.avatar_url;
  if (body.phone !== undefined) metadata.phone = body.phone;
  if (body.address !== undefined) metadata.address = body.address;

  if (Object.keys(metadata).length > 0) {
    const { data: existingAuth } = await adminClient.auth.admin.getUserById(profile.id);
    const { error: authMetaError } = await adminClient.auth.admin.updateUserById(profile.id, {
      user_metadata: {
        ...(existingAuth?.user?.user_metadata ?? {}),
        ...metadata,
      },
    });
    if (authMetaError) {
      return NextResponse.json({ error: authMetaError.message }, { status: 400 });
    }
  }

  const { data: updated, error: reloadError } = await adminClient
    .from("fontana_users")
    .select("id,email,full_name,role,status")
    .eq("id", profile.id)
    .single();

  if (reloadError || !updated) {
    return NextResponse.json({ error: reloadError?.message ?? "Failed to reload profile." }, { status: 500 });
  }

  try {
    await syncUserProfileToCustomerDb(updated);
  } catch (syncError: unknown) {
    return NextResponse.json(
      { error: `Profile saved in admin DB but customer sync failed: ${(syncError as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: updated,
    isStaff: isStaffRole(updated.role),
  });
}
