import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Run this SQL once in Supabase SQL editor:
 *
 * create table if not exists public.cashier_costs (
 *   id text primary key,
 *   date date not null,
 *   name text not null,
 *   unit_price numeric not null default 0,
 *   quantity numeric not null default 1,
 *   total numeric not null default 0,
 *   cashier_id text not null default '',
 *   cashier_name text not null default '',
 *   note text,
 *   created_at timestamptz not null default now()
 * );
 *
 * create index if not exists cashier_costs_date_idx on public.cashier_costs (date desc);
 * create index if not exists cashier_costs_cashier_idx on public.cashier_costs (cashier_id);
 *
 * alter table public.cashier_costs enable row level security;
 * drop policy if exists "authenticated read cashier_costs" on public.cashier_costs;
 * create policy "authenticated read cashier_costs"
 *   on public.cashier_costs for select to authenticated using (true);
 */

export type CostRecord = {
  id: string;
  date: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  cashierId: string;
  cashierName: string;
  note?: string;
  createdAt: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Invalid API key: use the secret key (sb_secret_...), not the publishable key."
    );
  }

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function rowToRecord(row: Record<string, unknown>): CostRecord {
  return {
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    name: String(row.name || ""),
    unitPrice: Number(row.unit_price) || 0,
    quantity: Number(row.quantity) || 0,
    total: Number(row.total) || 0,
    cashierId: String(row.cashier_id || ""),
    cashierName: String(row.cashier_name || ""),
    note: row.note != null ? String(row.note) : undefined,
    createdAt: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : "",
  };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function newId() {
  return (
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

/** GET /api/costs?date= | from=&to=  — cashiers see own, auditor/admin see all */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin", "auditor", "cashier"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const admin = getAdminClient();

    let query = admin
      .from("cashier_costs")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from && to) {
      query = query.gte("date", from).lte("date", to);
    } else if (date) {
      query = query.eq("date", date);
    } else {
      query = query.eq("date", todayISO());
    }

    // Cashiers only see their own costs
    if (session!.role === "cashier") {
      query = query.eq("cashier_id", session!.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[costs] GET error:", error.message);
      if (
        error.message.toLowerCase().includes("relation") &&
        error.message.toLowerCase().includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "cashier_costs table not found. Run the SQL in the comment at the top of api/costs/route.ts in Supabase SQL editor.",
            costs: [],
            total: 0,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message, costs: [], total: 0 },
        { status: 500 }
      );
    }

    const costs = (data || []).map((row) =>
      rowToRecord(row as Record<string, unknown>)
    );
    const total = costs.reduce((s, c) => s + c.total, 0);
    return NextResponse.json({ costs, total });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load costs";
    return NextResponse.json({ error: msg, costs: [], total: 0 }, { status: 500 });
  }
}

/** POST /api/costs — cashier adds a cost line */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["cashier", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const unitPrice = Number(body.unitPrice) || 0;
    const quantity = Number(body.quantity) || 0;
    const note = body.note != null ? String(body.note).trim() : "";
    const date = body.date ? String(body.date).slice(0, 10) : todayISO();

    if (!name) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }
    if (unitPrice < 0) {
      return NextResponse.json({ error: "Unit price cannot be negative" }, { status: 400 });
    }
    if (quantity <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
    }

    const total = Math.round(unitPrice * quantity * 100) / 100;
    const id = newId();

    const admin = getAdminClient();
    const row = {
      id,
      date,
      name,
      unit_price: unitPrice,
      quantity,
      total,
      cashier_id: session!.id,
      cashier_name: session!.fullName || session!.username || "",
      note: note || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("cashier_costs")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.error("[costs] POST error:", error.message);
      if (
        error.message.toLowerCase().includes("relation") &&
        error.message.toLowerCase().includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "cashier_costs table not found. Run the SQL in the comment at the top of api/costs/route.ts in Supabase SQL editor.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { cost: rowToRecord(data as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save cost";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/costs?id=... — cashier can delete own cost same day */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["cashier", "admin", "auditor"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Cashiers can only delete their own
    if (session!.role === "cashier") {
      const { data: existing } = await admin
        .from("cashier_costs")
        .select("cashier_id")
        .eq("id", id)
        .maybeSingle();
      if (!existing || String(existing.cashier_id) !== session!.id) {
        return NextResponse.json({ error: "Not found or not allowed" }, { status: 404 });
      }
    }

    const { error } = await admin.from("cashier_costs").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete cost";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
