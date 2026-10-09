import { redirect } from 'next/navigation'

/** Use main /login only. */
export default function AdminLoginRedirect() {
  redirect('/login')
}
