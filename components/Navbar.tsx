"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

export default function Navbar({ user }: { user: SessionUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleLabel =
    user.role === "admin"
      ? "Admin"
      : user.role === "auditor"
      ? "Auditor"
      : "Cashier";

  return (
    <header
      style={{
        background: "white",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link
            href="/"
            style={{
              fontWeight: 800,
              fontSize: "1.15rem",
              color: "var(--primary)",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            Union TMS
          </Link>
          <nav style={{ display: "flex", gap: "0.25rem" }}>
            {user.role === "admin" && (
              <>
                <Link href="/admin" className="nav-link">
                  Reports
                </Link>
                <Link href="/admin/users" className="nav-link">
                  Users
                </Link>
              </>
            )}
            {user.role === "auditor" && (
              <Link href="/auditor" className="nav-link">
                Notifications
              </Link>
            )}
            {user.role === "cashier" && (
              <Link href="/cashier" className="nav-link">
                New Transaction
              </Link>
            )}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              <span className={`badge badge-${user.role}`}>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-outline"
            style={{ padding: "0.4rem 0.9rem" }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
