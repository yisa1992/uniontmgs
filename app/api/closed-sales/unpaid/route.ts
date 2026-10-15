import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getUserByUsername, verifyPassword } from "@/lib/db";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials");
  }
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type UnpaidBillItem = {
  closedSaleId: string;
  rowIndex: number;
  date: string;
  department: string;
  departmentLabel: string;
  cashierName: string;
  name: string;
  phone: string;
  amount: number;
  closedAt: string;
  daysOpen: number;
};

function daysBetween(isoDate: string): number {
  const start = new Date(isoDate.slice(0, 10) + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

async function logNotif(
  admin: ReturnType<typeof getAdminClient>,
  input: {
    type: string;
    title: string;
    message?: string;
    entity_id?: string | null;
    entity_name?: string | null;
    actor?: string | null;
  }
) {
  try {
    await admin.from("notifications").insert({
      type: input.type,
      title: input.title,
      message: input.message || "",
      entity_id: input.entity_id ?? null,
      entity_name: input.entity_name ?? null,
      actor: input.actor ?? null,
      is_read: false,
    });
  } catch (e) {
    console.error("[unpaid] notification insert failed", e);
  }
}

/** GET — list all unpaid bills from closed_sales */
export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["admin", "auditor"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("closed_sales")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("[unpaid] list error:", error.message);
      return NextResponse.json({ error: error.message, items: [] }, { status: 500 });
    }

    const items: UnpaidBillItem[] = [];
    for (const row of data || []) {
      const rows = Array.isArray(row.unpaid_rows) ? row.unpaid_rows : [];
      rows.forEach(
        (u: { name?: string; amount?: number; phone?: string }, idx: number) => {
          const amount = Number(u.amount) || 0;
          if (amount <= 0 && !(u.name || "").trim()) return;
          const date = String(row.date).slice(0, 10);
          items.push({
            closedSaleId: String(row.id),
            rowIndex: idx,
            date,
            department: String(row.department || ""),
            departmentLabel: String(row.department_label || row.department || ""),
            cashierName: String(row.cashier_name || ""),
            name: String(u.name || "").trim() || "—",
            phone: String(u.phone || "").trim() || "—",
            amount,
            closedAt: row.closed_at
              ? new Date(String(row.closed_at)).toISOString()
              : date,
            daysOpen: daysBetween(date),
          });
        }
      );
    }

    items.sort((a, b) => b.daysOpen - a.daysOpen || a.date.localeCompare(b.date));
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load unpaid bills";
    return NextResponse.json({ error: msg, items: [] }, { status: 500 });
  }
}

/** POST — mark one unpaid bill as paid (admin + password) */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { closedSaleId, rowIndex, password } = body;

    if (!closedSaleId || rowIndex === undefined || rowIndex === null) {
      return NextResponse.json(
        { error: "closedSaleId and rowIndex are required" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await getUserByUsername(session!.username);
    if (!user || !user.active || !verifyPassword(user, password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: row, error: fetchErr } = await admin
      .from("closed_sales")
      .select("*")
      .eq("id", String(closedSaleId))
      .single();

    if (fetchErr || !row) {
      return NextResponse.json(
        { error: fetchErr?.message || "Closed sale not found" },
        { status: 404 }
      );
    }

    const unpaidRows: { name?: string; amount?: number; phone?: string }[] =
      Array.isArray(row.unpaid_rows) ? [...row.unpaid_rows] : [];

    const idx = Number(rowIndex);
    if (idx < 0 || idx >= unpaidRows.length) {
      return NextResponse.json({ error: "Unpaid row not found" }, { status: 404 });
    }

    const paid = unpaidRows[idx];
    unpaidRows.splice(idx, 1);

    const unpaidSum = unpaidRows.reduce((s, u) => s + (Number(u.amount) || 0), 0);
    const departmentTotal = Number(row.department_total) || 0;
    const cashierTipTotal = Number(row.cashier_tip_total) || 0;
    const zReport = Number(row.z_report) || 0;
    const balance = departmentTotal + cashierTipTotal + unpaidSum - zReport;

    const updatePayload: Record<string, unknown> = {
      unpaid_rows: unpaidRows,
      unpaid_sum: unpaidSum,
      balance,
    };
    if (balance >= 0) {
      updatePayload.shortage_reason = null;
      updatePayload.responsible_person = null;
    }

    const { error: updateErr } = await admin
      .from("closed_sales")
      .update(updatePayload)
      .eq("id", String(closedSaleId));

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const actor = session?.fullName || session?.username || "Admin";
    const billName = String(paid?.name || "Unnamed").trim() || "Unnamed";
    const billAmount = Number(paid?.amount) || 0;
    const billPhone = String(paid?.phone || "").trim();

    await logNotif(admin, {
      type: "unpaid_paid",
      title: "Unpaid bill marked as paid",
      message: `${billName}${billPhone ? ` (${billPhone})` : ""} — ${billAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB was marked paid by ${actor}.`,
      entity_id: String(closedSaleId),
      entity_name: billName,
      actor,
    });

    return NextResponse.json({
      ok: true,
      paid: { name: billName, amount: billAmount, phone: billPhone },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to mark paid";
    console.error("[unpaid] mark paid:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
