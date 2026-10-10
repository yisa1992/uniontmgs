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
    <div className="flex-1 flex flex-col min-h-0">
      <AdminSidebar staffLabel={staffLabel} />
      <main className="flex-1 min-w-0 overflow-x-auto pb-2">{children}</main>
    </div>
  );
}
