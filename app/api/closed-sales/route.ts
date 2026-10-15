import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Run this SQL once in Supabase SQL editor (Dashboard → SQL → New query):
 *
 * create extension if not exists pgcrypto;
 *
 * create table if not exists public.closed_sales (
 *   id text primary key,
 *   date date not null,
 *   department text not null check (department in ('restaurant', 'cafe', 'butchery')),
 *   department_label text not null default '',
 *   cashier_id text not null,
 *   cashier_name text not null default '',
 *   department_total numeric not null default 0,
 *   cashier_dept_total numeric not null default 0,
 *   cashier_tip_total numeric not null default 0,
 *   unpaid_sum numeric not null default 0,
 *   unpaid_rows jsonb not null default '[]'::jsonb,
 *   z_report numeric not null default 0,
 *   balance numeric not null default 0,
 *   closed_at timestamptz not null default now(),
 *   closed_by text,
 *   shortage_reason text,
 *   responsible_person text,
 *   created_at timestamptz not null default now()
 * );
 *
 * create unique index if not exists closed_sales_unique_day_dept_cashier
 *   on public.closed_sales (date, department, cashier_id);
 *
 * create index if not exists closed_sales_date_idx on public.closed_sales (date desc);
 * create index if not exists closed_sales_closed_at_idx on public.closed_sales (closed_at desc);
 *
 * alter table public.closed_sales enable row level security;
 * drop policy if exists "authenticated read closed_sales" on public.closed_sales;
 * create policy "authenticated read closed_sales"
 *   on public.closed_sales for select to authenticated using (true);
 */

export type ClosedSaleRecord = {
  id: string;
  date: string;
  department: "restaurant" | "cafe" | "butchery";
  departmentLabel: string;
  cashierId: string;
  cashierName: string;
  departmentTotal: number;
  cashierDeptTotal: number;
  cashierTipTotal: number;
  unpaidSum: number;
  unpaidRows: { name: string; amount: number; phone: string }[];
  zReport: number;
  balance: number;
  closedAt: string;
  closedBy?: string;
  shortageReason?: string;
  responsiblePerson?: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  if (serviceKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Invalid API key: use the secret key (sb_secret_...), not the publishable key."
    );
  }

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function rowToRecord(row: Record<string, unknown>): ClosedSaleRecord {
  return {
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    department: row.department as ClosedSaleRecord["department"],
    departmentLabel: String(row.department_label || row.department || ""),
    cashierId: String(row.cashier_id || ""),
    cashierName: String(row.cashier_name || ""),
    departmentTotal: Number(row.department_total) || 0,
    cashierDeptTotal: Number(row.cashier_dept_total) || 0,
    cashierTipTotal: Number(row.cashier_tip_total) || 0,
    unpaidSum: Number(row.unpaid_sum) || 0,
    unpaidRows: Array.isArray(row.unpaid_rows)
      ? (row.unpaid_rows as ClosedSaleRecord["unpaidRows"])
      : [],
    zReport: Number(row.z_report) || 0,
    balance: Number(row.balance) || 0,
    closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : "",
    closedBy: row.closed_by != null ? String(row.closed_by) : undefined,
    shortageReason:
      row.shortage_reason != null ? String(row.shortage_reason) : undefined,
    responsiblePerson:
      row.responsible_person != null ? String(row.responsible_person) : undefined,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin", "auditor"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const department = searchParams.get("department");
    const cashierId = searchParams.get("cashierId");

    const admin = getAdminClient();
    let query = admin
      .from("closed_sales")
      .select("*")
      .order("closed_at", { ascending: false });

    if (date) query = query.eq("date", date);
    if (department) query = query.eq("department", department);
    if (cashierId) {
      query = query.or(
        `cashier_id.eq.${cashierId},cashier_name.eq.${cashierId}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[closed-sales] GET error:", error.message);
      if (
        error.message.toLowerCase().includes("relation") &&
        error.message.toLowerCase().includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "closed_sales table not found. Run the SQL in the comment at the top of api/closed-sales/route.ts in the Supabase SQL editor.",
            records: [],
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message, records: [] },
        { status: 500 }
      );
    }

    const records = (data || []).map((row) =>
      rowToRecord(row as Record<string, unknown>)
    );
    return NextResponse.json({ records });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load closed sales";
    return NextResponse.json({ error: msg, records: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["auditor", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      date,
      department,
      departmentLabel,
      cashierId,
      cashierName,
      departmentTotal,
      cashierDeptTotal,
      cashierTipTotal,
      unpaidSum,
      unpaidRows,
      zReport,
      balance,
      shortageReason,
      responsiblePerson,
    } = body;

    if (!date || !department || !cashierId) {
      return NextResponse.json(
        { error: "date, department, and cashierId are required" },
        { status: 400 }
      );
    }

    // Reasoning required when sum < Z report (negative balance / shortage)
    if (Number(balance) < 0) {
      if (
        !String(shortageReason || "").trim() ||
        !String(responsiblePerson || "").trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Sum is less than Z report (shortage). Reason and responsible person are required.",
          },
          { status: 400 }
        );
      }
    }

    const admin = getAdminClient();

    const { data: existing, error: checkErr } = await admin
      .from("closed_sales")
      .select("id")
      .eq("date", String(date))
      .eq("department", department)
      .eq("cashier_id", String(cashierId))
      .limit(1);

    if (checkErr) {
      console.error("[closed-sales] duplicate check error:", checkErr.message);
      if (
        checkErr.message.toLowerCase().includes("relation") &&
        checkErr.message.toLowerCase().includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "closed_sales table not found. Run the SQL in the comment at the top of api/closed-sales/route.ts in the Supabase SQL editor.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: checkErr.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Already submitted today for this department and cashier. Only one submission per day is allowed.",
        },
        { status: 409 }
      );
    }

    const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const closedAt = new Date().toISOString();
    const closedBy = session?.fullName || session?.username || "";

    const insertPayload = {
      id,
      date: String(date),
      department,
      department_label: departmentLabel || department,
      cashier_id: String(cashierId),
      cashier_name: String(cashierName || ""),
      department_total: Number(departmentTotal) || 0,
      cashier_dept_total: Number(cashierDeptTotal) || 0,
      cashier_tip_total: Number(cashierTipTotal) || 0,
      unpaid_sum: Number(unpaidSum) || 0,
      unpaid_rows: Array.isArray(unpaidRows) ? unpaidRows : [],
      z_report: Number(zReport) || 0,
      balance: Number(balance) || 0,
      closed_at: closedAt,
      closed_by: closedBy,
      shortage_reason:
        Number(balance) < 0
          ? String(shortageReason || "").trim() || null
          : null,
      responsible_person:
        Number(balance) < 0
          ? String(responsiblePerson || "").trim() || null
          : null,
    };

    const { data: inserted, error: insertErr } = await admin
      .from("closed_sales")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error("[closed-sales] insert error:", insertErr.message);
      if (insertErr.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Already submitted today for this department and cashier. Only one submission per day is allowed.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const record = rowToRecord(
      (inserted || insertPayload) as Record<string, unknown>
    );
    return NextResponse.json({ record }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save closed sale";
    console.error("[closed-sales] POST exception:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      id,
      departmentTotal,
      cashierDeptTotal,
      cashierTipTotal,
      unpaidSum,
      unpaidRows,
      zReport,
      balance,
      shortageReason,
      responsiblePerson,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (Number(balance) < 0) {
      if (
        !String(shortageReason || "").trim() ||
        !String(responsiblePerson || "").trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Sum is less than Z report (shortage). Reason and responsible person are required.",
          },
          { status: 400 }
        );
      }
    }

    const admin = getAdminClient();

    const updatePayload: Record<string, unknown> = {
      department_total: Number(departmentTotal) || 0,
      cashier_dept_total: Number(cashierDeptTotal) || 0,
      cashier_tip_total: Number(cashierTipTotal) || 0,
      unpaid_sum: Number(unpaidSum) || 0,
      unpaid_rows: Array.isArray(unpaidRows) ? unpaidRows : [],
      z_report: Number(zReport) || 0,
      balance: Number(balance) || 0,
      shortage_reason:
        Number(balance) < 0
          ? String(shortageReason || "").trim() || null
          : null,
      responsible_person:
        Number(balance) < 0
          ? String(responsiblePerson || "").trim() || null
          : null,
    };

    const { data: updated, error: updateErr } = await admin
      .from("closed_sales")
      .update(updatePayload)
      .eq("id", String(id))
      .select()
      .single();

    if (updateErr) {
      console.error("[closed-sales] PUT error:", updateErr.message);
      if (
        updateErr.message.toLowerCase().includes("relation") &&
        updateErr.message.toLowerCase().includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "closed_sales table not found. Run the SQL in the comment at the top of api/closed-sales/route.ts.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const record = rowToRecord(updated as Record<string, unknown>);
    return NextResponse.json({ record });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update closed sale";
    console.error("[closed-sales] PUT exception:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
