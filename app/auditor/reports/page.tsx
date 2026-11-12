"use client";

import { useEffect, useState, useCallback } from "react";
import type { Notification, Transaction } from "@/lib/types";

export default function AuditorReportsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  const todayParam = () => {
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
  };

  /** Full load once: notifications + today's transactions (no images) */
  const load = useCallback(async () => {
    try {
      const day = todayParam();
      const [nRes, tRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch(`/api/transactions?from=${day}&to=${day}`),
      ]);
      if (nRes.ok) {
        const d = await nRes.json();
        setNotifications(d.notifications || []);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        setTransactions(d.transactions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  /** Lightweight poll: notifications only (much faster) */
  const pollNotifications = useCallback(async () => {
    try {
      const nRes = await fetch("/api/notifications");
      if (nRes.ok) {
        const d = await nRes.json();
        setNotifications(d.notifications || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll notifications every 15s (not full transactions)
  useEffect(() => {
    const id = setInterval(pollNotifications, 15000);
    return () => clearInterval(id);
  }, [pollNotifications]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function viewTx(transactionId: string) {
    // Show cached light version immediately, then fetch with image if needed
    const cached = transactions.find((t) => t.id === transactionId) || null;
    setSelectedTx(cached);
    try {
      const res = await fetch(
        `/api/transactions?id=${encodeURIComponent(transactionId)}&includeImage=1`
      );
      if (res.ok) {
        const d = await res.json();
        const full = (d.transactions || [])[0];
        if (full) setSelectedTx(full);
      }
    } catch {
      // keep cached
    }
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
            Reports
            {unread > 0 && (
              <span
                style={{
                  marginLeft: "0.75rem",
                  background: "var(--danger)",
                  color: "white",
                  borderRadius: 999,
                  padding: "0.15rem 0.55rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                {unread}
              </span>
            )}
          </h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
            Live feed of every transaction submitted by cashiers
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-outline" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No notifications yet. Waiting for cashier transactions…
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: n.read
                  ? "4px solid var(--border)"
                  : "4px solid var(--primary)",
                background: n.read ? "white" : "#f0f7ff",
                cursor: "pointer",
              }}
              onClick={() => {
                markRead(n.id);
                viewTx(n.transactionId);
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "0.35rem", fontSize: "1.05rem" }}>
                    Table {(n as { tableNumber?: string }).tableNumber || "—"}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {new Date(n.createdAt).toLocaleString()} · Cashier:{" "}
                    {n.cashierName}
                    {(n as { waiterName?: string }).waiterName
                      ? ` · Waiter: ${(n as { waiterName?: string }).waiterName}`
                      : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {n.totalAmount.toLocaleString()} ETB
                  </div>
                  {!n.read && (
                    <span
                      className="badge"
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        marginTop: "0.25rem",
                      }}
                    >
                      New
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction detail modal */}
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
                  ["Table Number", (selectedTx as { tableNumber?: string }).tableNumber || "—"],
                  ["Waiter", (selectedTx as { waiterName?: string }).waiterName || "—"],
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
              ).map(([label, val]) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
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
    </div>
  );
}
