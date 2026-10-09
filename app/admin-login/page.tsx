import { redirect } from 'next/navigation'

/**
 * Admin Terminal login page removed.
 * All users (including admin) now use the main /login page.
 */
export default function AdminLoginPage() {
  redirect('/login')
}
