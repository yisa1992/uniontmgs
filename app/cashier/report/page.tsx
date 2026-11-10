"use client";

import { useEffect, useState, useCallback, type CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SessionUser, Transaction } from "@/lib/types";

type TxExtra = Transaction & {
  tableNumber?: string;
  waiterName?: string;
  waiterId?: string;
  updatedAt?: string;
  updatedBy?: string;
  approvedBy?: string;
};

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

const footerCell: CSSProperties = {
  padding: "14px 10px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
  color: "#0f172a",
  background: "linear-gradient(90deg, #ecfdf5, #e0f2fe)",
  borderTop: "2px solid #0f766e",
};

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function money(n: number) {
  return (n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CashierReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [transactions, setTransactions] = useState<TxExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [tab, setTab] = useState<ReportTab>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit modal
  const [editing, setEditing] = useState<TxExtra | null>(null);
  const [editForm, setEditForm] = useState({
    ftNumber: "",
    totalAmount: "",
    restaurantAmount: "",
    cafeAmount: "",
    butcheryAmount: "",
    tip: "",
    senderName: "",
    receiverName: "",
    tableNumber: "",
    waiterName: "",
  });
  const [auditorUsername, setAuditorUsername] = useState("");
  const [auditorPassword, setAuditorPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

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
          if (d.user.role !== "cashier" && d.user.role !== "admin" && d.user.role !== "auditor") {
            router.push("/");
            return;
          }
          setUser(d.user);
          // Default filter to current cashier when role is cashier (trim for reliable match)
          if (d.user.role === "cashier") {
            setCashierFilter((d.user.fullName || "").trim());
          }
        }
      });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/transactions?today=1");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load transactions");
        setTransactions([]);
        return;
      }
      const d = await res.json();
      setTransactions((d.transactions || []) as TxExtra[]);
    } catch {
      setError("Network error while loading today's transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!user) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [user, load]);

  const cashiers = Array.from(
    new Set(transactions.map((t) => t.cashierName).filter(Boolean))
  ).sort() as string[];

  let filtered = transactions.filter((t) => {
    // Case-insensitive, trimmed name match (also match by cashierId when available)
    if (cashierFilter) {
      const want = cashierFilter.trim().toLowerCase();
      const nameOk = (t.cashierName || "").trim().toLowerCase() === want;
      // Also keep row if this is the logged-in cashier filtering themselves and cashierId matches
      const selfById =
        !!user &&
        user.role === "cashier" &&
        !!t.cashierId &&
        t.cashierId === user.id;
      if (!nameOk && !selfById) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.ftNumber?.toLowerCase().includes(q) ||
      t.cashierName?.toLowerCase().includes(q) ||
      t.senderName?.toLowerCase().includes(q) ||
      t.receiverName?.toLowerCase().includes(q) ||
      (t.tableNumber || "").toLowerCase().includes(q) ||
      (t.waiterName || "").toLowerCase().includes(q)
    );
  });

  if (tab === "restaurant") {
    filtered = filtered.filter((t) => (t.restaurantAmount || 0) > 0);
  } else if (tab === "cafe") {
    filtered = filtered.filter((t) => (t.cafeAmount || 0) > 0);
  } else if (tab === "butchery") {
    filtered = filtered.filter((t) => (t.butcheryAmount || 0) > 0);
  }

  // Newest first
  filtered = [...filtered].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  const totals = filtered.reduce(
    (acc, t) => ({
      total: acc.total + (t.totalAmount || 0),
      restaurant: acc.restaurant + (t.restaurantAmount || 0),
      cafe: acc.cafe + (t.cafeAmount || 0),
      butchery: acc.butchery + (t.butcheryAmount || 0),
      tip: acc.tip + (t.tip || 0),
      count: acc.count + 1,
    }),
    { total: 0, restaurant: 0, cafe: 0, butchery: 0, tip: 0, count: 0 }
  );

  function openEdit(tx: TxExtra) {
    setEditing(tx);
    setEditForm({
      ftNumber: tx.ftNumber || "",
      totalAmount: String(tx.totalAmount ?? ""),
      restaurantAmount: String(tx.restaurantAmount ?? ""),
      cafeAmount: String(tx.cafeAmount ?? ""),
      butcheryAmount: String(tx.butcheryAmount ?? ""),
      tip: String(tx.tip ?? ""),
      senderName: tx.senderName || "",
      receiverName: tx.receiverName || "",
      tableNumber: tx.tableNumber || "",
      waiterName: tx.waiterName || "",
    });
    setAuditorUsername("");
    setAuditorPassword("");
    setEditError("");
  }

  function closeEdit() {
    setEditing(null);
    setEditError("");
    setAuditorPassword("");
  }

  // Keep tip balanced when split amounts change (optional convenience)
  function recomputeTip(next: typeof editForm) {
    const total = parseFloat(next.totalAmount) || 0;
    const r = parseFloat(next.restaurantAmount) || 0;
    const c = parseFloat(next.cafeAmount) || 0;
    const b = parseFloat(next.butcheryAmount) || 0;
    const tip = Math.round((total - r - c - b) * 100) / 100;
    return { ...next, tip: tip >= 0 ? String(tip) : "0" };
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError("");
    setSuccess("");

    const r = parseFloat(editForm.restaurantAmount) || 0;
    const c = parseFloat(editForm.cafeAmount) || 0;
    const b = parseFloat(editForm.butcheryAmount) || 0;
    const t = parseFloat(editForm.tip) || 0;
    const total = parseFloat(editForm.totalAmount) || 0;

    if (Math.abs(r + c + b + t - total) > 0.01) {
      setEditError(
        `Restaurant + Cafe + Butchery + Tip (${(r + c + b + t).toFixed(2)}) must equal Total (${total.toFixed(2)})`
      );
      setSaving(false);
      return;
    }

    if (!auditorUsername.trim() || !auditorPassword) {
      setEditError("Auditor username and password are required for approval");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          auditorUsername: auditorUsername.trim(),
          auditorPassword,
          ftNumber: editForm.ftNumber,
          totalAmount: total,
          restaurantAmount: r,
          cafeAmount: c,
          butcheryAmount: b,
          tip: t,
          senderName: editForm.senderName,
          receiverName: editForm.receiverName,
          tableNumber: editForm.tableNumber,
          waiterName: editForm.waiterName,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(d.error || "Update failed");
        setSaving(false);
        return;
      }
      setSuccess(`Transaction ${editForm.ftNumber || editing.id} updated (approved by auditor).`);
      closeEdit();
      await load();
    } catch {
      setEditError("Network error — could not save changes");
    } finally {
      setSaving(false);
    }
  }

  const tabMeta: { id: ReportTab; label: string; color: string; emoji: string }[] = [
    { id: "all", label: "All", color: "#0f766e", emoji: "📋" },
    { id: "restaurant", label: "Restaurant", color: "#7c3aed", emoji: "🍽️" },
    { id: "cafe", label: "Cafe", color: "#d97706", emoji: "☕" },
    { id: "butchery", label: "Butchery", color: "#dc2626", emoji: "🥩" },
  ];

  if (!user) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #f0fdf4 40%, #f8fafc 100%)" }}>
      <Navbar user={user} />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #065f46 0%, #047857 40%, #0d9488 100%)",
            borderRadius: 20,
            padding: "1.5rem 1.75rem",
            color: "#fff",
            marginBottom: "1.25rem",
            boxShadow: "0 12px 40px rgba(6, 95, 70, 0.25)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.55rem", fontWeight: 800 }}>
              📊 Today&apos;s Transactions
            </h1>
            <p style={{ margin: 0, opacity: 0.92, fontSize: "0.95rem" }}>
              {todayLabel()} — current day only. Filter by cashier · Restaurant / Cafe / Butchery.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => router.push("/cashier")}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 12,
                padding: "0.65rem 1rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← New Transaction
            </button>
            <button
              type="button"
              onClick={load}
              style={{
                background: "#fff",
                color: "#065f46",
                border: "none",
                borderRadius: 12,
                padding: "0.65rem 1rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem", borderRadius: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1rem", borderRadius: 12 }}>
            {success}
          </div>
        )}

        {/* Filters */}
        <div
          className="card"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.85rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 180px" }}>
            <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>
              Cashier name
            </label>
            <select
              className="input"
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              style={{ borderRadius: 10, padding: "0.65rem 0.85rem", width: "100%" }}
            >
              <option value="">All cashiers</option>
              {cashiers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {user.fullName &&
                !cashiers.some(
                  (c) => c.trim().toLowerCase() === user.fullName.trim().toLowerCase()
                ) && (
                <option value={user.fullName.trim()}>{user.fullName}</option>
              )}
            </select>
          </div>
          <div style={{ flex: "2 1 220px" }}>
            <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>
              Search
            </label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FT, table, waiter, sender…"
              style={{ borderRadius: 10, padding: "0.65rem 0.85rem", width: "100%" }}
            />
          </div>
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
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: active ? `2px solid ${t.color}` : "1px solid #e2e8f0",
                  background: "#fff",
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
            gap: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          {(
            [
              ["TRANSACTIONS", String(totals.count), "#0f172a"],
              ["TOTAL", `${money(totals.total)} ETB`, "#059669"],
              ["RESTAURANT", `${money(totals.restaurant)} ETB`, "#7c3aed"],
              ["CAFE", `${money(totals.cafe)} ETB`, "#d97706"],
              ["BUTCHERY", `${money(totals.butchery)} ETB`, "#dc2626"],
              ["TIPS", `${money(totals.tip)} ETB`, "#0f766e"],
            ] as [string, string, string][]
          ).map(([label, value, color]) => (
            <div
              key={label}
              style={{
                flex: "1 1 140px",
                background: "#fff",
                borderRadius: 14,
                padding: "0.9rem 1rem",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                {label}
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div
          className="card"
          style={{
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
          }}
        >
          {loading && transactions.length === 0 ? (
            <p style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
              No transactions for today
              {cashierFilter ? ` under cashier “${cashierFilter}”` : ""}.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ ...headerCell, textAlign: "left" }}>Time</th>
                    <th style={{ ...headerCell, textAlign: "left" }}>FT / Ref</th>
                    <th style={{ ...headerCell, textAlign: "left" }}>Cashier</th>
                    <th style={{ ...headerCell, textAlign: "left" }}>Table</th>
                    <th style={{ ...headerCell, textAlign: "left" }}>Waiter</th>
                    <th style={{ ...headerCell, textAlign: "right" }}>Restaurant</th>
                    <th style={{ ...headerCell, textAlign: "right" }}>Cafe</th>
                    <th style={{ ...headerCell, textAlign: "right" }}>Butchery</th>
                    <th style={{ ...headerCell, textAlign: "right" }}>Tip</th>
                    <th style={{ ...headerCell, textAlign: "right" }}>Total</th>
                    <th style={{ ...headerCell, textAlign: "center" }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} style={{ background: "#fff" }}>
                      <td style={cell}>{formatTime(t.createdAt)}</td>
                      <td style={{ ...cell, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                        {t.ftNumber || "—"}
                      </td>
                      <td style={cell}>{t.cashierName || "—"}</td>
                      <td style={cell}>{t.tableNumber || "—"}</td>
                      <td style={cell}>{t.waiterName || "—"}</td>
                      <td style={{ ...cell, textAlign: "right", color: "#7c3aed", fontWeight: 600 }}>
                        {money(t.restaurantAmount || 0)}
                      </td>
                      <td style={{ ...cell, textAlign: "right", color: "#d97706", fontWeight: 600 }}>
                        {money(t.cafeAmount || 0)}
                      </td>
                      <td style={{ ...cell, textAlign: "right", color: "#dc2626", fontWeight: 600 }}>
                        {money(t.butcheryAmount || 0)}
                      </td>
                      <td style={{ ...cell, textAlign: "right" }}>{money(t.tip || 0)}</td>
                      <td style={{ ...cell, textAlign: "right", fontWeight: 800 }}>
                        {money(t.totalAmount || 0)}
                      </td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid #0f766e",
                            background: "#ecfdf5",
                            color: "#0f766e",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={footerCell} colSpan={5}>
                      Totals ({totals.count})
                    </td>
                    <td style={{ ...footerCell, textAlign: "right", color: "#7c3aed" }}>
                      {money(totals.restaurant)}
                    </td>
                    <td style={{ ...footerCell, textAlign: "right", color: "#d97706" }}>
                      {money(totals.cafe)}
                    </td>
                    <td style={{ ...footerCell, textAlign: "right", color: "#dc2626" }}>
                      {money(totals.butchery)}
                    </td>
                    <td style={{ ...footerCell, textAlign: "right" }}>{money(totals.tip)}</td>
                    <td style={{ ...footerCell, textAlign: "right" }}>{money(totals.total)}</td>
                    <td style={footerCell} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit modal — requires auditor password */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <form
            onSubmit={saveEdit}
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "92vh",
              overflowY: "auto",
              borderRadius: 18,
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>Edit transaction</h2>
                <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: 13 }}>
                  Changes require auditor approval (username + password).
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                className="alert alert-error"
                style={{ marginTop: "1rem", borderRadius: 10, fontSize: 13 }}
              >
                {editError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.85rem",
                marginTop: "1.15rem",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">FT / Ref</label>
                <input
                  className="input"
                  value={editForm.ftNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, ftNumber: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Table</label>
                <input
                  className="input"
                  value={editForm.tableNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, tableNumber: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Waiter</label>
                <input
                  className="input"
                  value={editForm.waiterName}
                  onChange={(e) => setEditForm((f) => ({ ...f, waiterName: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Restaurant</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.restaurantAmount}
                  onChange={(e) =>
                    setEditForm((f) =>
                      recomputeTip({ ...f, restaurantAmount: e.target.value })
                    )
                  }
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Cafe</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.cafeAmount}
                  onChange={(e) =>
                    setEditForm((f) => recomputeTip({ ...f, cafeAmount: e.target.value }))
                  }
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Butchery</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.butcheryAmount}
                  onChange={(e) =>
                    setEditForm((f) =>
                      recomputeTip({ ...f, butcheryAmount: e.target.value })
                    )
                  }
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Tip</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.tip}
                  onChange={(e) => setEditForm((f) => ({ ...f, tip: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Total amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.totalAmount}
                  onChange={(e) =>
                    setEditForm((f) => recomputeTip({ ...f, totalAmount: e.target.value }))
                  }
                  style={{ borderRadius: 10, width: "100%", fontWeight: 700 }}
                />
              </div>
              <div>
                <label className="label">Sender</label>
                <input
                  className="input"
                  value={editForm.senderName}
                  onChange={(e) => setEditForm((f) => ({ ...f, senderName: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Receiver</label>
                <input
                  className="input"
                  value={editForm.receiverName}
                  onChange={(e) => setEditForm((f) => ({ ...f, receiverName: e.target.value }))}
                  style={{ borderRadius: 10, width: "100%" }}
                />
              </div>
            </div>

            {/* Auditor approval */}
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                borderRadius: 12,
                background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
                border: "1px solid #fdba74",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: "#9a3412", marginBottom: 8 }}>
                🔐 Auditor approval required
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label className="label">Auditor username</label>
                  <input
                    className="input"
                    autoComplete="username"
                    value={auditorUsername}
                    onChange={(e) => setAuditorUsername(e.target.value)}
                    placeholder="auditor login"
                    required
                    style={{ borderRadius: 10, width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label">Auditor password</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={auditorPassword}
                    onChange={(e) => setAuditorPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ borderRadius: 10, width: "100%" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "1.25rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeEdit}
                disabled={saving}
                style={{ borderRadius: 10, padding: "0.7rem 1.1rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{
                  borderRadius: 10,
                  padding: "0.7rem 1.25rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #065f46, #0d9488)",
                  border: "none",
                  color: "#fff",
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save with auditor approval"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
