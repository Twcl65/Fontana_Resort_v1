import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { status: "error", message: "Missing Supabase server environment variables." },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { status: "error", message: "Query parameter 'email' is required." },
      { status: 400 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json(
      { status: "error", message: "Failed querying auth users.", details: listError.message },
      { status: 500 }
    );
  }

  const users = usersData?.users ?? [];
  const user = users.find((item) => item.email?.toLowerCase() === email) ?? null;

  return NextResponse.json({
    status: "ok",
    email,
    authUserFound: Boolean(user),
    matchedUsers: users.map((item) => ({
      id: item.id,
      email: item.email,
      email_confirmed_at: item.email_confirmed_at,
      user_metadata: item.user_metadata,
      phone: item.phone,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
  });
}
