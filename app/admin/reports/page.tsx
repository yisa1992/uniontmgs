"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import type { Transaction } from "@/lib/types";

type TxExtra = Transaction & { tableNumber?: string; waiterName?: string };
type ReportTab = "all" | "restaurant" | "cafe" | "butchery";

const headerCell: CSSProperties = {
  padding: "12px 10px",
  fontWeight: 700,
  fontSize: 11,
  color: "#334155",
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

const footerCell: CSSProperties = {
  padding: "14px 10px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
  color: "#0f172a",
  background: "linear-gradient(90deg, #ecfdf5, #e0f2fe)",
  borderTop: "2px solid #0f766e",
};

export default function AdminReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [tab, setTab] = useState<ReportTab>("all");
  const [selectedTx, setSelectedTx] = useState<TxExtra | null>(null);

  type UnpaidBill = {
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

  const [showUnpaid, setShowUnpaid] = useState(false);
  const [unpaidItems, setUnpaidItems] = useState<UnpaidBill[]>([]);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<UnpaidBill | null>(null);
  const [payPassword, setPayPassword] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function loadUnpaid() {
    setUnpaidLoading(true);
    try {
      const res = await fetch("/api/closed-sales/unpaid");
      const d = await res.json().catch(() => ({}));
      setUnpaidItems(d.items || []);
    } catch {
      setUnpaidItems([]);
    } finally {
      setUnpaidLoading(false);
    }
  }

  async function openUnpaidPanel() {
    setShowUnpaid(true);
    await loadUnpaid();
  }

  async function confirmPaid() {
    if (!payTarget) return;
    setPayBusy(true);
    setPayError(null);
    try {
      const res = await fetch("/api/closed-sales/unpaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closedSaleId: payTarget.closedSaleId,
          rowIndex: payTarget.rowIndex,
          password: payPassword,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayError(d.error || "Failed to mark paid");
        setPayBusy(false);
        return;
      }
      setPayTarget(null);
      setPayPassword("");
      await loadUnpaid();
    } catch {
      setPayError("Network error");
    } finally {
      setPayBusy(false);
    }
  }

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

  let filtered = transactions.filter((t) => {
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

  // Category tabs: only rows with amount in that category
  if (tab === "restaurant") {
    filtered = filtered.filter((t) => (t.restaurantAmount || 0) > 0);
  } else if (tab === "cafe") {
    filtered = filtered.filter((t) => (t.cafeAmount || 0) > 0);
  } else if (tab === "butchery") {
    filtered = filtered.filter((t) => (t.butcheryAmount || 0) > 0);
  }

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

  const colsAll =
    "130px 60px 100px 150px 90px 95px 80px 90px 70px 110px 90px 90px 80px";
  const colsCategory =
    "130px 60px 100px 150px 110px 90px 110px 90px 90px 80px";

  const gridCols = tab === "all" ? colsAll : colsCategory;

  const tabMeta: { id: ReportTab; label: string; color: string; emoji: string }[] = [
    { id: "all", label: "All", color: "#0f766e", emoji: "📋" },
    { id: "restaurant", label: "Restaurant only", color: "#7c3aed", emoji: "🍽️" },
    { id: "cafe", label: "Cafe only", color: "#d97706", emoji: "☕" },
    { id: "butchery", label: "Butchery only", color: "#dc2626", emoji: "🥩" },
  ];

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  return (
    <>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #0f766e 0%, #0ea5e9 55%, #8b5cf6 100%)",
          borderRadius: 20,
          padding: "1.5rem 1.75rem",
          color: "#fff",
          marginBottom: "1.25rem",
          boxShadow: "0 12px 40px rgba(14, 165, 233, 0.25)",
        }}
      >
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.6rem", fontWeight: 800 }}>
          📊 Transaction Reports
        </h1>
        <p style={{ margin: 0, opacity: 0.92, fontSize: "0.95rem" }}>
          All sales, or Restaurant / Cafe / Butchery only — with totals at the bottom

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={openUnpaidPanel}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #dc2626, #b91c1c)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(220,38,38,0.35)",
            }}
          >
            Unpaid bill
          </button>
        </div>
        </p>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: "1.25rem",
        }}
      >
        {tabMeta.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: active ? `2px solid ${t.color}` : "1px solid #e2e8f0",
                background: active ? "#fff" : "#fff",
                color: active ? t.color : "#475569",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: active ? `0 4px 16px ${t.color}33` : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {t.emoji} {t.label}
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
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
        )
          .filter(([label]) => {
            if (tab === "restaurant") return ["TRANSACTIONS", "RESTAURANT", "TIPS"].includes(label);
            if (tab === "cafe") return ["TRANSACTIONS", "CAFE", "TIPS"].includes(label);
            if (tab === "butchery") return ["TRANSACTIONS", "BUTCHERY", "TIPS"].includes(label);
            return true;
          })
          .map(([label, value, color]) => (
            <div
              key={label}
              style={{
                minWidth: 140,
                flex: "1 1 140px",
                background: "#fff",
                borderRadius: 16,
                padding: "1rem 1.15rem",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
                borderTop: `4px solid ${color}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6 }}>
                {value}
              </div>
            </div>
          ))}
      </div>

      {/* Filters */}
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
          borderRadius: 16,
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
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

      {/* Grid */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          overflowX: "auto",
          boxShadow: "0 8px 28px rgba(15, 23, 42, 0.07)",
        }}
      >
        {loading ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            No transactions found for this view
          </p>
        ) : (
          <div style={{ minWidth: tab === "all" ? 1200 : 980 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                background: "linear-gradient(90deg, #ecfdf5 0%, #e0f2fe 50%, #f3e8ff 100%)",
              }}
            >
              {(tab === "all"
                ? [
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
                  ]
                : [
                    "Date / Time",
                    "Table",
                    "Waiter",
                    "FT Number",
                    tab === "restaurant"
                      ? "Restaurant"
                      : tab === "cafe"
                        ? "Cafe"
                        : "Butchery",
                    "Tip",
                    "Cashier",
                    "Sender",
                    "Receiver",
                    "Actions",
                  ]
              ).map((h) => (
                <div key={h} style={headerCell}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((raw) => {
              const t = raw as TxExtra;
              const categoryAmount =
                tab === "restaurant"
                  ? t.restaurantAmount
                  : tab === "cafe"
                    ? t.cafeAmount
                    : tab === "butchery"
                      ? t.butcheryAmount
                      : 0;

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
                    gridTemplateColumns: gridCols,
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

                  {tab === "all" ? (
                    <>
                      <div style={{ ...cell, fontWeight: 600 }}>
                        {t.totalAmount.toLocaleString()}
                      </div>
                      <div style={cell}>{t.restaurantAmount.toLocaleString()}</div>
                      <div style={cell}>{t.cafeAmount.toLocaleString()}</div>
                      <div style={cell}>{t.butcheryAmount.toLocaleString()}</div>
                      <div style={cell}>{t.tip.toLocaleString()}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ ...cell, fontWeight: 700, color: "#0f766e" }}>
                        {categoryAmount.toLocaleString()}
                      </div>
                      <div style={cell}>{t.tip.toLocaleString()}</div>
                    </>
                  )}

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

            {/* TOTALS FOOTER */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
              }}
            >
              {tab === "all" ? (
                <>
                  <div style={{ ...footerCell, gridColumn: "1 / 5" }}>
                    TOTAL ({totals.count} transactions)
                  </div>
                  <div style={{ ...footerCell, color: "#059669" }}>
                    {totals.total.toLocaleString()}
                  </div>
                  <div style={{ ...footerCell, color: "#7c3aed" }}>
                    {totals.restaurant.toLocaleString()}
                  </div>
                  <div style={{ ...footerCell, color: "#d97706" }}>
                    {totals.cafe.toLocaleString()}
                  </div>
                  <div style={{ ...footerCell, color: "#dc2626" }}>
                    {totals.butchery.toLocaleString()}
                  </div>
                  <div style={{ ...footerCell, color: "#0f766e" }}>
                    {totals.tip.toLocaleString()}
                  </div>
                  <div style={footerCell} />
                  <div style={footerCell} />
                  <div style={footerCell} />
                  <div style={footerCell} />
                </>
              ) : (
                <>
                  <div style={{ ...footerCell, gridColumn: "1 / 5" }}>
                    TOTAL ({totals.count} transactions)
                  </div>
                  <div style={{ ...footerCell, color: "#0f766e" }}>
                    {(tab === "restaurant"
                      ? totals.restaurant
                      : tab === "cafe"
                        ? totals.cafe
                        : totals.butchery
                    ).toLocaleString()}{" "}
                    ETB
                  </div>
                  <div style={{ ...footerCell, color: "#0f766e" }}>
                    {totals.tip.toLocaleString()} tip
                  </div>
                  <div style={footerCell} />
                  <div style={footerCell} />
                  <div style={footerCell} />
                  <div style={footerCell} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom summary strip */}
      <div
        style={{
          marginTop: "1.25rem",
          padding: "1.25rem 1.5rem",
          borderRadius: 16,
          background: "linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)",
          color: "#fff",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
          justifyContent: "space-between",
          boxShadow: "0 8px 28px rgba(15, 118, 110, 0.3)",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Page total · {tabMeta.find((x) => x.id === tab)?.label}</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {tab === "all"
              ? `${totals.total.toLocaleString()} ETB`
              : tab === "restaurant"
                ? `${totals.restaurant.toLocaleString()} ETB`
                : tab === "cafe"
                  ? `${totals.cafe.toLocaleString()} ETB`
                  : `${totals.butchery.toLocaleString()} ETB`}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Transactions</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{totals.count}</div>
          </div>
          {tab === "all" && (
            <>
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Restaurant</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {totals.restaurant.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Cafe</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {totals.cafe.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Butchery</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {totals.butchery.toLocaleString()}
                </div>
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Tips</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {totals.tip.toLocaleString()} ETB
            </div>
          </div>
        </div>
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

      {/* Unpaid bills panel */}
      {showUnpaid && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
          }}
          onClick={() => setShowUnpaid(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 820,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fef2f2",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#991b1b" }}>
                  Unpaid bills
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7f1d1d" }}>
                  Name, phone, amount — mark Paid after confirming your password
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnpaid(false)}
                style={{
                  background: "#fff",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ overflow: "auto", flex: 1, padding: "0.75rem 1rem 1.25rem" }}>
              {unpaidLoading ? (
                <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>Loading…</p>
              ) : unpaidItems.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>
                  No unpaid bills
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fef2f2" }}>
                      {["Name", "Phone", "Amount (ETB)", "Date", "Days", "Dept", "Cashier", ""].map(
                        (h) => (
                          <th
                            key={h || "a"}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "2px solid #fecaca",
                              fontSize: 11,
                              textTransform: "uppercase",
                              color: "#991b1b",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidItems.map((u) => (
                      <tr
                        key={`${u.closedSaleId}-${u.rowIndex}`}
                        style={{
                          background: u.daysOpen >= 5 ? "#fff7ed" : "#fff",
                        }}
                      >
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2", fontWeight: 600 }}>
                          {u.name}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2", fontFamily: "ui-monospace, monospace" }}>
                          {u.phone}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2", fontWeight: 800, color: "#b91c1c" }}>
                          {u.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2" }}>{u.date}</td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2", fontWeight: u.daysOpen >= 5 ? 800 : 500, color: u.daysOpen >= 5 ? "#c2410c" : "#64748b" }}>
                          {u.daysOpen}d
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2" }}>{u.departmentLabel}</td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2" }}>{u.cashierName}</td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #fee2e2" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPayTarget(u);
                              setPayPassword("");
                              setPayError(null);
                            }}
                            style={{
                              background: "#059669",
                              border: "none",
                              color: "#fff",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Paid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password confirm for Paid */}
      {payTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
          }}
          onClick={() => !payBusy && setPayTarget(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 400,
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Confirm payment</h3>
            <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
              Mark <strong>{payTarget.name}</strong> ({payTarget.phone}) —{" "}
              <strong>
                {payTarget.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ETB
              </strong>{" "}
              as paid. Enter your admin password to continue.
            </p>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Your password
            </label>
            <input
              type="password"
              autoFocus
              value={payPassword}
              onChange={(e) => setPayPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && payPassword) confirmPaid();
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 14,
                marginBottom: 12,
                boxSizing: "border-box",
              }}
              placeholder="Admin password"
            />
            {payError && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                {payError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                disabled={payBusy}
                onClick={() => setPayTarget(null)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payBusy || !payPassword}
                onClick={confirmPaid}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: payBusy || !payPassword ? "#94a3b8" : "#059669",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: payBusy || !payPassword ? "not-allowed" : "pointer",
                }}
              >
                {payBusy ? "Saving…" : "Confirm paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

