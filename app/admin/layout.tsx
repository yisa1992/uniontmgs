import { redirect } from "next/navigation";
import { getSession, requireRole } from "@/lib/auth";
import AdminSidebar from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || !requireRole(session, ["admin"])) {
    redirect("/login");
  }

  const staffLabel = session.fullName || session.username || "Admin";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f0fdfa 0%, #f8fafc 40%, #eef2ff 100%)",
      }}
    >
      <AdminSidebar staffLabel={staffLabel} />
      <main style={{ minHeight: "calc(100vh - 64px)", paddingBottom: 24 }}>
        {children}
      </main>
    </div>
  );
}
