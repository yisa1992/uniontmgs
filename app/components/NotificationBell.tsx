"use client";

import { useCallback, useEffect, useState } from "react";

type UnpaidBill = {
  closedSaleId: string;
  rowIndex: number;
  date: string;
  departmentLabel: string;
  cashierName: string;
  name: string;
  phone: string;
  amount: number;
  daysOpen: number;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Bell shows only unpaid bills that are 5+ days old.
 * Failures are swallowed so the admin/auditor layout never crashes.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UnpaidBill[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/closed-sales/unpaid");
      if (!res.ok) {
        setItems([]);
        return;
      }
      const d = await res.json().catch(() => ({ items: [] }));
      const all = Array.isArray(d.items) ? d.items : [];
      const overdue = all
        .filter((x: UnpaidBill) => Number(x.daysOpen) >= 5)
        .sort(
          (a: UnpaidBill, b: UnpaidBill) =>
            b.daysOpen - a.daysOpen || a.date.localeCompare(b.date)
        );
      setItems(overdue);
    } catch {
      setItems([]);
      setError(null); // silent — do not break UI
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, [load]);

  const count = items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label="Overdue unpaid bills"
        title="Unpaid bills older than 5 days"
        style={{
          position: "relative",
          width: 42,
          height: 42,
          borderRadius: 12,
          border: "none",
          background: "rgba(255,255,255,0.18)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "#ef4444",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 80 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 64,
              right: 12,
              width: "min(400px, calc(100vw - 24px))",
              maxHeight: "min(480px, 70vh)",
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 16px 48px rgba(15,23,42,0.25)",
              zIndex: 90,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #fecaca",
                background: "#fef2f2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: "#991b1b" }}>
                  Overdue unpaid bills
                </strong>
                <div style={{ fontSize: 11, color: "#7f1d1d", marginTop: 2 }}>
                  Only bills unpaid for 5 days or more
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {error && (
                <p style={{ padding: 16, margin: 0, color: "#991b1b", fontSize: 13 }}>
                  {error}
                </p>
              )}
              {!error && count === 0 && (
                <p
                  style={{
                    padding: 24,
                    margin: 0,
                    color: "#94a3b8",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No unpaid bills older than 5 days
                </p>
              )}
              {items.map((u) => (
                <div
                  key={`${u.closedSaleId}-${u.rowIndex}`}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #fee2e2",
                    background: u.daysOpen >= 10 ? "#fff7ed" : "#fff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#0f172a",
                    }}
                  >
                    {u.name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {u.phone || "—"} ·{" "}
                    <strong style={{ color: "#b91c1c" }}>
                      {fmt(Number(u.amount) || 0)} ETB
                    </strong>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {u.date} · {u.daysOpen} days · {u.departmentLabel}
                    {u.cashierName ? ` · ${u.cashierName}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
