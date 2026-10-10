"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { Role } from "@/lib/types";

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const COLS = "140px 1fr 110px 100px 120px 100px";

const headerCell: CSSProperties = {
  padding: "12px 10px",
  background: "#f1f5f9",
  fontWeight: 700,
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
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
  display: "flex",
  alignItems: "center",
};

const roleColor: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#ccfbf1", fg: "#0f766e" },
  auditor: { bg: "#fef3c7", fg: "#92400e" },
  cashier: { bg: "#d1fae5", fg: "#065f46" },
  waiter: { bg: "#e0f2fe", fg: "#0369a1" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [active, setActive] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreate() {
    setEditing(null);
    setUsername("");
    setPassword("");
    setFullName("");
    setRole("cashier");
    setActive(true);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setUsername(u.username);
    setPassword("");
    setFullName(u.fullName);
    setRole(u.role);
    setActive(u.active);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          id: editing.id,
          fullName,
          role,
          active,
        };
        if (password) body.password = password;
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Update failed");
          return;
        }
        setSuccess("User updated successfully");
      } else {
        if (!password) {
          setError("Password is required for new users");
          return;
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, fullName, role }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Create failed");
          return;
        }
        if (role === "waiter") {
          setSuccess(
            `Waiter "${fullName}" registered successfully. They can be selected on the cashier form.`
          );
        } else {
          setSuccess(
            `${role.charAt(0).toUpperCase() + role.slice(1)} "${fullName}" created successfully.`
          );
        }
      }
      setShowForm(false);
      loadUsers();
    } catch {
      setError("Network error");
    }
  }

  const filtered = users.filter(
    (u) => roleFilter === "all" || u.role === roleFilter
  );

  if (loading && users.length === 0) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #0ea5e9 50%, #14b8a6 100%)",
          borderRadius: 20,
          padding: "1.35rem 1.5rem",
          color: "#fff",
          marginBottom: "1.5rem",
          boxShadow: "0 12px 40px rgba(124, 58, 237, 0.25)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>
            👥 User Management
          </h1>
          <p style={{ margin: "0.35rem 0 0", opacity: 0.92, fontSize: "0.9rem" }}>
            Create and edit Admin, Auditor, Waiter, and Cashier accounts
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: "12px 20px",
            background: "#fff",
            color: "#7c3aed",
            border: "none",
            borderRadius: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}
        >
          + New User
        </button>
      </div>

      {success && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.875rem 1rem",
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          {success}
        </div>
      )}

      {/* Role summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        {(
          [
            ["all", "All users", users.length],
            ["waiter", "Waiters", users.filter((u) => u.role === "waiter").length],
            ["cashier", "Cashiers", users.filter((u) => u.role === "cashier").length],
            ["auditor", "Auditors", users.filter((u) => u.role === "auditor").length],
            ["admin", "Admins", users.filter((u) => u.role === "admin").length],
          ] as [Role | "all", string, number][]
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRoleFilter(key)}
            style={{
              padding: "0.85rem 1rem",
              textAlign: "left",
              cursor: "pointer",
              border:
                roleFilter === key ? "2px solid #0f766e" : "1px solid #e2e8f0",
              background: roleFilter === key ? "#f0fdfa" : "#fff",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{count}</div>
          </button>
        ))}
      </div>

      {/* GRID list */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          overflowX: "auto",
          boxShadow: "0 8px 28px rgba(15, 23, 42, 0.07)",
        }}
      >
        {loading ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            No users found
          </p>
        ) : (
          <div style={{ minWidth: 700 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                background: "linear-gradient(90deg, #f3e8ff 0%, #e0f2fe 50%, #ecfdf5 100%)",
              }}
            >
              {["Username", "Full Name", "Role", "Status", "Created", "Actions"].map(
                (h) => (
                  <div key={h} style={headerCell}>
                    {h}
                  </div>
                )
              )}
            </div>
            {filtered.map((u) => {
              const rc = roleColor[u.role] || roleColor.cashier;
              return (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    background: u.role === "waiter" ? "#f0fdfa" : "#fff",
                  }}
                >
                  <div style={{ ...cell, fontWeight: 600 }}>{u.username}</div>
                  <div style={cell}>
                    {u.fullName}
                    {u.role === "waiter" && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          color: "#0f766e",
                          fontWeight: 600,
                        }}
                      >
                        (waiter)
                      </span>
                    )}
                  </div>
                  <div style={cell}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        background: rc.bg,
                        color: rc.fg,
                      }}
                    >
                      {u.role}
                    </span>
                  </div>
                  <div style={cell}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: u.active ? "#d1fae5" : "#fee2e2",
                        color: u.active ? "#065f46" : "#991b1b",
                      }}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={cell}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                  <div style={cell}>
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      style={{
                        padding: "6px 12px",
                        background: "transparent",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
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
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 420,
              width: "100%",
              padding: "1.5rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>
              {editing ? "Edit User" : "Create User"}
            </h2>
            {error && (
              <div
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.75rem",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Username</label>
                <input
                  style={inputStyle}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={!!editing}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Full Name</label>
                <input
                  style={inputStyle}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>
                  Password {editing ? "(leave blank to keep)" : ""}
                </label>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editing}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Role</label>
                <select
                  style={inputStyle}
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="admin">Admin</option>
                  <option value="auditor">Auditor</option>
                  <option value="cashier">Cashier</option>
                  <option value="waiter">Waiter</option>
                </select>
              </div>
              {editing && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active account
                </label>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#0f766e",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editing ? "Save Changes" : "Create User"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 4,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};
