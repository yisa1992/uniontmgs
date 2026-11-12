import { redirect } from "next/navigation";

export default function SignUpSuccessPage() {
  redirect("/admin-login");
}
