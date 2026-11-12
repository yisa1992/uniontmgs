"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CostRow = {
  id: string;
  date: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  cashierId: string;
  cashierName: string;
  createdAt?: string;
};

type Mode = "daily" | "weekly" | "monthly" | "range";

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

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(iso: string) {
  return iso.slice(0, 8) + "01";
}

function endOfMonth(iso: string) {
  const d = new Date(iso.slice(0, 7) + "-01T12:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminCostsReportPage() {
  const searchParams = useSearchParams();
  const modeParam = (searchParams.get("mode") as Mode) || "daily";

  const [mode, setMode] = useState<Mode>(modeParam);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(modeParam);
    const t = todayISO();
    if (modeParam === "daily") {
      setFrom(t);
      setTo(t);
    } else if (modeParam === "weekly") {
      setFrom(startOfWeek(t));
      setTo(t);
    } else if (modeParam === "monthly") {
      setFrom(startOfMonth(t));
      setTo(endOfMonth(t));
    }
  }, [modeParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = "/api/costs?";
      if (mode === "daily") {
        url += `date=${encodeURIComponent(from)}`;
      } else {
        url += `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      }
      const res = await fetch(url);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Failed to load costs");
        setCosts([]);
        return;
      }
      setCosts(d.costs || []);
    } catch {
      setError("Network error loading costs");
      setCosts([]);
    } finally {
      setLoading(false);
    }
  }, [mode, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () => costs.reduce((s, c) => s + (Number(c.total) || 0), 0),
    [costs]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of costs) {
      const d = c.date;
      map.set(d, (map.get(d) || 0) + (Number(c.total) || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [costs]);

  const title =
    mode === "daily"
      ? "Daily costs"
      : mode === "weekly"
        ? "Weekly costs"
        : mode === "monthly"
          ? "Monthly costs"
          : "Costs by date range";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>
            🧾 {title}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            Purchases recorded by cashiers (name × unit price × quantity)
          </p>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#b45309",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: "10px 16px",
          }}
        >
          Total: {fmt(total)} ETB
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        {(["daily", "weekly", "monthly", "range"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              const t = todayISO();
              if (m === "daily") {
                setFrom(t);
                setTo(t);
              } else if (m === "weekly") {
                setFrom(startOfWeek(t));
                setTo(t);
              } else if (m === "monthly") {
                setFrom(startOfMonth(t));
                setTo(endOfMonth(t));
              }
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: mode === m ? "2px solid #d97706" : "1px solid #e2e8f0",
              background: mode === m ? "#fef3c7" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#78350f",
            }}
          >
            {m === "daily"
              ? "Daily"
              : m === "weekly"
                ? "Weekly"
                : m === "monthly"
                  ? "Monthly"
                  : "Date range"}
          </button>
        ))}

        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{
              display: "block",
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
        </label>
        {mode !== "daily" && (
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </label>
        )}
        <button
          type="button"
          onClick={load}
          style={{
            marginTop: 18,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "#d97706",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            color: "#991b1b",
            padding: "12px 14px",
            borderRadius: 10,
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {mode !== "daily" && byDay.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: "1.25rem",
          }}
        >
          {byDay.map(([day, sum]) => (
            <div
              key={day}
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>
                {day}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                {fmt(sum)} ETB
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading costs…</p>
      ) : costs.length === 0 ? (
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
          No costs for this period.
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fef3c7", textAlign: "left" }}>
                <th style={{ padding: "12px 10px" }}>Date</th>
                <th style={{ padding: "12px 10px" }}>Item</th>
                <th style={{ padding: "12px 10px" }}>Unit price</th>
                <th style={{ padding: "12px 10px" }}>Qty</th>
                <th style={{ padding: "12px 10px" }}>Total</th>
                <th style={{ padding: "12px 10px" }}>Cashier</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px" }}>{c.date}</td>
                  <td style={{ padding: "10px", fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: "10px" }}>{fmt(c.unitPrice)}</td>
                  <td style={{ padding: "10px" }}>{c.quantity}</td>
                  <td style={{ padding: "10px", fontWeight: 800 }}>
                    {fmt(c.total)} ETB
                  </td>
                  <td style={{ padding: "10px" }}>{c.cashierName || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#fffbeb" }}>
                <td
                  colSpan={4}
                  style={{ padding: "12px 10px", fontWeight: 800 }}
                >
                  Total
                </td>
                <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                  {fmt(total)} ETB
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
