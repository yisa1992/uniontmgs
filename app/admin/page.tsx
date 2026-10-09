"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Transaction } from "@/lib/types";

export default function AdminDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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

  // Auth is handled by admin/layout.tsx (same session as /login).
  useEffect(() => {
    load();
  }, [load]);

  async function deleteTx(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    const res = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSelectedTx((prev) => (prev && prev.id === id ? null : prev));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Failed to delete");
    }
  }

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const extra = t as { tableNumber?: string; waiterName?: string };
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
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.6rem", fontWeight: 800, color: "#f8fafc" }}>
          Admin Dashboard
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.25rem", fontSize: "0.95rem" }}>
          User registration &amp; cashier reports (Table · Restaurant · Cafe · Butchery · Tip)
        </p>

        {/* User registration shortcuts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <Link
            href="/admin/users"
            style={{
              textDecoration: "none",
              padding: "1.2rem 1.35rem",
              borderRadius: 14,
              background: "linear-gradient(135deg, #0f766e, #14b8a6)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(20,184,166,0.25)",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>👥</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", marginTop: 6 }}>User Registration</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.9, marginTop: 4 }}>View &amp; manage all users</div>
          </Link>
          <Link
            href="/admin/users/new"
            style={{
              textDecoration: "none",
              padding: "1.2rem 1.35rem",
              borderRadius: 14,
              background: "linear-gradient(135deg, #1e3a5f, #1e40af)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(30,64,175,0.25)",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>➕</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", marginTop: 6 }}>Register New User</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.9, marginTop: 4 }}>Add cashier or staff</div>
          </Link>
        </div>

        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc" }}>
          Cashier Transaction Report
        </h2>

        {/* Summary: Restaurant, Cafe, Butchery, Tip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "Transactions", value: String(totals.count), color: "#93c5fd" },
            { label: "Total Amount", value: `${totals.total.toLocaleString()} ETB`, color: "#6ee7b7" },
            { label: "Restaurant", value: `${totals.restaurant.toLocaleString()} ETB`, color: "#c4b5fd" },
            { label: "Cafe", value: `${totals.cafe.toLocaleString()} ETB`, color: "#fcd34d" },
            { label: "Butchery", value: `${totals.butchery.toLocaleString()} ETB`, color: "#fca5a5" },
            { label: "Tip", value: `${totals.tip.toLocaleString()} ETB`, color: "#67e8f9" },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                padding: "1rem 1.1rem",
                borderRadius: 12,
                background: "#0f172a",
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: c.color,
                  marginTop: "0.3rem",
                }}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
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
          <div style={{ flex: "1 1 140px" }}>
            <label className="label">From Date</label>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="label">To Date</label>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={{ flex: "2 1 200px" }}>
            <label className="label">Search</label>
            <input
              className="input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FT, cashier, sender, receiver…"
            />
          </div>
          <button className="btn btn-primary" onClick={load}>
            Apply Filters
          </button>
        </div>

        {/* Table */}
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
                  <th>Date</th>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
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
                    <td style={{ fontWeight: 700 }}>{(t as { tableNumber?: string }).tableNumber || "—"}</td>
                    <td>{(t as { waiterName?: string }).waiterName || "—"}</td>
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
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--danger)", borderColor: "var(--danger)" }}
                        onClick={(e) => deleteTx(t.id, e)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail modal */}
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
              style={{
                maxWidth: 520,
                width: "100%",
                padding: "1.5rem",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem" }}>
                Transaction Detail
              </h2>
              <table style={{ width: "100%", fontSize: "0.9rem" }}>
                <tbody>
                  {[
                    ["Table Number", (selectedTx as { tableNumber?: string }).tableNumber || "—"],
                    ["Waiter", (selectedTx as { waiterName?: string }).waiterName || "—"],
                    ["FT Number", selectedTx.ftNumber],
                    ["Total Amount", `${selectedTx.totalAmount.toLocaleString()} ETB`],
                    ["Restaurant", `${selectedTx.restaurantAmount.toLocaleString()} ETB`],
                    ["Cafe", `${selectedTx.cafeAmount.toLocaleString()} ETB`],
                    ["Butchery", `${selectedTx.butcheryAmount.toLocaleString()} ETB`],
                    ["Tip", `${selectedTx.tip.toLocaleString()} ETB`],
                    ["Sender", selectedTx.senderName || "—"],
                    ["Receiver", selectedTx.receiverName || "—"],
                    ["Cashier", selectedTx.cashierName],
                    ["Date", new Date(selectedTx.createdAt).toLocaleString()],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td
                        style={{
                          padding: "0.5rem 0",
                          color: "var(--muted)",
                          fontWeight: 600,
                          width: "40%",
                        }}
                      >
                        {label}
                      </td>
                      <td style={{ padding: "0.5rem 0" }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedTx.imageData && (
                <div style={{ marginTop: "1rem" }}>
                  <img
                    src={selectedTx.imageData}
                    alt="Receipt"
                    style={{
                      maxWidth: "100%",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                </div>
              )}
              <button
                className="btn btn-outline"
                style={{ marginTop: "1.25rem", width: "100%" }}
                onClick={() => setSelectedTx(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
