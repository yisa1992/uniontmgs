"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SessionUser, Role } from "@/lib/types";

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
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
          if (d.user.role !== "admin") {
            router.push("/");
            return;
          }
          setUser(d.user);
          loadUsers();
        }
      });
  }, [router]);

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

  async function handleSubmit(e: React.FormEvent) {
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
        setSuccess("User created successfully");
      }
      setShowForm(false);
      loadUsers();
    } catch {
      setError("Network error");
    }
  }

  if (!user) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <Navbar user={user} />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>User Management</h1>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              Create and edit Admin, Auditor, and Cashier accounts
            </p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            + New User
          </button>
        </div>

        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            {success}
          </div>
        )}

        <div className="card table-wrap">
          {loading ? (
            <p style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Loading…
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.fullName}</td>
                    <td>
                      <span className={`badge badge-${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${u.active ? "badge-active" : "badge-inactive"}`}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                        onClick={() => openEdit(u)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create / Edit modal */}
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
              className="card"
              style={{ maxWidth: 440, width: "100%", padding: "1.5rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.15rem" }}>
                {editing ? "Edit User" : "Create User"}
              </h2>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                {!editing && (
                  <div style={{ marginBottom: "0.875rem" }}>
                    <label className="label">Username</label>
                    <input
                      className="input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div style={{ marginBottom: "0.875rem" }}>
                  <label className="label">Full Name</label>
                  <input
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ marginBottom: "0.875rem" }}>
                  <label className="label">
                    Password {editing && "(leave blank to keep)"}
                  </label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editing}
                  />
                </div>
                <div style={{ marginBottom: "0.875rem" }}>
                  <label className="label">Role</label>
                  <select
                    className="input"
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
                  <div style={{ marginBottom: "0.875rem" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
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
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    {editing ? "Save Changes" : "Create User"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
