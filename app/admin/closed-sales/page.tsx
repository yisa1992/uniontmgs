"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UnpaidRow = { name: string; amount: number; phone: string };

type ClosedSaleRecord = {
  id: string;
  date: string;
  department: "restaurant" | "cafe" | "butchery";
  departmentLabel: string;
  cashierId: string;
  cashierName: string;
  departmentTotal: number;
  cashierDeptTotal: number;
  cashierTipTotal: number;
  unpaidSum: number;
  unpaidRows: UnpaidRow[];
  zReport: number;
  balance: number;
  closedAt: string;
  closedBy?: string;
  shortageReason?: string;
  responsiblePerson?: string;
};

type EditForm = {
  id: string;
  departmentLabel: string;
  cashierName: string;
  date: string;
  departmentTotal: string;
  cashierDeptTotal: string;
  cashierTipTotal: string;
  zReport: string;
  unpaidRows: { id: string; name: string; amount: string; phone: string }[];
  shortageReason: string;
  responsiblePerson: string;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function newRowId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AdminClosedSalesPage() {
  const [records, setRecords] = useState<ClosedSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(todayISO());
  const [unpaidDetail, setUnpaidDetail] = useState<ClosedSaleRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/closed-sales?date=${encodeURIComponent(reportDate)}`);
      if (res.ok) {
        const d = await res.json();
        setRecords(d.records || []);
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => ({
        dept: acc.dept + (r.departmentTotal || 0),
        tips: acc.tips + (r.cashierTipTotal || 0),
        unpaid: acc.unpaid + (r.unpaidSum || 0),
        z: acc.z + (r.zReport || 0),
        balance: acc.balance + (r.balance || 0),
      }),
      { dept: 0, tips: 0, unpaid: 0, z: 0, balance: 0 }
    );
  }, [records]);

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
  };

  function openEdit(r: ClosedSaleRecord) {
    setEditMsg(null);
    setEditForm({
      id: r.id,
      departmentLabel: r.departmentLabel,
      cashierName: r.cashierName,
      date: r.date,
      departmentTotal: String(r.departmentTotal ?? 0),
      cashierDeptTotal: String(r.cashierDeptTotal ?? 0),
      cashierTipTotal: String(r.cashierTipTotal ?? 0),
      zReport: String(r.zReport ?? 0),
      unpaidRows:
        r.unpaidRows && r.unpaidRows.length > 0
          ? r.unpaidRows.map((u) => ({
              id: newRowId(),
              name: u.name || "",
              amount: String(u.amount ?? ""),
              phone: u.phone || "",
            }))
          : [{ id: newRowId(), name: "", amount: "", phone: "" }],
      shortageReason: r.shortageReason || "",
      responsiblePerson: r.responsiblePerson || "",
    });
  }

  const editUnpaidSum = useMemo(() => {
    if (!editForm) return 0;
    return editForm.unpaidRows.reduce(
      (s, r) => s + (parseFloat(r.amount) || 0),
      0
    );
  }, [editForm]);

  const editBalance = useMemo(() => {
    if (!editForm) return 0;
    const dept = parseFloat(editForm.departmentTotal) || 0;
    const tips = parseFloat(editForm.cashierTipTotal) || 0;
    const z = parseFloat(editForm.zReport) || 0;
    return dept + tips + editUnpaidSum - z;
  }, [editForm, editUnpaidSum]);

  async function saveEdit() {
    if (!editForm) return;
    setSaving(true);
    setEditMsg(null);

    const departmentTotal = parseFloat(editForm.departmentTotal) || 0;
    const cashierDeptTotal = parseFloat(editForm.cashierDeptTotal) || 0;
    const cashierTipTotal = parseFloat(editForm.cashierTipTotal) || 0;
    const zReport = parseFloat(editForm.zReport) || 0;
    const unpaidRows = editForm.unpaidRows
      .filter((r) => r.name.trim() || parseFloat(r.amount) > 0)
      .map((r) => ({
        name: r.name.trim(),
        amount: parseFloat(r.amount) || 0,
        phone: r.phone.trim(),
      }));
    const unpaidSum = unpaidRows.reduce((s, r) => s + r.amount, 0);
    const balance = departmentTotal + cashierTipTotal + unpaidSum - zReport;

    if (balance < 0) {
      if (!editForm.shortageReason.trim() || !editForm.responsiblePerson.trim()) {
        setEditMsg({
          type: "err",
          text: "Sum is less than Z report (shortage). Reason and responsible person are required.",
        });
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/closed-sales", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          departmentTotal,
          cashierDeptTotal,
          cashierTipTotal,
          unpaidSum,
          unpaidRows,
          zReport,
          balance,
          shortageReason: balance < 0 ? editForm.shortageReason.trim() : undefined,
          responsiblePerson:
            balance < 0 ? editForm.responsiblePerson.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditMsg({
          type: "err",
          text: data.error || "Failed to update closed sale.",
        });
        setSaving(false);
        return;
      }
      setRecords((prev) =>
        prev.map((r) => (r.id === data.record?.id ? data.record : r))
      );
      setEditMsg({ type: "ok", text: "Saved successfully." });
      setTimeout(() => {
        setEditForm(null);
        setEditMsg(null);
      }, 800);
    } catch {
      setEditMsg({ type: "err", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Closed Sales Report</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            View auditor closings by date. Click unpaid amount for bill details.
            Use Edit to change a closing.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
            Date
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            style={{ ...inputStyle, width: "auto" }}
          />
          <button
            type="button"
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : records.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            color: "#64748b",
          }}
        >
          No closed sales for {reportDate}.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: "1.25rem",
            }}
          >
            {[
              { label: "Dept total", value: fmt(totals.dept) },
              { label: "Tips", value: fmt(totals.tips) },
              { label: "Unpaid", value: fmt(totals.unpaid) },
              { label: "Z Report", value: fmt(totals.z) },
              { label: "Balance", value: fmt(totals.balance) },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 11, color: "#0f766e", fontWeight: 700 }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                      "Shortage reason",
                      "Responsible",
                      "Closed at",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "12px 10px",
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
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderBottom: "1px solid #e2e8f0",
                          fontWeight: 600,
                        }}
                      >
                        {r.departmentLabel}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        {r.cashierName}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        {fmt(r.departmentTotal)}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        {fmt(r.cashierTipTotal)}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        {r.unpaidSum > 0 || (r.unpaidRows && r.unpaidRows.length > 0) ? (
                          <button
                            type="button"
                            onClick={() => setUnpaidDetail(r)}
                            title="View unpaid bill details"
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              color: "#b91c1c",
                              fontWeight: 800,
                              fontSize: 13,
                              cursor: "pointer",
                              textDecoration: "underline",
                              textUnderlineOffset: 3,
                            }}
                          >
                            {fmt(r.unpaidSum)}
                          </button>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>{fmt(r.unpaidSum)}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        {fmt(r.zReport)}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
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
                          padding: "12px 10px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          maxWidth: 140,
                        }}
                      >
                        {r.shortageReason || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      >
                        {r.responsiblePerson || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderBottom: "1px solid #e2e8f0",
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {new Date(r.closedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          style={{
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1d4ed8",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Unpaid detail modal */}
      {unpaidDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => setUnpaidDetail(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                Unpaid details — {unpaidDetail.departmentLabel}
              </h2>
              <button
                type="button"
                onClick={() => setUnpaidDetail(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
              Cashier: <strong>{unpaidDetail.cashierName}</strong> · Date:{" "}
              <strong>{unpaidDetail.date}</strong>
            </p>
            {!unpaidDetail.unpaidRows || unpaidDetail.unpaidRows.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>
                No line items. Unpaid sum: {fmt(unpaidDetail.unpaidSum)} ETB
              </p>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #fecaca" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#fef2f2" }}>
                      {["#", "Customer name", "Phone", "Bill amount (ETB)"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Bill amount (ETB)" ? "right" : "left",
                            padding: "12px 14px",
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
                    {unpaidDetail.unpaidRows.map((u, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fffafa" }}>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #fee2e2", color: "#94a3b8" }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #fee2e2", fontWeight: 600 }}>
                          {u.name || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #fee2e2" }}>
                          {u.phone || "—"}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: "1px solid #fee2e2",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#b91c1c",
                          }}
                        >
                          {fmt(Number(u.amount) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#fef2f2" }}>
                      <td colSpan={3} style={{ padding: 14, fontWeight: 800, borderTop: "2px solid #fecaca" }}>
                        Total unpaid
                      </td>
                      <td
                        style={{
                          padding: 14,
                          fontWeight: 900,
                          color: "#b91c1c",
                          borderTop: "2px solid #fecaca",
                          textAlign: "right",
                        }}
                      >
                        {fmt(unpaidDetail.unpaidSum)} ETB
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit sales closing modal */}
      {editForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => !saving && setEditForm(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 560,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Edit sales closing</h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditForm(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>

            <p style={{ margin: "0 0 1.25rem", fontSize: 13, color: "#64748b" }}>
              {editForm.departmentLabel} · {editForm.cashierName} · {editForm.date}
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Department total (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.departmentTotal}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, departmentTotal: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Cashier dept total (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.cashierDeptTotal}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, cashierDeptTotal: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tips (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.cashierTipTotal}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, cashierTipTotal: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Z Report (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.zReport}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, zReport: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  Balance = (Dept total + Tips + Unpaid) − Z Report
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 20,
                    color:
                      editBalance === 0
                        ? "#059669"
                        : editBalance > 0
                          ? "#0369a1"
                          : "#dc2626",
                  }}
                >
                  {fmt(editBalance)} ETB
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Unpaid bills</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm(
                        (f) =>
                          f && {
                            ...f,
                            unpaidRows: [
                              ...f.unpaidRows,
                              { id: newRowId(), name: "", amount: "", phone: "" },
                            ],
                          }
                      )
                    }
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    + Add row
                  </button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {editForm.unpaidRows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 110px 32px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        placeholder="Name"
                        value={row.name}
                        onChange={(e) =>
                          setEditForm(
                            (f) =>
                              f && {
                                ...f,
                                unpaidRows: f.unpaidRows.map((r) =>
                                  r.id === row.id ? { ...r, name: e.target.value } : r
                                ),
                              }
                          )
                        }
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={(e) =>
                          setEditForm(
                            (f) =>
                              f && {
                                ...f,
                                unpaidRows: f.unpaidRows.map((r) =>
                                  r.id === row.id ? { ...r, amount: e.target.value } : r
                                ),
                              }
                          )
                        }
                        style={inputStyle}
                      />
                      <input
                        placeholder="Phone"
                        value={row.phone}
                        onChange={(e) =>
                          setEditForm(
                            (f) =>
                              f && {
                                ...f,
                                unpaidRows: f.unpaidRows.map((r) =>
                                  r.id === row.id ? { ...r, phone: e.target.value } : r
                                ),
                              }
                          )
                        }
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm(
                            (f) =>
                              f && {
                                ...f,
                                unpaidRows:
                                  f.unpaidRows.length <= 1
                                    ? [
                                        {
                                          id: newRowId(),
                                          name: "",
                                          amount: "",
                                          phone: "",
                                        },
                                      ]
                                    : f.unpaidRows.filter((r) => r.id !== row.id),
                              }
                          )
                        }
                        style={{
                          background: "#f1f5f9",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 0",
                          cursor: "pointer",
                          color: "#64748b",
                          fontWeight: 700,
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>
                  Unpaid sum: {fmt(editUnpaidSum)} ETB
                </div>
              </div>

              {editBalance < 0 && (
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: 12,
                    background: "#fef2f2",
                    border: "2px solid #fecaca",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#991b1b", marginBottom: 8 }}>
                    Shortage — reason required
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Reason for shortage</label>
                    <textarea
                      rows={2}
                      value={editForm.shortageReason}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, shortageReason: e.target.value })
                      }
                      style={{ ...inputStyle, resize: "vertical" }}
                      placeholder="Why did the shortage happen?"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Who is responsible</label>
                    <input
                      type="text"
                      value={editForm.responsiblePerson}
                      onChange={(e) =>
                        setEditForm(
                          (f) => f && { ...f, responsiblePerson: e.target.value }
                        )
                      }
                      style={inputStyle}
                      placeholder="Name of the responsible person"
                    />
                  </div>
                </div>
              )}

              {editMsg && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 13,
                    background: editMsg.type === "ok" ? "#ecfdf5" : "#fef2f2",
                    color: editMsg.type === "ok" ? "#065f46" : "#991b1b",
                    border: `1px solid ${editMsg.type === "ok" ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  {editMsg.text}
                </div>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: saving ? "wait" : "pointer",
                  background: saving ? "#94a3b8" : "#1d4ed8",
                  color: "#fff",
                }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
