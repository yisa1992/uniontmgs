"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SessionUser, Transaction } from "@/lib/types";

export default function AdminReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) {
          router.push("/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.user) {
          if (d.user.role !== "admin") {
            router.push("/");
            return;
          }
          setUser(d.user);
          load();
        }
      });
  }, [router, load]);

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.ftNumber.toLowerCase().includes(q) ||
      t.cashierName.toLowerCase().includes(q) ||
      t.senderName.toLowerCase().includes(q) ||
      t.receiverName.toLowerCase().includes(q)
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

  if (!user) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <Navbar user={user} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
          Transaction Reports
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          View, filter and analyze all transactions
        </p>

        {/* Summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
                  <th>FT Number</th>
                  <th>Total</th>
                  <th>Restaurant</th>
                  <th>Cafe</th>
                  <th>Butchery</th>
                  <th>Tip</th>
                  <th>Cashier</th>
                  <th>Sender</th>
                  <th>Receiver</th>
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
