"use client";

import { useCallback, useEffect, useState } from "react";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  actor?: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.notifications || []);
      setUnread(typeof d.unread === "number" ? d.unread : (d.notifications || []).filter((n: Notif) => !n.is_read).length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label="Notifications"
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🔔
        {unread > 0 && (
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
            {unread > 99 ? "99+" : unread}
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
              width: "min(380px, calc(100vw - 24px))",
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
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <strong style={{ fontSize: 14, color: "#0f172a" }}>Notifications</strong>
              <button
                type="button"
                disabled={loading || unread === 0}
                onClick={markAllRead}
                style={{
                  border: "none",
                  background: "transparent",
                  color: unread ? "#0f766e" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: unread ? "pointer" : "default",
                }}
              >
                Mark all read
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {items.length === 0 ? (
                <p style={{ padding: 20, margin: 0, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                  No notifications
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) markRead(n.id);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid #f1f5f9",
                      background: n.is_read ? "#fff" : "#f0fdfa",
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      {!n.is_read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: "#0f766e",
                            marginTop: 5,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                          {n.title}
                        </div>
                        {n.message && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              marginTop: 4,
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.4,
                            }}
                          >
                            {n.message}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                          {new Date(n.created_at).toLocaleString()}
                          {n.actor ? ` · ${n.actor}` : ""}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
