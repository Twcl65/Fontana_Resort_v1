import { NextResponse } from "next/server";
import { CUSTOMER_STORAGE_BUCKET } from "@/lib/supabase-config";
import { getAdminServiceClient, getAuthAnonClient, getCustomerServiceClient } from "@/lib/server-supabase";

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: userData, error: userError } = await getAuthAnonClient().auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const adminClient = getAdminServiceClient();
  const { data: profile, error: profileError } = await adminClient
    .from("fontana_users")
    .select("role,status")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: string; status: string }>();

  if (profileError || !profile || profile.status !== "active") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const subfolder = String(form.get("subfolder") ?? "gallery");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (subfolder !== "gallery" && subfolder !== "amenity") {
    return NextResponse.json({ error: "Invalid subfolder." }, { status: 400 });
  }

  const ext =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase() || "jpg";
  const path = `${subfolder}/${crypto.randomUUID()}.${ext}`;

  const customerClient = getCustomerServiceClient();
  const { data, error } = await customerClient.storage.from(CUSTOMER_STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    const hint =
      error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("bucket")
        ? ` Create the public bucket "${CUSTOMER_STORAGE_BUCKET}" in the CUSTOMER Supabase project (run supabase/cottage_gallery_migration.sql).`
        : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  const { data: pub } = customerClient.storage.from(CUSTOMER_STORAGE_BUCKET).getPublicUrl(data.path);
  return NextResponse.json({ url: pub.publicUrl });
}
