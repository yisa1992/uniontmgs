"use client";

import { useState } from "react";

type Section = "restaurant" | "cafe" | "butchery" | null;

const sections: {
  id: Section;
  label: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    color: "#0ea5e9",
    description: "Close restaurant sales for the day",
  },
  {
    id: "cafe",
    label: "Cafe",
    icon: "☕",
    color: "#8b5cf6",
    description: "Close cafe sales for the day",
  },
  {
    id: "butchery",
    label: "Butchery",
    icon: "🥩",
    color: "#f59e0b",
    description: "Close butchery sales for the day",
  },
];

export default function SalesClosingPage() {
  const [active, setActive] = useState<Section>(null);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sales Closing</h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
          Select a department to review and close daily sales
        </p>
      </div>

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
                border: isActive
                  ? `2px solid ${s.color}`
                  : "2px solid #e2e8f0",
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
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {s.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div
          className="card"
          style={{
            marginTop: "1.75rem",
            padding: "1.5rem",
            borderTop: `4px solid ${
              sections.find((s) => s.id === active)?.color
            }`,
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>
              {sections.find((s) => s.id === active)?.icon}
            </span>
            {sections.find((s) => s.id === active)?.label} — Sales Closing
          </h2>
          <p style={{ color: "var(--muted)", margin: "0 0 1.25rem", fontSize: 14 }}>
            Review totals and confirm closing for this department.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {[
              { label: "Today's Total", value: "—" },
              { label: "Transactions", value: "—" },
              { label: "Last Close", value: "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#f8fafc",
                  borderRadius: 12,
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ fontWeight: 800, fontSize: "1.25rem" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              style={{
                background: sections.find((s) => s.id === active)?.color,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Confirm Close
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setActive(null)}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
