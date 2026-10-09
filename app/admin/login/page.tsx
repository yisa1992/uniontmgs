import { redirect } from 'next/navigation'

/** Admin login now uses the unified /login page. */
export default function AdminLoginRedirect() {
  redirect('/login')
}
