"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Tx = {
  id: string;
  ftNumber?: string;
  totalAmount?: number;
  restaurantAmount?: number;
  cafeAmount?: number;
  butcheryAmount?: number;
  tip?: number;
  cashierName?: string;
  cashierId?: string;
  senderName?: string;
  receiverName?: string;
  tableNumber?: string;
  waiterName?: string;
  createdAt?: string;
  imageData?: string | null;
};

/** Ensure imageData is a valid data-URL the browser can display */
function normalizeImageSrc(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("data:image/")) return s;
  if (/^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 200)) && s.length > 100) {
    return `data:image/jpeg;base64,${s.replace(/\s/g, "")}`;
  }
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("blob:")) {
    return s;
  }
  return s;
}

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

export default function AdminReportsPage() {
  const [date, setDate] = useState(todayISO());
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/transactions?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to load (${res.status})`);
        setTransactions([]);
        return;
      }
      const d = await res.json();
      setTransactions(d.transactions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function viewTx(tx: Tx) {
    setImageError(false);
    setImageLoading(true);
    setSelectedTx(tx);
    try {
      const res = await fetch(
        `/api/transactions?id=${encodeURIComponent(tx.id)}&includeImage=1`
      );
      if (res.ok) {
        const d = await res.json();
        const full = (d.transactions || [])[0];
        if (full) setSelectedTx(full);
      }
    } catch {
      // keep light version
    } finally {
      setImageLoading(false);
    }
  }

  const imageSrc = selectedTx
    ? normalizeImageSrc(selectedTx.imageData)
    : null;

  const totalSum = transactions.reduce(
    (s, t) => s + (Number(t.totalAmount) || 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Cashier Transactions & Receipts
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            View FT transactions and receipt photos submitted by cashiers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-[var(--btn-border)] bg-[var(--btn-bg)] px-3 py-1.5 text-sm hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-4 text-sm text-[var(--muted)]">
        <span>
          <strong className="text-[var(--foreground)]">{transactions.length}</strong>{" "}
          transactions
        </span>
        <span>
          Total:{" "}
          <strong className="text-[var(--foreground)]">
            {totalSum.toLocaleString()} ETB
          </strong>
        </span>
      </div>

      {loading ? (
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--btn-border)] p-10 text-center text-[var(--muted)] text-sm">
          No cashier transactions for this date.
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => viewTx(t)}
              className="w-full text-left rounded-xl border border-[var(--btn-border)] bg-[var(--btn-bg)] px-4 py-3 hover:border-sky-500/50 transition"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">
                    Table {t.tableNumber || "—"}
                    {t.ftNumber ? (
                      <span className="font-normal text-[var(--muted)] ml-2 text-sm">
                        FT: {t.ftNumber}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString()
                      : "—"}{" "}
                    · Cashier: {t.cashierName || "—"}
                    {t.waiterName ? ` · Waiter: ${t.waiterName}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">
                    {(t.totalAmount ?? 0).toLocaleString()} ETB
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    View receipt →
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal with receipt image */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl border border-[var(--btn-border)] bg-[var(--background)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">Transaction Detail</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  ["Table", selectedTx.tableNumber || "—"],
                  ["Waiter", selectedTx.waiterName || "—"],
                  ["FT Number", selectedTx.ftNumber || "—"],
                  [
                    "Total",
                    `${(selectedTx.totalAmount ?? 0).toLocaleString()} ETB`,
                  ],
                  [
                    "Restaurant",
                    `${(selectedTx.restaurantAmount ?? 0).toLocaleString()} ETB`,
                  ],
                  [
                    "Cafe",
                    `${(selectedTx.cafeAmount ?? 0).toLocaleString()} ETB`,
                  ],
                  [
                    "Butchery",
                    `${(selectedTx.butcheryAmount ?? 0).toLocaleString()} ETB`,
                  ],
                  ["Tip", `${(selectedTx.tip ?? 0).toLocaleString()} ETB`],
                  ["Cashier", selectedTx.cashierName || "—"],
                  ["Sender", selectedTx.senderName || "—"],
                  ["Receiver", selectedTx.receiverName || "—"],
                  [
                    "Time",
                    selectedTx.createdAt
                      ? new Date(selectedTx.createdAt).toLocaleString()
                      : "—",
                  ],
                ] as [string, string][]
              ).map(([label, val]) => (
                <div key={label}>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    {label}
                  </div>
                  <div className="font-semibold">{val}</div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-2">
                Receipt photo
              </div>
              {imageLoading && (
                <div className="rounded-lg border border-dashed border-[var(--btn-border)] p-8 text-center text-sm text-[var(--muted)]">
                  Loading receipt image…
                </div>
              )}
              {!imageLoading && imageSrc && !imageError && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt="Receipt"
                  onError={() => setImageError(true)}
                  className="max-w-full rounded-lg border border-[var(--btn-border)]"
                />
              )}
              {!imageLoading && (!imageSrc || imageError) && (
                <div className="rounded-lg border border-dashed border-[var(--btn-border)] p-6 text-center text-sm text-[var(--muted)]">
                  {imageError
                    ? "Could not display the receipt image."
                    : "No receipt photo was attached to this transaction."}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="mt-5 w-full rounded-lg border border-[var(--btn-border)] py-2 text-sm hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/admin"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to Admin
        </Link>
      </div>
    </div>
  );
}
