"use client";

import { useEffect, useState, useCallback, type MouseEvent } from "react";
import type { Transaction } from "@/lib/types";

export default function AdminReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete(id: string, e?: MouseEvent) {
    e?.stopPropagation();
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeletingId(id);
    setDeleteError("");
    try {
      const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete");
        return;
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      if (selectedTx?.id === id) setSelectedTx(null);
    } catch {
      setDeleteError("Network error while deleting");
    } finally {
      setDeletingId(null);
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
        .map((t) => (t as { waiterName?: string }).waiterName)
        .filter(Boolean) as string[]
    )
  ).sort();
  const cashiers = Array.from(
    new Set(transactions.map((t) => t.cashierName).filter(Boolean))
  ).sort();

  const filtered = transactions.filter((t) => {
    const extra = t as { tableNumber?: string; waiterName?: string };
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

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
        {deleteError && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {deleteError}
          </div>
        )}
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
          Transaction Reports
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Every transaction by date, time, waiter, cashier — with cafe, restaurant,
          butchery and tip breakdown
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "Transactions", value: totals.count, color: "#1e40af" },
            {
              label: "Total Amount",
              value: `${totals.total.toLocaleString()} ETB`,
              color: "#059669",
            },
            {
              label: "Restaurant",
              value: `${totals.restaurant.toLocaleString()} ETB`,
              color: "#7c3aed",
            },
            {
              label: "Cafe",
              value: `${totals.cafe.toLocaleString()} ETB`,
              color: "#d97706",
            },
            {
              label: "Butchery",
              value: `${totals.butchery.toLocaleString()} ETB`,
              color: "#dc2626",
            },
            {
              label: "Tips",
              value: `${totals.tip.toLocaleString()} ETB`,
              color: "#0891b2",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="card"
              style={{ padding: "1rem 1.15rem" }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: c.color,
                  marginTop: "0.25rem",
                }}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>

        <div
          className="card"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 130px" }}>
            <label className="label">From Date</label>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label className="label">To Date</label>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="label">Waiter</label>
            <select
              className="input"
              value={waiterFilter}
              onChange={(e) => setWaiterFilter(e.target.value)}
            >
              <option value="">All waiters</option>
              {waiters.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="label">Cashier</label>
            <select
              className="input"
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
            >
              <option value="">All cashiers</option>
              {cashiers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "2 1 180px" }}>
            <label className="label">Search</label>
            <input
              className="input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FT, table, sender, receiver…"
            />
          </div>
          <button className="btn btn-primary" onClick={load}>
            Apply Filters
          </button>
        </div>

        <div className="card table-wrap">
          {loading ? (
            <p style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No transactions found
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Table</th>
                  <th>Waiter</th>
                  <th>FT Number</th>
                  <th>Total</th>
                  <th>Restaurant</th>
                  <th>Cafe</th>
                  <th>Butchery</th>
                  <th>Tip</th>
                  <th>Cashier</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const extra = t as { tableNumber?: string; waiterName?: string };
                  return (
                    <tr
                      key={t.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedTx(t)}
                    >
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                        <br />
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {new Date(t.createdAt).toLocaleTimeString()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {extra.tableNumber || "—"}
                      </td>
                      <td>{extra.waiterName || "—"}</td>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>
                        {t.ftNumber}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {t.totalAmount.toLocaleString()}
                      </td>
                      <td>{t.restaurantAmount.toLocaleString()}</td>
                      <td>{t.cafeAmount.toLocaleString()}</td>
                      <td>{t.butcheryAmount.toLocaleString()}</td>
                      <td>{t.tip.toLocaleString()}</td>
                      <td>{t.cashierName}</td>
                      <td>{t.senderName || "—"}</td>
                      <td>{t.receiverName || "—"}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                          disabled={deletingId === t.id}
                          onClick={(e) => handleDelete(t.id, e)}
                        >
                          {deletingId === t.id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              className="card"
              style={{ maxWidth: 480, width: "100%", padding: "1.5rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>
                Transaction Detail
              </h2>
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
                    [
                      "Table",
                      (selectedTx as { tableNumber?: string }).tableNumber || "—",
                    ],
                    [
                      "Waiter",
                      (selectedTx as { waiterName?: string }).waiterName || "—",
                    ],
                    ["FT Number", selectedTx.ftNumber],
                    [
                      "Total",
                      `${selectedTx.totalAmount.toLocaleString()} ETB`,
                    ],
                    [
                      "Restaurant",
                      `${selectedTx.restaurantAmount.toLocaleString()} ETB`,
                    ],
                    [
                      "Cafe",
                      `${selectedTx.cafeAmount.toLocaleString()} ETB`,
                    ],
                    [
                      "Butchery",
                      `${selectedTx.butcheryAmount.toLocaleString()} ETB`,
                    ],
                    ["Tip", `${selectedTx.tip.toLocaleString()} ETB`],
                    ["Cashier", selectedTx.cashierName],
                    ["Sender", selectedTx.senderName || "—"],
                    ["Receiver", selectedTx.receiverName || "—"],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  disabled={deletingId === selectedTx.id}
                  onClick={() => handleDelete(selectedTx.id)}
                >
                  {deletingId === selectedTx.id ? "Deleting…" : "Delete transaction"}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedTx(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
