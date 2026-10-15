import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase credentials");
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["auditor", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: error.message, notifications: [], unread: 0 },
        { status: 500 }
      );
    }

    const notifications = (data || []).map((row) => ({
      id: String(row.id),
      type: String(row.type || "other"),
      title: String(row.title || ""),
      message: String(row.message || ""),
      entity_id: row.entity_id != null ? String(row.entity_id) : null,
      entity_name: row.entity_name != null ? String(row.entity_name) : null,
      actor: row.actor != null ? String(row.actor) : null,
      is_read: !!row.is_read,
      created_at: row.created_at
        ? new Date(String(row.created_at)).toISOString()
        : new Date().toISOString(),
    }));

    const unread = notifications.filter((n) => !n.is_read).length;
    return NextResponse.json({ notifications, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load notifications";
    return NextResponse.json(
      { error: msg, notifications: [], unread: 0 },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["auditor", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const admin = getAdminClient();

    if (body.all) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", String(body.id));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
