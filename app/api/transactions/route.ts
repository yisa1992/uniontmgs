import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import {
  getTransactions,
  createTransaction,
  getTransactionByFt,
  deleteTransaction,
  updateTransaction,
  getUserByUsername,
  verifyPassword,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin", "auditor", "cashier"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const ft = searchParams.get("ft");
  if (ft) {
    const existing = await getTransactionByFt(ft);
    return NextResponse.json({
      exists: !!existing,
      transaction: existing || null,
    });
  }
  let txs = await getTransactions();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cashierId = searchParams.get("cashierId");
  const cashierName = searchParams.get("cashierName");
  const todayOnly = searchParams.get("today") === "1" || searchParams.get("today") === "true";

  // Business day in East Africa Time (Africa/Addis_Ababa, UTC+3)
  const bizDay = (d: Date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${day}`;
  };

  if (todayOnly) {
    const start = bizDay();
    // Match any createdAt that falls on this calendar day in EAT.
    // createdAt is usually ISO (…Z). Convert each to EAT calendar date for comparison.
    txs = txs.filter((t) => {
      if (!t.createdAt) return false;
      try {
        return bizDay(new Date(t.createdAt)) === start;
      } catch {
        // Fallback string compare for plain YYYY-MM-DD or local ISO without Z
        return String(t.createdAt) >= start && String(t.createdAt) <= start + "T23:59:59.999";
      }
    });
  } else {
    if (from) {
      txs = txs.filter((t) => {
        if (!t.createdAt) return false;
        try {
          return bizDay(new Date(t.createdAt)) >= from;
        } catch {
          return String(t.createdAt) >= from;
        }
      });
    }
    if (to) {
      txs = txs.filter((t) => {
        if (!t.createdAt) return false;
        try {
          return bizDay(new Date(t.createdAt)) <= to;
        } catch {
          return String(t.createdAt) <= to + "T23:59:59.999";
        }
      });
    }
  }

  if (cashierId) txs = txs.filter((t) => t.cashierId === cashierId);
  if (cashierName) {
    const q = cashierName.toLowerCase();
    txs = txs.filter((t) => (t.cashierName || "").toLowerCase() === q);
  }

  return NextResponse.json({ transactions: txs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["cashier"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const {
      ftNumber,
      totalAmount,
      restaurantAmount,
      cafeAmount,
      butcheryAmount,
      tip,
      senderName,
      receiverName,
      imageData,
      tableNumber,
      waiterId,
      waiterName,
    } = body;

    if (totalAmount == null || totalAmount === "") {
      return NextResponse.json(
        { error: "Total amount is required" },
        { status: 400 }
      );
    }
    if (!tableNumber || !String(tableNumber).trim()) {
      return NextResponse.json(
        { error: "Table number is required" },
        { status: 400 }
      );
    }
    if (!waiterId && !waiterName) {
      return NextResponse.json(
        { error: "Waiter is required" },
        { status: 400 }
      );
    }

    const r = Number(restaurantAmount) || 0;
    const c = Number(cafeAmount) || 0;
    const b = Number(butcheryAmount) || 0;
    const t = Number(tip) || 0;
    const total = Number(totalAmount);

    if (Math.abs(r + c + b + t - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Sum of restaurant + cafe + butchery + tip (${(r + c + b + t).toFixed(2)}) must equal scanned amount (${total.toFixed(2)})`,
        },
        { status: 400 }
      );
    }

    // FT / transaction number is optional — auto-generate if missing
    let finalFt = String(ftNumber || "").trim();
    if (!finalFt) {
      finalFt = `TXN-${Date.now()}`;
    } else if (await getTransactionByFt(finalFt)) {
      return NextResponse.json(
        { error: "This transaction / FT number already exists in the system" },
        { status: 409 }
      );
    }

    let safeImage: string | undefined = imageData || undefined;
    if (safeImage && safeImage.length > 1_500_000) {
      safeImage = undefined;
    }

    const tx = await createTransaction({
      ftNumber: finalFt,
      totalAmount: total,
      restaurantAmount: r,
      cafeAmount: c,
      butcheryAmount: b,
      tip: t,
      senderName: senderName || "",
      receiverName: receiverName || "",
      imageData: safeImage,
      cashierId: session!.id,
      cashierName: session!.fullName,
      tableNumber: String(tableNumber).trim(),
      waiterId: waiterId ? String(waiterId) : "",
      waiterName: waiterName ? String(waiterName) : "",
    });

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create transaction";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * PATCH — edit an existing transaction.
 * Requires an auditor username + password for approval.
 * Allowed for cashiers (own / any on the floor), admin, auditor.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin", "auditor", "cashier"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      id,
      auditorUsername,
      auditorPassword,
      ftNumber,
      totalAmount,
      restaurantAmount,
      cafeAmount,
      butcheryAmount,
      tip,
      senderName,
      receiverName,
      tableNumber,
      waiterId,
      waiterName,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }

    if (!auditorUsername || !auditorPassword) {
      return NextResponse.json(
        { error: "Auditor username and password are required for approval" },
        { status: 400 }
      );
    }

    const auditor = await getUserByUsername(String(auditorUsername).trim());
    if (!auditor || !auditor.active) {
      return NextResponse.json({ error: "Auditor account not found or inactive" }, { status: 401 });
    }
    if (auditor.role !== "auditor" && auditor.role !== "admin") {
      return NextResponse.json(
        { error: "Only an auditor (or admin) password can approve edits" },
        { status: 403 }
      );
    }
    if (!verifyPassword(auditor, String(auditorPassword))) {
      return NextResponse.json({ error: "Incorrect auditor password" }, { status: 401 });
    }

    const r = restaurantAmount != null ? Number(restaurantAmount) || 0 : undefined;
    const c = cafeAmount != null ? Number(cafeAmount) || 0 : undefined;
    const b = butcheryAmount != null ? Number(butcheryAmount) || 0 : undefined;
    const t = tip != null ? Number(tip) || 0 : undefined;
    const total = totalAmount != null ? Number(totalAmount) : undefined;

    if (r != null && c != null && b != null && t != null && total != null) {
      if (Math.abs(r + c + b + t - total) > 0.01) {
        return NextResponse.json(
          {
            error: `Sum of restaurant + cafe + butchery + tip (${(r + c + b + t).toFixed(2)}) must equal total (${total.toFixed(2)})`,
          },
          { status: 400 }
        );
      }
    }

    if (ftNumber != null && String(ftNumber).trim()) {
      const existing = await getTransactionByFt(String(ftNumber).trim());
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "This transaction / FT number already exists in the system" },
          { status: 409 }
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (ftNumber != null) patch.ftNumber = String(ftNumber).trim();
    if (total != null) patch.totalAmount = total;
    if (r != null) patch.restaurantAmount = r;
    if (c != null) patch.cafeAmount = c;
    if (b != null) patch.butcheryAmount = b;
    if (t != null) patch.tip = t;
    if (senderName != null) patch.senderName = String(senderName);
    if (receiverName != null) patch.receiverName = String(receiverName);
    if (tableNumber != null) patch.tableNumber = String(tableNumber).trim();
    if (waiterId != null) patch.waiterId = String(waiterId);
    if (waiterName != null) patch.waiterName = String(waiterName);
    // Audit trail
    patch.updatedAt = new Date().toISOString();
    patch.updatedBy = session!.fullName || session!.username;
    patch.approvedBy = auditor.fullName || auditor.username;

    const updated = await updateTransaction(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction: updated, ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update transaction";
    // Helpful message if updateTransaction is not yet implemented in lib/db
    if (msg.includes("updateTransaction is not a function") || msg.includes("is not a function")) {
      return NextResponse.json(
        {
          error:
            "Server is missing updateTransaction in lib/db. Please add updateTransaction(id, patch) that merges fields and persists the transaction.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Transaction id required" }, { status: 400 });
    }
    await deleteTransaction(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete transaction";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
