import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import {
  getTransactions,
  createTransaction,
  getTransactionByFt,
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
  if (from) txs = txs.filter((t) => t.createdAt >= from);
  if (to) txs = txs.filter((t) => t.createdAt <= to + "T23:59:59");
  if (cashierId) txs = txs.filter((t) => t.cashierId === cashierId);
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
    } = body;

    if (!ftNumber || totalAmount == null) {
      return NextResponse.json(
        { error: "Transaction number (FT) and total amount required" },
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

    if (await getTransactionByFt(String(ftNumber))) {
      return NextResponse.json(
        { error: "This transaction / FT number already exists in the system" },
        { status: 409 }
      );
    }

    // Avoid storing huge images that blow request/DB limits
    let safeImage: string | undefined = imageData || undefined;
    if (safeImage && safeImage.length > 1_500_000) {
      safeImage = undefined;
    }

    const tx = await createTransaction({
      ftNumber: String(ftNumber).trim(),
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
    });

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create transaction";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
