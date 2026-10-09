"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      const role = data.user.role;
      // Admin area uses Supabase (Staff ID). Send admins to Admin Terminal login.
      if (role === "admin") {
        router.push("/admin-login");
        return;
      }
      if (role === "auditor") router.push("/auditor");
      else router.push("/cashier");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)",
        padding: "1.5rem",
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 420, padding: "2.5rem" }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "var(--primary)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "0.85rem",
              margin: "0 auto 1rem",
              letterSpacing: "0.02em",
            }}
          >
            UNION
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            Union TMS
          </h1>
          <p
            style={{
              margin: "0.4rem 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Transaction Management System
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label className="label">Username</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.75rem" }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.75rem",
            padding: "1rem",
            background: "#f8fafc",
            borderRadius: 8,
            fontSize: "0.8rem",
            color: "var(--muted)",
          }}
        >
          <strong style={{ color: "var(--foreground)" }}>Demo accounts:</strong>
          <div style={{ marginTop: "0.5rem", lineHeight: 1.7 }}>
            Admin: <code>admin</code> / <code>admin123</code>
            <br />
            Auditor: <code>auditor</code> / <code>auditor123</code>
            <br />
            Cashier: <code>cashier</code> / <code>cashier123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
