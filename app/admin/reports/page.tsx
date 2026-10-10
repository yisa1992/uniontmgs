"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import type { Transaction } from "@/lib/types";

type TxExtra = Transaction & { tableNumber?: string; waiterName?: string };

const COLS =
  "140px 70px 110px 160px 90px 100px 80px 90px 70px 120px 100px 100px 90px";

const headerCell: CSSProperties = {
  padding: "12px 10px",
  background: "#f1f5f9",
  fontWeight: 700,
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "2px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const cell: CSSProperties = {
  padding: "12px 10px",
  fontSize: 13,
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  background: "#fff",
  minWidth: 130,
};

export default function AdminReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [selectedTx, setSelectedTx] = useState<TxExtra | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const d = await res.json();
        setTransactions(d.transactions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const waiters = Array.from(
    new Set(
      transactions
        .map((t) => (t as TxExtra).waiterName)
        .filter(Boolean) as string[]
    )
  ).sort();
  const cashiers = Array.from(
    new Set(transactions.map((t) => t.cashierName).filter(Boolean))
  ).sort();

  const filtered = transactions.filter((t) => {
    const extra = t as TxExtra;
    if (waiterFilter && (extra.waiterName || "") !== waiterFilter) return false;
    if (cashierFilter && t.cashierName !== cashierFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.ftNumber?.toLowerCase().includes(q) ||
      t.cashierName?.toLowerCase().includes(q) ||
      t.senderName?.toLowerCase().includes(q) ||
      t.receiverName?.toLowerCase().includes(q) ||
      extra.tableNumber?.toLowerCase().includes(q) ||
      extra.waiterName?.toLowerCase().includes(q)
    );
  });

  const totals = filtered.reduce(
    (acc, t) => ({
      total: acc.total + t.totalAmount,
      restaurant: acc.restaurant + t.restaurantAmount,
      cafe: acc.cafe + t.cafeAmount,
      butchery: acc.butchery + t.butcheryAmount,
      tip: acc.tip + t.tip,
      count: acc.count + 1,
    }),
    { total: 0, restaurant: 0, cafe: 0, butchery: 0, tip: 0, count: 0 }
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTransactions((prev) => prev.filter((x) => x.id !== id));
      if (selectedTx?.id === id) setSelectedTx(null);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Delete failed");
    }
  }

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 700 }}>
        Transaction Reports
      </h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        Every transaction by date, time, waiter, cashier — with cafe, restaurant,
        butchery and tip breakdown
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {(
          [
            ["TRANSACTIONS", String(totals.count), "#0f172a"],
            ["TOTAL AMOUNT", `${totals.total.toLocaleString()} ETB`, "#059669"],
            ["RESTAURANT", `${totals.restaurant.toLocaleString()} ETB`, "#7c3aed"],
            ["CAFE", `${totals.cafe.toLocaleString()} ETB`, "#d97706"],
            ["BUTCHERY", `${totals.butchery.toLocaleString()} ETB`, "#dc2626"],
            ["TIPS", `${totals.tip.toLocaleString()} ETB`, "#0f766e"],
          ] as [string, string, string][]
        ).map(([label, value, color]) => (
          <div key={label} style={{ minWidth: 120 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "flex-end",
          marginBottom: "1.25rem",
          padding: "1rem",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            FROM DATE
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            TO DATE
          </div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            WAITER
          </div>
          <select value={waiterFilter} onChange={(e) => setWaiterFilter(e.target.value)} style={inputStyle}>
            <option value="">All waiters</option>
            {waiters.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            CASHIER
          </div>
          <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} style={inputStyle}>
            <option value="">All cashiers</option>
            {cashiers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            SEARCH
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FT, table, sender…"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <button
          type="button"
          onClick={load}
          style={{
            padding: "10px 18px",
            background: "#0f766e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Apply Filters
        </button>
      </div>

      {/* CSS GRID — not HTML table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        {loading ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            No transactions found
          </p>
        ) : (
          <div style={{ minWidth: 1200 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                background: "#f1f5f9",
              }}
            >
              {[
                "Date / Time",
                "Table",
                "Waiter",
                "FT Number",
                "Total",
                "Restaurant",
                "Cafe",
                "Butchery",
                "Tip",
                "Cashier",
                "Sender",
                "Receiver",
                "Actions",
              ].map((h) => (
                <div key={h} style={headerCell}>
                  {h}
                </div>
              ))}
            </div>

            {filtered.map((raw) => {
              const t = raw as TxExtra;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTx(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedTx(t);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  <div style={cell}>
                    {new Date(t.createdAt).toLocaleDateString()}
                    <br />
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ ...cell, fontWeight: 700 }}>{t.tableNumber || "—"}</div>
                  <div style={cell}>{t.waiterName || "—"}</div>
                  <div style={{ ...cell, fontFamily: "monospace", fontWeight: 600 }}>
                    {t.ftNumber}
                  </div>
                  <div style={{ ...cell, fontWeight: 600 }}>
                    {t.totalAmount.toLocaleString()}
                  </div>
                  <div style={cell}>{t.restaurantAmount.toLocaleString()}</div>
                  <div style={cell}>{t.cafeAmount.toLocaleString()}</div>
                  <div style={cell}>{t.butcheryAmount.toLocaleString()}</div>
                  <div style={cell}>{t.tip.toLocaleString()}</div>
                  <div style={cell}>{t.cashierName}</div>
                  <div style={cell}>{t.senderName || "—"}</div>
                  <div style={cell}>{t.receiverName || "—"}</div>
                  <div style={cell} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      style={{
                        padding: "6px 12px",
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTx && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={() => setSelectedTx(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 480,
              width: "100%",
              padding: "1.5rem",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>Transaction Detail</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem 1rem",
                fontSize: "0.9rem",
              }}
            >
              {(
                [
                  ["Date", new Date(selectedTx.createdAt).toLocaleString()],
                  ["Table", selectedTx.tableNumber || "—"],
                  ["Waiter", selectedTx.waiterName || "—"],
                  ["FT Number", selectedTx.ftNumber],
                  ["Total", `${selectedTx.totalAmount.toLocaleString()} ETB`],
                  ["Restaurant", `${selectedTx.restaurantAmount.toLocaleString()} ETB`],
                  ["Cafe", `${selectedTx.cafeAmount.toLocaleString()} ETB`],
                  ["Butchery", `${selectedTx.butcheryAmount.toLocaleString()} ETB`],
                  ["Tip", `${selectedTx.tip.toLocaleString()} ETB`],
                  ["Cashier", selectedTx.cashierName],
                  ["Sender", selectedTx.senderName || "—"],
                  ["Receiver", selectedTx.receiverName || "—"],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>
                    {label}
                  </div>
                  <div style={{ fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            {selectedTx.imageData ? (
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
                  Receipt photo
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedTx.imageData}
                  alt="Receipt"
                  style={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                />
              </div>
            ) : (
              <p style={{ marginTop: "1rem", fontSize: 14, color: "#64748b" }}>
                No receipt photo saved for this transaction.
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => handleDelete(selectedTx.id)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
