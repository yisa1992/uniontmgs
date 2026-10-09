import { redirect } from 'next/navigation'

/** Second admin login removed — use the main /login page only. */
export default function AdminLoginPage() {
  redirect('/login')
}
