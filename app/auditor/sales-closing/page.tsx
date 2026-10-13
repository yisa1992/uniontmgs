"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Transaction } from "@/lib/types";

type Section = "restaurant" | "cafe" | "butchery" | null;

type UnpaidRow = {
  id: string;
  name: string;
  amount: string;
  phone: string;
};

type ClosedSaleRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  department: "restaurant" | "cafe" | "butchery";
  departmentLabel: string;
  cashierId: string;
  cashierName: string;
  departmentTotal: number;
  cashierDeptTotal: number;
  cashierTipTotal: number;
  unpaidSum: number;
  unpaidRows: { name: string; amount: number; phone: string }[];
  zReport: number;
  balance: number;
  closedAt: string;
  closedBy?: string;
};

const STORAGE_KEY = "union_tms_closed_sales";

const sections: {
  id: NonNullable<Section>;
  label: string;
  icon: string;
  color: string;
  description: string;
  amountKey: "restaurantAmount" | "cafeAmount" | "butcheryAmount";
}[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    color: "#0ea5e9",
    description: "Close restaurant sales for the day",
    amountKey: "restaurantAmount",
  },
  {
    id: "cafe",
    label: "Cafe",
    icon: "☕",
    color: "#8b5cf6",
    description: "Close cafe sales for the day",
    amountKey: "cafeAmount",
  },
  {
    id: "butchery",
    label: "Butchery",
    icon: "🥩",
    color: "#f59e0b",
    description: "Close butchery sales for the day",
    amountKey: "butcheryAmount",
  },
];

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(iso: string, day: string) {
  if (!iso) return false;
  // createdAt may be full ISO datetime
  return iso.slice(0, 10) === day;
}

function loadClosedSales(): ClosedSaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClosedSales(records: ClosedSaleRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function SalesClosingPage() {
  const [active, setActive] = useState<Section>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [zReport, setZReport] = useState("");
  const [showUnpaid, setShowUnpaid] = useState(false);
  const [unpaidRows, setUnpaidRows] = useState<UnpaidRow[]>([
    { id: newId(), name: "", amount: "", phone: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Closed sales report panel
  const [showReport, setShowReport] = useState(false);
  const [reportDate, setReportDate] = useState(todayISO());
  const [closedRecords, setClosedRecords] = useState<ClosedSaleRecord[]>([]);

  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?from=${today}&to=${today}`);
      if (res.ok) {
        const d = await res.json();
        // Extra client-side filter for safety
        const txs = (d.transactions || []).filter((t: Transaction) =>
          isSameDay(t.createdAt, today)
        );
        setTransactions(txs);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (active) {
      load();
      setSelectedCashier("");
      setZReport("");
      setShowUnpaid(false);
      setUnpaidRows([{ id: newId(), name: "", amount: "", phone: "" }]);
      setSubmitMsg(null);
    }
  }, [active, load]);

  useEffect(() => {
    setClosedRecords(loadClosedSales());
  }, [showReport]);

  const sectionMeta = sections.find((s) => s.id === active);

  const cashiers = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of transactions) {
      if (t.cashierId && t.cashierName) {
        map.set(t.cashierId, t.cashierName);
      } else if (t.cashierName) {
        map.set(t.cashierName, t.cashierName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const departmentTotal = useMemo(() => {
    if (!sectionMeta) return 0;
    return transactions.reduce(
      (sum, t) => sum + (Number(t[sectionMeta.amountKey]) || 0),
      0
    );
  }, [transactions, sectionMeta]);

  const cashierTxs = useMemo(() => {
    if (!selectedCashier) return [];
    return transactions.filter(
      (t) => t.cashierId === selectedCashier || t.cashierName === selectedCashier
    );
  }, [transactions, selectedCashier]);

  const cashierDeptTotal = useMemo(() => {
    if (!sectionMeta) return 0;
    return cashierTxs.reduce(
      (sum, t) => sum + (Number(t[sectionMeta.amountKey]) || 0),
      0
    );
  }, [cashierTxs, sectionMeta]);

  const cashierTipTotal = useMemo(() => {
    return cashierTxs.reduce((sum, t) => sum + (Number(t.tip) || 0), 0);
  }, [cashierTxs]);

  const unpaidSum = useMemo(() => {
    return unpaidRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [unpaidRows]);

  const zValue = parseFloat(zReport) || 0;

  const balance = useMemo(() => {
    return zValue - (cashierDeptTotal + cashierTipTotal + unpaidSum);
  }, [zValue, cashierDeptTotal, cashierTipTotal, unpaidSum]);

  const selectedCashierName =
    cashiers.find((c) => c.id === selectedCashier)?.name || selectedCashier;

  const canSubmit =
    !!selectedCashier &&
    zReport !== "" &&
    !Number.isNaN(zValue) &&
    !submitting;

  function addUnpaidRow() {
    setUnpaidRows((prev) => [
      ...prev,
      { id: newId(), name: "", amount: "", phone: "" },
    ]);
  }

  function updateUnpaid(id: string, field: keyof UnpaidRow, value: string) {
    setUnpaidRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function removeUnpaid(id: string) {
    setUnpaidRows((prev) => {
      if (prev.length <= 1) {
        return [{ id: newId(), name: "", amount: "", phone: "" }];
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  function handleSubmit() {
    if (!sectionMeta || !selectedCashier) return;
    setSubmitting(true);
    setSubmitMsg(null);

    try {
      const record: ClosedSaleRecord = {
        id: newId(),
        date: today,
        department: sectionMeta.id,
        departmentLabel: sectionMeta.label,
        cashierId: selectedCashier,
        cashierName: selectedCashierName,
        departmentTotal,
        cashierDeptTotal,
        cashierTipTotal,
        unpaidSum,
        unpaidRows: unpaidRows
          .filter((r) => r.name.trim() || parseFloat(r.amount) > 0)
          .map((r) => ({
            name: r.name.trim(),
            amount: parseFloat(r.amount) || 0,
            phone: r.phone.trim(),
          })),
        zReport: zValue,
        balance,
        closedAt: new Date().toISOString(),
      };

      const existing = loadClosedSales();
      // Replace same day + department + cashier if already closed
      const filtered = existing.filter(
        (r) =>
          !(
            r.date === record.date &&
            r.department === record.department &&
            r.cashierId === record.cashierId
          )
      );
      filtered.push(record);
      saveClosedSales(filtered);
      setClosedRecords(filtered);

      setSubmitMsg({
        type: "ok",
        text: `Sales closed successfully for ${sectionMeta.label} · ${selectedCashierName} · ${today}`,
      });
    } catch {
      setSubmitMsg({ type: "err", text: "Failed to save closed sale. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const reportFiltered = useMemo(() => {
    return closedRecords
      .filter((r) => r.date === reportDate)
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  }, [closedRecords, reportDate]);

  const reportDayTotals = useMemo(() => {
    return reportFiltered.reduce(
      (acc, r) => ({
        cashierDept: acc.cashierDept + r.cashierDeptTotal,
        tips: acc.tips + r.cashierTipTotal,
        unpaid: acc.unpaid + r.unpaidSum,
        z: acc.z + r.zReport,
        balance: acc.balance + r.balance,
      }),
      { cashierDept: 0, tips: 0, unpaid: 0, z: 0, balance: 0 }
    );
  }, [reportFiltered]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header with Closed Sales Report button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sales Closing</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
            Closing for <strong>today</strong> only — {today}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowReport(true);
            setReportDate(today);
            setClosedRecords(loadClosedSales());
          }}
          style={{
            background: "linear-gradient(135deg, #0f766e, #0d9488)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(15,118,110,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          📊 Closed Sales Report
        </button>
      </div>

      {/* Department buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(isActive ? null : s.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                padding: "1.75rem 1.25rem",
                borderRadius: 16,
                border: isActive ? `2px solid ${s.color}` : "2px solid #e2e8f0",
                background: isActive
                  ? `linear-gradient(160deg, ${s.color}12, #fff)`
                  : "#fff",
                boxShadow: isActive
                  ? `0 8px 28px ${s.color}33`
                  : "0 2px 12px rgba(15,23,42,0.06)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: isActive ? s.color : `${s.color}18`,
                  color: isActive ? "#fff" : s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {s.icon}
              </span>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    color: "#0f172a",
                    marginBottom: 4,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{s.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active department closing form */}
      {active && sectionMeta && (
        <div
          className="card"
          style={{
            marginTop: "1.75rem",
            padding: "1.5rem",
            borderTop: `4px solid ${sectionMeta.color}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 0.35rem",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>{sectionMeta.icon}</span>
            {sectionMeta.label} — Sales Closing
          </h2>
          <p style={{ margin: "0 0 1.25rem", fontSize: 13, color: "#64748b" }}>
            Data limited to <strong>{today}</strong>
          </p>

          {loading ? (
            <p style={{ color: "var(--muted)" }}>Loading today&apos;s transactions…</p>
          ) : (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>
                  Total {sectionMeta.label} today (all cashiers)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${fmt(departmentTotal)} ETB`}
                  style={{
                    ...inputStyle,
                    fontWeight: 800,
                    fontSize: 18,
                    background: "#f8fafc",
                    color: "#0f172a",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Select Cashier</label>
                <select
                  value={selectedCashier}
                  onChange={(e) => {
                    setSelectedCashier(e.target.value);
                    setSubmitMsg(null);
                  }}
                  style={inputStyle}
                >
                  <option value="">— Select cashier —</option>
                  {cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {cashiers.length === 0 && (
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0" }}>
                    No cashier transactions found for today.
                  </p>
                )}
              </div>

              {selectedCashier && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      background: "#f0f9ff",
                      borderRadius: 12,
                      padding: "1rem",
                      border: "1px solid #bae6fd",
                    }}
                  >
                    <div style={{ ...labelStyle, marginBottom: 4 }}>
                      Cashier {sectionMeta.label} Total
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.35rem", color: "#0369a1" }}>
                      {fmt(cashierDeptTotal)} ETB
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {cashierTxs.length} transaction{cashierTxs.length !== 1 ? "s" : ""} today
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#fefce8",
                      borderRadius: 12,
                      padding: "1rem",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <div style={{ ...labelStyle, marginBottom: 4 }}>
                      Tips (selected cashier)
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.35rem", color: "#a16207" }}>
                      {fmt(cashierTipTotal)} ETB
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Sum of all tips encoded by this cashier today
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "1.25rem" }}>
                <button
                  type="button"
                  onClick={() => setShowUnpaid((v) => !v)}
                  style={{
                    background: showUnpaid ? "#fef2f2" : "#fff",
                    border: showUnpaid ? "2px solid #ef4444" : "2px solid #e2e8f0",
                    color: showUnpaid ? "#b91c1c" : "#334155",
                    borderRadius: 12,
                    padding: "10px 18px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {showUnpaid ? "Hide Unpaid" : "Unpaid Bills"}
                </button>

                {showUnpaid && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 14,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                borderBottom: "2px solid #e2e8f0",
                                fontSize: 11,
                                textTransform: "uppercase",
                                color: "#64748b",
                              }}
                            >
                              Name
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                borderBottom: "2px solid #e2e8f0",
                                fontSize: 11,
                                textTransform: "uppercase",
                                color: "#64748b",
                              }}
                            >
                              Bill Amount
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                borderBottom: "2px solid #e2e8f0",
                                fontSize: 11,
                                textTransform: "uppercase",
                                color: "#64748b",
                              }}
                            >
                              Phone
                            </th>
                            <th style={{ width: 48, borderBottom: "2px solid #e2e8f0" }} />
                          </tr>
                        </thead>
                        <tbody>
                          {unpaidRows.map((row) => (
                            <tr key={row.id}>
                              <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                <input
                                  type="text"
                                  placeholder="Customer name"
                                  value={row.name}
                                  onChange={(e) =>
                                    updateUnpaid(row.id, "name", e.target.value)
                                  }
                                  style={inputStyle}
                                />
                              </td>
                              <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                  value={row.amount}
                                  onChange={(e) =>
                                    updateUnpaid(row.id, "amount", e.target.value)
                                  }
                                  style={inputStyle}
                                />
                              </td>
                              <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                <input
                                  type="tel"
                                  placeholder="Phone number"
                                  value={row.phone}
                                  onChange={(e) =>
                                    updateUnpaid(row.id, "phone", e.target.value)
                                  }
                                  style={inputStyle}
                                />
                              </td>
                              <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9" }}>
                                <button
                                  type="button"
                                  onClick={() => removeUnpaid(row.id)}
                                  aria-label="Remove row"
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    fontSize: 18,
                                    padding: 4,
                                  }}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                padding: "12px",
                                fontWeight: 800,
                                borderTop: "2px solid #e2e8f0",
                              }}
                            >
                              Sum of Unpaid
                            </td>
                            <td
                              colSpan={2}
                              style={{
                                padding: "12px",
                                fontWeight: 800,
                                fontSize: 16,
                                color: "#b91c1c",
                                borderTop: "2px solid #e2e8f0",
                              }}
                            >
                              {fmt(unpaidSum)} ETB
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={addUnpaidRow}
                      style={{
                        marginTop: 10,
                        background: "#fff",
                        border: "1px dashed #94a3b8",
                        borderRadius: 10,
                        padding: "8px 14px",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      + Add unpaid row
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Z Report Amount</label>
                <input
                  type="number"
                  placeholder="Enter Z report total…"
                  min="0"
                  step="0.01"
                  value={zReport}
                  onChange={(e) => {
                    setZReport(e.target.value);
                    setSubmitMsg(null);
                  }}
                  style={{
                    ...inputStyle,
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                />
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #ecfdf5 0%, #e0f2fe 100%)",
                  borderRadius: 14,
                  padding: "1.25rem 1.5rem",
                  border: "1px solid #99f6e4",
                  marginBottom: "1.25rem",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0f766e",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 12,
                  }}
                >
                  Balance Calculation
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    fontSize: 14,
                    color: "#334155",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Z Report</span>
                    <strong>{fmt(zValue)} ETB</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>
                      − Cashier {sectionMeta.label} total
                      {!selectedCashier && " (select cashier)"}
                    </span>
                    <strong>{fmt(cashierDeptTotal)} ETB</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>− Tips (selected cashier)</span>
                    <strong>{fmt(cashierTipTotal)} ETB</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>− Unpaid sum</span>
                    <strong>{fmt(unpaidSum)} ETB</strong>
                  </div>
                  <div
                    style={{
                      borderTop: "2px solid #0f766e",
                      marginTop: 6,
                      paddingTop: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15 }}>Balance</span>
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: "1.4rem",
                        color:
                          balance === 0
                            ? "#059669"
                            : balance > 0
                              ? "#0369a1"
                              : "#dc2626",
                      }}
                    >
                      {fmt(balance)} ETB
                    </span>
                  </div>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
                  Balance = Z Report − (Cashier {sectionMeta.label} + Tips + Unpaid)
                </p>
              </div>

              {/* Submit */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    borderRadius: 12,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    background: canSubmit
                      ? `linear-gradient(135deg, ${sectionMeta.color}, #0f766e)`
                      : "#cbd5e1",
                    color: "#fff",
                    boxShadow: canSubmit
                      ? `0 6px 20px ${sectionMeta.color}55`
                      : "none",
                    opacity: canSubmit ? 1 : 0.7,
                  }}
                >
                  {submitting ? "Submitting…" : "✓ Submit Closing"}
                </button>
                {!selectedCashier && (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                    Select a cashier and enter Z report to submit
                  </p>
                )}
                {selectedCashier && zReport === "" && (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                    Enter Z report amount to submit
                  </p>
                )}
                {submitMsg && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 14,
                      background: submitMsg.type === "ok" ? "#ecfdf5" : "#fef2f2",
                      color: submitMsg.type === "ok" ? "#065f46" : "#991b1b",
                      border: `1px solid ${submitMsg.type === "ok" ? "#a7f3d0" : "#fecaca"}`,
                    }}
                  >
                    {submitMsg.text}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Closed Sales Report modal */}
      {showReport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "1.5rem",
            overflowY: "auto",
          }}
          onClick={() => setShowReport(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 820,
              marginTop: "2rem",
              marginBottom: "2rem",
              padding: "1.5rem",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Closed Sales Report</h2>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Select date</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                style={{ ...inputStyle, maxWidth: 220 }}
              />
            </div>

            {reportFiltered.length === 0 ? (
              <div
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "#f8fafc",
                  borderRadius: 12,
                }}
              >
                No closed sales for {reportDate}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 10,
                    marginBottom: "1.25rem",
                  }}
                >
                  {[
                    { label: "Closings", value: String(reportFiltered.length) },
                    { label: "Dept totals", value: `${fmt(reportDayTotals.cashierDept)}` },
                    { label: "Tips", value: `${fmt(reportDayTotals.tips)}` },
                    { label: "Unpaid", value: `${fmt(reportDayTotals.unpaid)}` },
                    { label: "Z Report sum", value: `${fmt(reportDayTotals.z)}` },
                    { label: "Balance sum", value: `${fmt(reportDayTotals.balance)}` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: "#f8fafc",
                        borderRadius: 10,
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f0fdfa" }}>
                        {[
                          "Department",
                          "Cashier",
                          "Dept total",
                          "Tips",
                          "Unpaid",
                          "Z Report",
                          "Balance",
                          "Closed at",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "2px solid #99f6e4",
                              fontSize: 11,
                              textTransform: "uppercase",
                              color: "#0f766e",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportFiltered.map((r) => (
                        <tr key={r.id}>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", fontWeight: 600 }}>
                            {r.departmentLabel}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>
                            {r.cashierName}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>
                            {fmt(r.cashierDeptTotal)}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>
                            {fmt(r.cashierTipTotal)}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>
                            {fmt(r.unpaidSum)}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>
                            {fmt(r.zReport)}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #e2e8f0",
                              fontWeight: 800,
                              color:
                                r.balance === 0
                                  ? "#059669"
                                  : r.balance > 0
                                    ? "#0369a1"
                                    : "#dc2626",
                            }}
                          >
                            {fmt(r.balance)}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #e2e8f0",
                              whiteSpace: "nowrap",
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {new Date(r.closedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Unpaid detail for the day */}
                {reportFiltered.some((r) => r.unpaidRows?.length > 0) && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h3 style={{ margin: "0 0 0.75rem", fontSize: 15 }}>Unpaid bills on this date</h3>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#fef2f2" }}>
                          {["Cashier", "Name", "Amount", "Phone"].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: "8px 10px",
                                borderBottom: "2px solid #fecaca",
                                fontSize: 11,
                                textTransform: "uppercase",
                                color: "#991b1b",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportFiltered.flatMap((r) =>
                          (r.unpaidRows || []).map((u, i) => (
                            <tr key={`${r.id}-${i}`}>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #fee2e2" }}>
                                {r.cashierName}
                              </td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #fee2e2" }}>
                                {u.name || "—"}
                              </td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #fee2e2" }}>
                                {fmt(u.amount)}
                              </td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #fee2e2" }}>
                                {u.phone || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
