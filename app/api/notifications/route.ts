import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["auditor", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const notifications = await getNotifications();
    const unread = notifications.filter((n) => !n.read).length;
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

    if (body.all) {
      await markAllNotificationsRead();
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      await markNotificationRead(String(body.id));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}