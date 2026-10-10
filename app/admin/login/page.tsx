import { redirect } from 'next/navigation'

/** Login lives outside the admin layout at /admin-login so the auth guard does not wrap it. */
export default function AdminLoginRedirect() {
  redirect('/admin-login')
}
