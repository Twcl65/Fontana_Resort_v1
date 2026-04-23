import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateUserPayload = {
  full_name: string;
  email: string;
  password: string;
  role?: "admin" | "cashier" | "client";
  status?: "active" | "inactive";
};

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing required Supabase server environment variables." },
      { status: 500 }
    );
  }

  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await req.json()) as CreateUserPayload;
  const fullName = payload.full_name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password;
  const role = payload.role ?? "client";
  const status = payload.status ?? "active";

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "full_name, email, and password are required." }, { status: 400 });
  }
  if (!["cashier", "client"].includes(role)) {
    return NextResponse.json(
      { error: "Admin account creation is restricted. Create cashier or customer accounts only." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const clientAuth = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionUserData, error: sessionUserError } = await clientAuth.auth.getUser(token);
  if (sessionUserError || !sessionUserData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: actor, error: actorError } = await adminClient
    .from("fontana_users")
    .select("id,role,status")
    .eq("id", sessionUserData.user.id)
    .maybeSingle<{ id: string; role: "admin" | "cashier" | "client"; status: "active" | "inactive" }>();

  if (actorError || !actor || actor.role !== "admin" || actor.status !== "active") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createAuthError || !createdAuthUser.user) {
    return NextResponse.json(
      { error: createAuthError?.message ?? "Failed to create user." },
      { status: 400 }
    );
  }

  const { error: upsertError } = await adminClient.from("fontana_users").upsert(
    {
      id: createdAuthUser.user.id,
      full_name: fullName,
      email,
      role,
      status,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    const dbMessage = upsertError.message ?? "";
    const isRoleConstraint =
      upsertError.code === "23514" || dbMessage.includes("fontana_users_role_check");
    return NextResponse.json(
      {
        error: isRoleConstraint
          ? "Auth user created but profile upsert failed: database role constraint still excludes cashier. Apply supabase/add_cashier_role_migration.sql first."
          : `Auth user created but profile upsert failed: ${dbMessage}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    user: {
      id: createdAuthUser.user.id,
      email,
      full_name: fullName,
      role,
      status,
    },
  });
}

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing required Supabase server environment variables." },
      { status: 500 }
    );
  }

  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const clientAuth = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionUserData, error: sessionUserError } = await clientAuth.auth.getUser(token);
  if (sessionUserError || !sessionUserData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: actor, error: actorError } = await adminClient
    .from("fontana_users")
    .select("id,role,status")
    .eq("id", sessionUserData.user.id)
    .maybeSingle<{ id: string; role: "admin" | "cashier" | "client"; status: "active" | "inactive" }>();

  if (actorError || !actor || actor.role !== "admin" || actor.status !== "active") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await adminClient
    .from("fontana_users")
    .select("id,full_name,email,role,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

type PatchUserPayload = {
  user_id: string;
  full_name?: string;
  role?: "admin" | "cashier" | "client";
  status?: "active" | "inactive";
  /** If set (min 6 chars), updates auth password via Admin API */
  new_password?: string;
};

async function requireActiveAdmin(
  supabaseUrl: string,
  supabaseAnonKey: string,
  serviceRoleKey: string,
  token: string
) {
  const clientAuth = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionUserData, error: sessionUserError } = await clientAuth.auth.getUser(token);
  if (sessionUserError || !sessionUserData.user) {
    return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };
  }

  const { data: actor, error: actorError } = await adminClient
    .from("fontana_users")
    .select("id,role,status")
    .eq("id", sessionUserData.user.id)
    .maybeSingle<{ id: string; role: "admin" | "cashier" | "client"; status: "active" | "inactive" }>();

  if (actorError || !actor || actor.role !== "admin" || actor.status !== "active") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { adminClient, actorId: sessionUserData.user.id };
}

export async function PATCH(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing required Supabase server environment variables." },
      { status: 500 }
    );
  }

  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await req.json()) as PatchUserPayload;
  const userId = payload.user_id?.trim();
  if (!userId) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  const auth = await requireActiveAdmin(supabaseUrl, supabaseAnonKey, serviceRoleKey, token);
  if ("error" in auth) return auth.error;

  const { adminClient, actorId } = auth;
  if (userId === actorId) {
    if (payload.role && payload.role !== "admin") {
      return NextResponse.json(
        { error: "Owner account role cannot be changed from admin." },
        { status: 400 }
      );
    }
    if (payload.status === "inactive") {
      return NextResponse.json(
        { error: "Owner account cannot be set to inactive." },
        { status: 400 }
      );
    }
  }

  const newPassword = payload.new_password?.trim();
  if (newPassword !== undefined && newPassword.length > 0 && newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (payload.full_name !== undefined) {
    updates.full_name = payload.full_name.trim() || null;
  }
  if (payload.role !== undefined) {
    updates.role = payload.role;
  }
  if (payload.status !== undefined) {
    updates.status = payload.status;
  }

  if (Object.keys(updates).length > 0) {
    const { error: dbError } = await adminClient.from("fontana_users").update(updates).eq("id", userId);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
  }

  if (newPassword && newPassword.length >= 6) {
    const { error: pwdError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (pwdError) {
      return NextResponse.json({ error: pwdError.message }, { status: 400 });
    }
  }

  if (payload.full_name !== undefined) {
    const { data: existing, error: getErr } = await adminClient.auth.admin.getUserById(userId);
    if (!getErr && existing?.user) {
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existing.user.user_metadata,
          full_name: payload.full_name.trim(),
        },
      });
    }
  }

  return NextResponse.json({ ok: true, user_id: userId, self_edit: userId === actorId });
}
