import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AdminSidebar from './admin-sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One login only — same session as /login (no second Admin Terminal page)
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role !== 'admin') {
    redirect('/login')
  }

  const staffLabel = session.fullName || session.username || 'Admin'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      <AdminSidebar staffLabel={staffLabel} unreadCount={0} />
      <main className="flex-1 min-w-0 overflow-x-auto pb-2">{children}</main>
    </div>
  )
}
