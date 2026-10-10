import { redirect } from "next/navigation";

/**
 * /admin has no content page by itself in this app.
 * Send admins to the reports dashboard after login.
 */
export default function AdminIndexPage() {
  redirect("/admin/reports");
}
