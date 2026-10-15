import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Vercel Cron: every day at 02:00 UTC (adjust in vercel.json for local timezone).
 *
 * vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/unpaid-overdue", "schedule": "0 2 * * *" }]
 * }
 *
 * Optional: set CRON_SECRET in env and send Authorization: Bearer <CRON_SECRET>
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase credentials");
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function daysBetween(isoDate: string): number {
  const start = new Date(isoDate.slice(0, 10) + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin.from("closed_sales").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const overdue: {
      name: string;
      phone: string;
      amount: number;
      date: string;
      daysOpen: number;
      departmentLabel: string;
    }[] = [];

    for (const row of data || []) {
      const date = String(row.date).slice(0, 10);
      const days = daysBetween(date);
      if (days < 5) continue;
      const rows = Array.isArray(row.unpaid_rows) ? row.unpaid_rows : [];
      for (const u of rows) {
        const amount = Number(u?.amount) || 0;
        if (amount <= 0 && !(u?.name || "").trim()) continue;
        overdue.push({
          name: String(u?.name || "—").trim() || "—",
          phone: String(u?.phone || "—").trim() || "—",
          amount,
          date,
          daysOpen: days,
          departmentLabel: String(row.department_label || row.department || ""),
        });
      }
    }

    if (overdue.length === 0) {
      return NextResponse.json({ ok: true, overdue: 0, message: "No overdue unpaid bills" });
    }

    const lines = overdue
      .slice(0, 15)
      .map(
        (o) =>
          `• ${o.name} (${o.phone}) ${o.amount.toFixed(2)} ETB — ${o.daysOpen}d · ${o.departmentLabel} · ${o.date}`
      )
      .join("\n");

    const more =
      overdue.length > 15 ? `\n…and ${overdue.length - 15} more.` : "";

    await admin.from("notifications").insert({
      type: "unpaid_overdue",
      title: `${overdue.length} unpaid bill(s) older than 5 days`,
      message: `Morning check (02:00):\n${lines}${more}`,
      entity_id: null,
      entity_name: null,
      actor: "system",
      is_read: false,
    });

    return NextResponse.json({ ok: true, overdue: overdue.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    console.error("[cron unpaid-overdue]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
