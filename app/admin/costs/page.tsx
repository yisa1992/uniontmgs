"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CostRecord = {
  id: string;
  date: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  cashierId: string;
  cashierName: string;
  note?: string;
  createdAt: string;
};

type FilterMode = "day" | "week" | "month" | "range";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function startOfWeekISO(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

function endOfWeekISO(d = new Date()) {
  const start = startOfWeekISO(d);
  const [y, m, day] = start.split("-").map(Number);
  const sun = new Date(y, m - 1, day + 6);
  return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
}

function monthStartISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndISO(d = new Date()) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export default function AdminCostsReportPage() {
  const [mode, setMode] = useState<FilterMode>("day");
  const [day, setDay] = useState(todayISO());
  const [from, setFrom] = useState(startOfWeekISO());
  const [to, setTo] = useState(endOfWeekISO());
  const [month, setMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    if (mode === "day") return `date=${encodeURIComponent(day)}`;
    if (mode === "week") {
      return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(y, m, 0);
      const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
      return `from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
    }
    return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }, [mode, day, from, to, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/costs?${queryParams}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load costs");
        setCosts([]);
        setTotal(0);
      } else {
        setCosts(data.costs || []);
        setTotal(Number(data.total) || 0);
      }
    } catch {
      setError("Failed to load costs");
      setCosts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode === "week") {
      setFrom(startOfWeekISO());
      setTo(endOfWeekISO());
    }
    if (mode === "month") {
      setMonth(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
      );
    }
  }, [mode]);

  const byCashier = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of costs) {
      const key = c.cashierName || c.cashierId || "Unknown";
      map.set(key, (map.get(key) || 0) + (Number(c.total) || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [costs]);

  const modes: { id: FilterMode; label: string }[] = [
    { id: "day", label: "By date" },
    { id: "week", label: "By week" },
    { id: "month", label: "By month" },
    { id: "range", label: "Date range" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem", fontWeight: 800 }}>
          Costs Report
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Daily purchase costs entered by cashiers. Filter by day, week, month, or custom range.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: mode === m.id ? "1px solid #ea580c" : "1px solid #e2e8f0",
              background: mode === m.id ? "#fff7ed" : "#fff",
              color: mode === m.id ? "#9a3412" : "#475569",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: "1.25rem",
          padding: "1rem",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
        }}
      >
        {mode === "day" && (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
              Date
            </label>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
        )}
        {mode === "week" && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                Week start
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                Week end
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                }}
              />
            </div>
          </>
        )}
        {mode === "month" && (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
              Month
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
        )}
        {mode === "range" && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                }}
              />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={load}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #ea580c, #f97316)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: "1.25rem",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
            border: "1px solid #fed7aa",
            borderRadius: 14,
            padding: "1rem 1.15rem",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", textTransform: "uppercase" }}>
            Total costs
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#c2410c", marginTop: 4 }}>
            {fmt(total)} ETB
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "1rem 1.15rem",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Line items
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
            {costs.length}
          </div>
        </div>
      </div>

      {byCashier.length > 0 && (
        <div
          style={{
            marginBottom: "1.25rem",
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            padding: "1rem",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 14 }}>By cashier</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {byCashier.map(([name, sum]) => (
              <div
                key={name}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <strong>{name}</strong>: {fmt(sum)} ETB
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

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
              <tr style={{ background: "#fff7ed" }}>
                {["Date", "Item", "Unit price", "Qty", "Total", "Cashier", "Note"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Unit price" || h === "Qty" || h === "Total" ? "right" : "left",
                      padding: "12px 10px",
                      borderBottom: "2px solid #fed7aa",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "#9a3412",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                    Loading…
                  </td>
                </tr>
              ) : costs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                    No costs for this period
                  </td>
                </tr>
              ) : (
                costs.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>{c.date}</td>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0", fontWeight: 600 }}>
                      {c.name}
                    </td>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                      {fmt(c.unitPrice)}
                    </td>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                      {c.quantity}
                    </td>
                    <td
                      style={{
                        padding: "12px 10px",
                        borderBottom: "1px solid #e2e8f0",
                        textAlign: "right",
                        fontWeight: 800,
                        color: "#c2410c",
                      }}
                    >
                      {fmt(c.total)}
                    </td>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0" }}>
                      {c.cashierName || "—"}
                    </td>
                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12 }}>
                      {c.note || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && costs.length > 0 && (
              <tfoot>
                <tr style={{ background: "#fff7ed" }}>
                  <td colSpan={4} style={{ padding: 14, fontWeight: 800, borderTop: "2px solid #fed7aa" }}>
                    Total
                  </td>
                  <td
                    style={{
                      padding: 14,
                      fontWeight: 900,
                      color: "#c2410c",
                      borderTop: "2px solid #fed7aa",
                      textAlign: "right",
                    }}
                  >
                    {fmt(total)} ETB
                  </td>
                  <td colSpan={2} style={{ borderTop: "2px solid #fed7aa" }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
