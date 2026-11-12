import { redirect } from "next/navigation";

export default function AuthErrorPage() {
  redirect("/admin-login");
}
