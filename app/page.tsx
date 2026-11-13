import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { seedIfEmpty } from "@/lib/db";

export default async function Home() {
  // Do not block redirect on seeding — run in background
  void seedIfEmpty().catch(() => {});
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "admin") redirect("/admin");
  if (session.role === "auditor") redirect("/auditor");
  if (session.role === "cashier") redirect("/cashier");
  redirect("/login");
}
